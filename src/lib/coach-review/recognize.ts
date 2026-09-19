import { weekdayLabel } from "@/lib/calendar";

const CLUB_RE = /\b(club|chain.?gang|chaingang|group ride|league|coached)\b/i;

const QUALITY_RE =
  /\b(threshold|interval|vo2|sweet.?spot|quality|race pace|openers?|turbo|coached)\b/i;

export type ReviewSession = {
  date: string;
  title: string;
  weekday: string;
  minutes: number | null;
  kind: "race" | "club" | "quality" | "aerobic" | "planned";
  importance: "A" | "B" | "C" | null;
  source: "calendar" | "activity" | "routine";
};

export function looksLikeRace(input: {
  intent?: string | null;
  sessionType?: string | null;
  linkedToRace?: boolean;
}) {
  if (input.intent === "race" || input.linkedToRace) {
    return true;
  }
  return input.sessionType?.trim().toLowerCase() === "race";
}

export function looksLikeClub(title: string) {
  return CLUB_RE.test(title);
}

export function looksLikeQuality(title: string) {
  return QUALITY_RE.test(title);
}

export function classifySession(input: {
  date: string;
  title: string;
  minutes: number | null;
  weekday?: string;
  intent?: string | null;
  sessionType?: string | null;
  linkedToRace?: boolean;
  importance?: "A" | "B" | "C" | null;
  source: ReviewSession["source"];
}): ReviewSession {
  const title = input.title.trim() || "Session";
  const race = looksLikeRace(input);
  const kind = race
    ? "race"
    : looksLikeClub(title)
      ? "club"
      : looksLikeQuality(title)
        ? "quality"
        : (input.minutes ?? 0) >= 60
          ? "aerobic"
          : "planned";
  return {
    date: input.date,
    title,
    weekday: input.weekday ?? weekdayLabel(input.date),
    minutes: input.minutes,
    kind,
    importance: input.importance ?? null,
    source: input.source,
  };
}

export function uniqueRaces(sessions: ReviewSession[]) {
  const seen = new Set<string>();
  const races: ReviewSession[] = [];
  for (const session of sessions.filter((row) => row.kind === "race")) {
    const key = `${session.date}:${session.title.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    races.push(session);
  }
  return races.sort((left, right) => left.date.localeCompare(right.date));
}

export function recurringFixtures(sessions: ReviewSession[]) {
  const buckets = new Map<string, ReviewSession[]>();
  for (const session of sessions) {
    if (session.kind === "race") {
      continue;
    }
    const key = `${session.weekday}:${normalizeTitle(session.title)}`;
    const list = buckets.get(key) ?? [];
    list.push(session);
    buckets.set(key, list);
  }
  return [...buckets.values()]
    .filter((list) => list.length >= 3)
    .map((list) => list[0])
    .filter((row): row is ReviewSession => Boolean(row))
    .sort((left, right) => weekdayOrder(left.weekday) - weekdayOrder(right.weekday));
}

function weekdayOrder(label: string) {
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(label);
}

function normalizeTitle(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 3)
    .join(" ");
}
