import { formatMonthName, formatWeekdayDate } from "@/lib/calendar";
import type { ReviewPacket } from "@/lib/coach-review/packet";
import { daysSince } from "@/lib/coach-review/period";
import type { ReviewSession } from "@/lib/coach-review/recognize";
import type { CoachReview } from "@/lib/coach-review/types";
import { formatTrainingMetric } from "@/lib/load/training-state";

function trend(start: number | null, end: number | null) {
  if (start == null || end == null) {
    return "Unknown";
  }
  const delta = end - start;
  if (Math.abs(delta) < 0.04 * Math.max(Math.abs(start), 1)) {
    return "Stable";
  }
  return delta > 0 ? "Rising" : "Falling";
}

function performanceEvidenceLabel(packet: ReviewPacket) {
  const scored = packet.raceResults.filter((row) => row.place != null || row.status !== "completed");
  if (scored.length >= 2) {
    return "Present";
  }
  if (scored.length === 1) {
    return "Emerging";
  }
  if (packet.routeEvidence !== "limited") {
    return "Emerging";
  }
  return "Limited";
}

function named(list: ReviewSession[]) {
  return list.map((row) => row.title);
}

function nearRaces(packet: ReviewPacket) {
  return packet.upcomingRaces.filter(
    (race) => daysSince(packet.periodEnd, race.date) <= 2,
  );
}

function immediatePriority(packet: ReviewPacket) {
  const soon = nearRaces(packet)[0];
  if (!soon) {
    return null;
  }
  const gap = daysSince(packet.periodEnd, soon.date);
  const when = gap <= 0 ? "today" : gap === 1 ? "tomorrow" : formatWeekdayDate(soon.date);
  return `Arrive fresh for ${soon.title} ${when}.`;
}

function nextGoal(packet: ReviewPacket, specificTrend: string, aerobicTrend: string) {
  const races = packet.upcomingRaces;
  const raceSpan =
    races.length >= 2
      ? `through the upcoming race period (${races
          .slice(0, 4)
          .map((row) => row.title)
          .join(", ")})`
      : races.length === 1
        ? `around ${races[0].title}`
        : null;
  if (raceSpan && aerobicTrend === "Falling") {
    return `Race ${raceSpan} while putting aerobic work back underneath, so the base does not keep drifting down.`;
  }
  if (raceSpan) {
    return `Continue developing specific capacity ${raceSpan} while preserving enough aerobic work to keep the base from drifting down.`;
  }
  if (specificTrend === "Rising" && aerobicTrend !== "Falling") {
    return "Keep developing specific fitness without giving away the aerobic base that held this month.";
  }
  if (aerobicTrend === "Falling") {
    return "Rebuild aerobic volume before adding more intensity.";
  }
  return "Hold the current mix and let the next comparable efforts tell us whether it is landing.";
}

function keepRoles(packet: ReviewPacket) {
  const quality = packet.fixtures
    .filter((row) => row.kind === "club" || row.kind === "quality")
    .sort((left, right) => weekdayRank(left.weekday) - weekdayRank(right.weekday));
  const seen = new Set<string>();
  const unique = quality.filter((row) => {
    if (seen.has(row.weekday)) {
      return false;
    }
    seen.add(row.weekday);
    return true;
  });
  const roles: string[] = [];
  const first = unique[0];
  const second = unique[1];
  if (first) {
    roles.push(`${weekdayName(first.weekday)} ${roleLabel(first)} — key quality work`);
  }
  if (second) {
    roles.push(
      `${weekdayName(second.weekday)} ${roleLabel(second)} — retain if sufficiently recovered`,
    );
  }
  roles.push("One meaningful aerobic ride each week");
  if (packet.upcomingRaces.length > 0) {
    roles.push("Race opener only before priority races");
  }
  return roles;
}

function roleLabel(session: ReviewSession) {
  if (session.kind === "club") {
    return session.title.toLowerCase().includes("coach")
      ? "coached session"
      : "club session";
  }
  if (session.title.toLowerCase().includes("coach")) {
    return "coached session";
  }
  return "quality session";
}

const WEEKDAYS: Record<string, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};

function weekdayName(label: string) {
  return WEEKDAYS[label] ?? label;
}

function weekdayRank(label: string) {
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(label);
}

export function composeCoachReview(input: {
  athleteId: string;
  packet: ReviewPacket;
}): CoachReview {
  const { packet } = input;
  const specificTrend = trend(packet.specificRawStart, packet.specificRawEnd);
  const aerobicTrend = trend(packet.aerobicRawStart, packet.aerobicRawEnd);
  const startLabel = packet.performanceStart.label;
  const endLabel = packet.performanceEnd.label;
  const now = new Date().toISOString();
  const raceNames = named(packet.races);
  const fitness =
    packet.fitnessStart != null && packet.fitnessEnd != null
      ? `Fitness ${
          packet.fitnessEnd - packet.fitnessStart > 0.4
            ? "rose"
            : packet.fitnessEnd - packet.fitnessStart < -0.4
              ? "fell"
              : "held"
        } from ${formatTrainingMetric(packet.fitnessStart)} to ${formatTrainingMetric(packet.fitnessEnd)}`
      : "Fitness was not established for the whole block";

  const effects = [
    fitness,
    `Specific capacity ${specificTrend.toLowerCase()}`,
    `Aerobic capacity ${aerobicTrend.toLowerCase()}`,
    startLabel === endLabel
      ? `Performance stayed ${endLabel}`
      : `Performance moved from ${startLabel} to ${endLabel}`,
  ];

  const happened = [
    `You trained on ${packet.trainedDays} days. Combined load was ${Math.round(packet.trainingLoad)}.`,
    raceNames.length > 0
      ? `Competition in the block: ${raceNames.join(", ")}.`
      : null,
    `${effects.join(". ")}.`,
  ]
    .filter(Boolean)
    .join(" ");

  const didItWork = `There was no stated objective, so we can’t judge this block against a planned outcome. But the month did produce a clear training effect: ${effects.join(", ")}. ${
    packet.routeEvidence === "limited"
      ? "We don’t yet have enough comparable performance evidence to say how much of that translated into speed."
      : "Repeated efforts are beginning to show whether that stimulus is turning into speed."
  }`;

  const worked: CoachReview["worked"] = [];
  if (specificTrend === "Rising" && aerobicTrend !== "Falling") {
    worked.push({
      title: "Specific development without aerobic loss",
      body: "Specific capacity rose while aerobic capacity remained stable.",
    });
  }
  if (aerobicTrend === "Stable" || aerobicTrend === "Rising") {
    worked.push({
      title: "Enough easy work to maintain the base",
      body: "The aerobic work around harder sessions was sufficient to keep aerobic capacity stable.",
    });
  }

  const didnt: CoachReview["didnt"] = [];
  if (packet.trainedDays < 8) {
    didnt.push({
      title: "The month was thinly trained",
      body: `Only ${packet.trainedDays} trained days landed in this window, so the next block should protect consistency before it adds ambition.`,
    });
  }
  if (aerobicTrend === "Falling") {
    didnt.push({
      title: "Aerobic capacity eased",
      body: "Aerobic capacity fell across the block. If that continues, add an easy day rather than another hard one.",
    });
  }
  if (packet.races.length >= 3 && specificTrend !== "Rising") {
    didnt.push({
      title: "A race-heavy month without a specific rise",
      body: "There was plenty of competition, but Specific capacity did not rise with it. The next block should make the midweek quality session count, not just the weekends.",
    });
  }

  const lessons =
    specificTrend === "Rising" && aerobicTrend !== "Falling"
      ? "Specific work can increase without sacrificing the aerobic base. This block shifted more strongly towards specific work while aerobic capacity remained stable. For the next block, there is no obvious reason to add more intensity simply to increase load."
      : aerobicTrend === "Falling"
        ? "The current mix is costing aerobic capacity. Next month should protect one real easy ride each week before we ask for more specific work."
        : "The current mix appears sustainable. Specific and aerobic capacity held together. The next useful question is whether that stimulus begins showing up in comparable performance.";

  const nextRace = packet.upcomingRaces[0];
  const change = [
    aerobicTrend === "Falling"
      ? "Protect aerobic volume before adding another quality session"
      : packet.upcomingRaces.length >= 2
        ? "In race weeks, one quality midweek session is enough — races supply the second stimulus"
        : "Do not add intensity just because Fitness rose",
  ];
  const watch = [
    aerobicTrend === "Falling"
      ? "Aerobic volume — if it keeps falling, the easy day becomes the priority"
      : "Whether the specific work starts showing up on repeated routes or similar efforts",
  ];

  return {
    id: crypto.randomUUID(),
    athleteId: input.athleteId,
    periodStart: packet.periodStart,
    periodEnd: packet.periodEnd,
    createdAt: now,
    completedAt: now,
    kind: "month",
    source: "compose",
    title: `${formatMonthName(packet.periodEnd)} Coach Review`,
    directionLabel: endLabel,
    directionTrajectory: packet.performanceEnd.score != null
      ? `Performance ${packet.performanceEnd.score}`
      : null,
    fitnessStart: packet.fitnessStart,
    fitnessEnd: packet.fitnessEnd,
    specificTrend,
    aerobicTrend,
    races: packet.races.length,
    performanceEvidence: performanceEvidenceLabel(packet),
    objective:
      packet.races.length > 0
        ? `No formal block objective was written down. From the completed month, this period looks like race-specific work around ${raceNames.join(", ")}.`
        : "No formal block objective was set. This review reads the completed month, not a plan invented afterwards.",
    happened,
    didItWork,
    worked: worked.slice(0, 2),
    didnt: didnt.slice(0, 3),
    unknown: [
      packet.races.length > 0 &&
      packet.raceResults.filter((row) => row.place != null || row.status !== "completed")
        .length === 0
        ? "Race results are missing, so treat this block as training evidence only."
        : "",
      packet.routeEvidence === "limited"
        ? "Comparable efforts are still thin, so treat the capacity rise as a training effect, not a confirmed jump in speed."
        : "",
    ]
      .filter(Boolean)
      .join(" "),
    lessons,
    immediatePriority: immediatePriority(packet),
    nextObjective: nextGoal(packet, specificTrend, aerobicTrend),
    nextKeep: keepRoles(packet),
    nextChange: change,
    nextWatch: watch,
    nextPriorities: [
      "Protect one quality session in race weeks",
      "Protect one meaningful aerobic ride each week",
      nextRace
        ? `Keep the final 48 hours before ${nextRace.title} light`
        : "Keep the final 48 hours before a priority race light",
    ],
    evidence: {
      fitnessStart: packet.fitnessStart,
      fitnessEnd: packet.fitnessEnd,
      directionStart: startLabel,
      directionEnd: endLabel,
      directionScoreStart: packet.directionStart.score,
      directionScoreEnd: packet.directionEnd.score,
      aerobicRawStart: packet.aerobicRawStart,
      aerobicRawEnd: packet.aerobicRawEnd,
      specificRawStart: packet.specificRawStart,
      specificRawEnd: packet.specificRawEnd,
      trainingLoad: packet.trainingLoad,
      trainedDays: packet.trainedDays,
      historyDays: packet.historyDays,
    },
  };
}

export function composeWeeklyReview(input: {
  athleteId: string;
  packet: ReviewPacket;
}): CoachReview {
  const { packet } = input;
  const specificTrend = trend(packet.specificRawStart, packet.specificRawEnd);
  const aerobicTrend = trend(packet.aerobicRawStart, packet.aerobicRawEnd);
  const startLabel = packet.performanceStart.label;
  const endLabel = packet.performanceEnd.label;
  const now = new Date().toISOString();
  const raceNames = named(packet.races);
  const fitness =
    packet.fitnessStart != null && packet.fitnessEnd != null
      ? `Fitness ${
          packet.fitnessEnd - packet.fitnessStart > 0.4
            ? "rose"
            : packet.fitnessEnd - packet.fitnessStart < -0.4
              ? "fell"
              : "held"
        } from ${formatTrainingMetric(packet.fitnessStart)} to ${formatTrainingMetric(packet.fitnessEnd)}`
      : null;
  const happened = [
    `You trained on ${packet.trainedDays} day${packet.trainedDays === 1 ? "" : "s"}. Combined load was ${Math.round(packet.trainingLoad)}.`,
    raceNames.length > 0 ? `Competition: ${raceNames.join(", ")}.` : null,
    fitness,
    `Specific capacity ${specificTrend.toLowerCase()}. Aerobic capacity ${aerobicTrend.toLowerCase()}.`,
    startLabel === endLabel
      ? `Performance stayed ${endLabel}.`
      : `Performance moved from ${startLabel} to ${endLabel}.`,
  ]
    .filter(Boolean)
    .join(" ");

  const worked: CoachReview["worked"] = [];
  if (specificTrend === "Rising" && aerobicTrend !== "Falling") {
    worked.push({
      title: "Specific capacity rose without an aerobic decline",
      body: "Specific capacity increased while aerobic capacity remained stable.",
    });
  }

  const didnt: CoachReview["didnt"] = [];
  if (packet.trainedDays < 3) {
    didnt.push({
      title: "A thin week",
      body: `Only ${packet.trainedDays} trained day${packet.trainedDays === 1 ? "" : "s"} landed.`,
    });
  }
  if (aerobicTrend === "Falling") {
    didnt.push({
      title: "Aerobic capacity eased",
      body: "Aerobic capacity fell across the week.",
    });
  }

  return {
    id: crypto.randomUUID(),
    athleteId: input.athleteId,
    kind: "week",
    periodStart: packet.periodStart,
    periodEnd: packet.periodEnd,
    createdAt: now,
    completedAt: now,
    source: "compose",
    title: `Week ending ${formatWeekdayDate(packet.periodEnd)}`,
    directionLabel: endLabel,
    directionTrajectory: packet.performanceEnd.score != null
      ? `Performance ${packet.performanceEnd.score}`
      : null,
    fitnessStart: packet.fitnessStart,
    fitnessEnd: packet.fitnessEnd,
    specificTrend,
    aerobicTrend,
    races: packet.races.length,
    performanceEvidence: performanceEvidenceLabel(packet),
    objective: "",
    happened,
    didItWork: "",
    worked,
    didnt,
    unknown: "",
    lessons:
      specificTrend === "Rising" && aerobicTrend !== "Falling"
        ? "Specific capacity rose while aerobic capacity held."
        : aerobicTrend === "Falling"
          ? "Aerobic capacity fell this week."
          : "The week did not produce a strong capacity change.",
    immediatePriority: immediatePriority(packet),
    nextObjective: "",
    nextKeep: [],
    nextChange: [],
    nextWatch: [],
    nextPriorities: [],
    evidence: {
      fitnessStart: packet.fitnessStart,
      fitnessEnd: packet.fitnessEnd,
      directionStart: startLabel,
      directionEnd: endLabel,
      directionScoreStart: packet.directionStart.score,
      directionScoreEnd: packet.directionEnd.score,
      aerobicRawStart: packet.aerobicRawStart,
      aerobicRawEnd: packet.aerobicRawEnd,
      specificRawStart: packet.specificRawStart,
      specificRawEnd: packet.specificRawEnd,
      trainingLoad: packet.trainingLoad,
      trainedDays: packet.trainedDays,
      historyDays: packet.historyDays,
    },
  };
}

function asFindings(value: unknown) {
  const rows = Array.isArray(value) ? value : value ? [value] : [];
  return rows
    .map((row) => {
      if (typeof row === "string") {
        const text = row.trim();
        return text ? { title: text, body: text } : null;
      }
      if (!row || typeof row !== "object") {
        return null;
      }
      const item = row as { title?: unknown; body?: unknown };
      const title = asText(item.title);
      const body = asText(item.body);
      if (!title || !body) {
        return null;
      }
      return { title, body };
    })
    .filter((row): row is { title: string; body: string } => Boolean(row));
}

function asLines(value: unknown) {
  if (typeof value === "string") {
    return value
      .split(/\n+/)
      .map((row) => row.replace(/^[-*]\s*/, "").trim())
      .filter(Boolean);
  }
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((row) => asText(row)).filter(Boolean);
}

function asText(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((row) => asText(row)).filter(Boolean).join(" ");
  }
  if (value && typeof value === "object") {
    const row = value as { text?: unknown; body?: unknown; content?: unknown };
    return asText(row.text ?? row.body ?? row.content);
  }
  return "";
}

function unwrapGenerated(value: unknown): Record<string, unknown> {
  let current = value;
  for (let step = 0; step < 3; step += 1) {
    if (typeof current === "string") {
      try {
        current = JSON.parse(current);
      } catch {
        return {};
      }
      continue;
    }
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return {};
    }
    const row = current as Record<string, unknown>;
    if (row.review && typeof row.review === "object") {
      current = row.review;
      continue;
    }
    return row;
  }
  return {};
}

function field(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const text = asText(row[key]);
    if (text) {
      return text;
    }
  }
  return "";
}

const EVIDENCE_GAP =
  /\b(no (clear )?(result|race|evidence|problem)|don'?t know|do not know|limited evidence|cannot (yet )?assess|no race-execution|nothing (significant|obvious)|stands out)\b/i;

function realProblems(items: { title: string; body: string }[]) {
  return items.filter((item) => !EVIDENCE_GAP.test(`${item.title} ${item.body}`));
}

export function applyGeneratedReview(
  review: CoachReview,
  generated: Record<string, unknown>,
): CoachReview {
  const row = unwrapGenerated(generated);
  const worked = asFindings(row.worked);
  const didnt = asFindings(row.didnt);
  const keep = asLines(row.nextKeep ?? row.keep);
  const change = asLines(row.nextChange ?? row.change);
  const watch = asLines(row.nextWatch ?? row.watch);
  const immediate = field(row, "immediatePriority", "immediate_priority");
  const objective = field(row, "objective", "intent");
  const happened = field(row, "happened", "whatHappened", "what_happened");
  const didItWork = field(row, "didItWork", "did_it_work");
  const lessons = field(row, "lessons", "whatWeLearned", "what_we_learned");
  const nextObjective = field(
    row,
    "nextObjective",
    "next_objective",
    "nextGoal",
    "next_block_goal",
  );
  if (!objective || !happened || !didItWork || !lessons || !nextObjective) {
    throw new Error("Coach Review came back incomplete. Try again.");
  }
  return {
    ...review,
    kind: "month",
    source: "terra",
    objective,
    happened,
    didItWork,
    worked: worked.slice(0, 3),
    didnt: realProblems(didnt).slice(0, 3),
    unknown: asText(row.unknown),
    lessons,
    immediatePriority: immediate || null,
    nextObjective,
    nextKeep: keep.slice(0, 6),
    nextChange: change.slice(0, 4),
    nextWatch: watch.slice(0, 3),
    nextPriorities: [],
  };
}
