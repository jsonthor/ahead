/**
 * Direction — adaptation trajectory over weeks.
 *
 * Each day's raw score is rebuilt from that day's trailing window.
 * The displayed score is then EMA-smoothed forward, so it is path-dependent.
 * Recompute the series from the earliest changed date after backfill.
 *
 *   Building     +20 … +100
 *   Maintaining  −19 … +19
 *   Declining    −100 … −20
 *
 * Strain is the cost of that trajectory, not a band on the axis.
 * Fitness rising is stimulus, not proof of gain.
 * Aerobic/specific trends use raw states (Araw / Sraw), not 0–100 display scores.
 */

export const DIRECTION_WINDOW_DAYS = 42;
export const DIRECTION_MIN_DAYS = 21;
export const DIRECTION_SMOOTH_DAYS = 24;
export const DIRECTION_TRAJECTORY_DAYS = 21;
export const DIRECTION_HISTORY_DAYS = 90;
export const DIRECTION_VERSION = "direction-v5";
const DIRECTION_TRAJECTORY_DELTA = 4;

export const DIRECTION_BANDS = {
  decliningMax: -20,
  buildingMin: 20,
} as const;

export const DIRECTION_STATES = ["building", "maintaining", "declining", "unknown"] as const;

export type DirectionState = (typeof DIRECTION_STATES)[number];
export type DirectionConfidence = "high" | "moderate" | "low";
export type DirectionTrajectory = "up" | "down" | "flat";

export type DirectionDay = {
  date: string;
  training_load: number | null;
  fitness: number | null;
  fatigue: number | null;
  form: number | null;
  potential: number | null;
  aerobic_reserve: number | null;
  specific_capacity: number | null;
  aerobic_raw: number | null;
  specific_raw: number | null;
};

export type DirectionCalibration = {
  aerobic_low: number;
  aerobic_high: number;
  specific_low: number;
  specific_high: number;
};

export function isDirectionCalibration(value: unknown): value is DirectionCalibration {
  if (!value || typeof value !== "object") {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    typeof row.aerobic_low === "number" &&
    typeof row.aerobic_high === "number" &&
    typeof row.specific_low === "number" &&
    typeof row.specific_high === "number"
  );
}

export type RouteResponseAttempt = {
  clusterId: string;
  startedAt: string;
  speedMps: number | null;
  avgHr: number | null;
  durationSeconds: number | null;
};

export type DirectionResponse = {
  status: "improving" | "flat" | "declining" | "unknown";
  evidence: string | null;
};

export type DirectionSignal = {
  label: string;
  value: string;
};

export type DirectionReading = {
  state: DirectionState;
  label: string;
  score: number | null;
  strain: boolean;
  summary: string;
  conclusion: string;
  confidence: DirectionConfidence;
  confidenceLabel: string;
  performanceNote: string | null;
  explanation: string;
  evidence: string[];
  signals: DirectionSignal[];
  windowLabel: string;
  windowDays: number;
  asOf: string | null;
  trajectory: DirectionTrajectory | null;
  trajectoryLabel: string | null;
};

const LABELS: Record<DirectionState, string> = {
  building: "Building",
  maintaining: "Maintaining",
  declining: "Declining",
  unknown: "Unknown",
};

const CONFIDENCE_LABELS: Record<DirectionConfidence, string> = {
  high: "High confidence",
  moderate: "Moderate confidence",
  low: "Low confidence",
};

export function directionLabel(state: DirectionState | null) {
  return state ? LABELS[state] : LABELS.unknown;
}

export function directionConfidenceLabel(confidence: DirectionConfidence) {
  return CONFIDENCE_LABELS[confidence];
}

export function formatDirectionScore(score: number) {
  if (score > 0) {
    return `+${score}`;
  }
  if (score < 0) {
    return `−${Math.abs(score)}`;
  }
  return "0";
}

export function directionTrajectoryMark(trajectory: DirectionTrajectory | null) {
  if (trajectory === "up") {
    return "↑";
  }
  if (trajectory === "down") {
    return "↓";
  }
  return null;
}

export function directionTrajectoryLabel(trajectory: DirectionTrajectory | null) {
  if (trajectory === "up") {
    return "trending up";
  }
  if (trajectory === "down") {
    return "trending down";
  }
  return null;
}

export function directionHeadline(reading: Pick<DirectionReading, "label" | "state">) {
  return reading.label;
}

export function directionScaleCopy() {
  return {
    building: "Building begins at +20",
    maintaining: "Maintaining −19 → +19",
    declining: "Declining −20 and below",
  };
}

export function directionQuestions(reading: DirectionReading) {
  if (reading.state === "unknown" || !reading.asOf) {
    return [];
  }
  if (reading.state === "declining") {
    return [
      "Why did Direction fall so far here?",
      "What was different during this period?",
    ];
  }
  if (reading.state === "building") {
    return ["Why was I Building here?", "What was different during this period?"];
  }
  return [`Why was I ${reading.label} here?`, "What was different during this period?"];
}

function windowLabelFor(days: number) {
  const weeks = Math.max(3, Math.round(days / 7));
  return `Previous ${weeks} weeks`;
}

function unmapMix(score: number | null | undefined, low: number, high: number) {
  if (score == null || !Number.isFinite(score)) {
    return null;
  }
  const clamped = Math.min(100, Math.max(0, score));
  return low + (clamped / 100) * (high - low);
}

export function hydrateDirectionDays(
  days: Array<
    Omit<DirectionDay, "aerobic_raw" | "specific_raw"> & {
      aerobic_raw?: number | null;
      specific_raw?: number | null;
    }
  >,
  calibration?: DirectionCalibration | null,
): DirectionDay[] {
  return days.map((day) => ({
    date: day.date,
    training_load: day.training_load,
    fitness: day.fitness,
    fatigue: day.fatigue,
    form: day.form,
    potential: day.potential,
    aerobic_reserve: day.aerobic_reserve,
    specific_capacity: day.specific_capacity,
    aerobic_raw:
      day.aerobic_raw ??
      (calibration
        ? unmapMix(day.aerobic_reserve, calibration.aerobic_low, calibration.aerobic_high)
        : null),
    specific_raw:
      day.specific_raw ??
      (calibration
        ? unmapMix(day.specific_capacity, calibration.specific_low, calibration.specific_high)
        : null),
  }));
}

export function directionStateFromScore(score: number | null): DirectionState {
  if (score == null || !Number.isFinite(score)) {
    return "unknown";
  }
  if (score >= DIRECTION_BANDS.buildingMin) {
    return "building";
  }
  if (score > DIRECTION_BANDS.decliningMax) {
    return "maintaining";
  }
  return "declining";
}

function mean(values: number[]) {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function present(values: Array<number | null | undefined>) {
  return values.filter((value): value is number => value != null && Number.isFinite(value));
}

function clamp(value: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, value));
}

function signed(value: number, digits = 1) {
  const shown = Math.abs(value).toFixed(digits);
  if (value > 0.05) {
    return `+${shown}`;
  }
  if (value < -0.05) {
    return `−${shown}`;
  }
  return shown;
}

function trendRatio(values: number[]): number | null {
  if (values.length < 8) {
    return null;
  }
  const width = Math.max(3, Math.floor(values.length / 3));
  const early = mean(values.slice(0, width));
  const late = mean(values.slice(-width));
  if (early == null || late == null) {
    return null;
  }
  return clamp((late - early) / Math.max(Math.abs(early), 1), -1, 1);
}

function weeklyLoad(days: DirectionDay[]) {
  const weeks: number[] = [];
  for (let index = 0; index < days.length; index += 7) {
    const slice = days.slice(index, index + 7);
    weeks.push(slice.reduce((sum, day) => sum + (day.training_load ?? 0), 0));
  }
  return weeks;
}

function trendOf(ratio: number | null): "up" | "flat" | "down" | null {
  if (ratio == null) {
    return null;
  }
  if (ratio > 0.06) {
    return "up";
  }
  if (ratio < -0.06) {
    return "down";
  }
  return "flat";
}

export function attemptsFromActivityRoutes(
  activities: Array<{
    id: string;
    started_at: string;
    duration_seconds: number | null;
    moving_seconds?: number | null;
    avg_hr: number | null;
    avg_speed_mps: number | null;
  }>,
  routes: Array<{ activity_id: string; route_cluster_id: string | null }>,
): RouteResponseAttempt[] {
  const byId = new Map(activities.map((row) => [row.id, row]));
  return routes.flatMap((route) => {
    if (!route.route_cluster_id) {
      return [];
    }
    const activity = byId.get(route.activity_id);
    if (!activity) {
      return [];
    }
    return [
      {
        clusterId: route.route_cluster_id,
        startedAt: activity.started_at,
        speedMps: activity.avg_speed_mps,
        avgHr: activity.avg_hr,
        durationSeconds: activity.moving_seconds ?? activity.duration_seconds,
      },
    ];
  });
}

export function observeRouteResponse(
  attempts: RouteResponseAttempt[],
  asOf?: string,
): DirectionResponse {
  const cutoff = asOf ? `${asOf}T23:59:59.999Z` : null;
  const scoped = cutoff
    ? attempts.filter((attempt) => attempt.startedAt <= cutoff)
    : attempts;
  const byCluster = new Map<string, RouteResponseAttempt[]>();
  for (const attempt of scoped) {
    if (!attempt.clusterId) {
      continue;
    }
    const rows = byCluster.get(attempt.clusterId) ?? [];
    rows.push(attempt);
    byCluster.set(attempt.clusterId, rows);
  }

  let improving = 0;
  let declining = 0;
  let compared = 0;
  let usedSimilarHr = false;

  for (const rows of byCluster.values()) {
    const usable = rows
      .filter((row) => (row.speedMps != null && row.speedMps > 0) || row.durationSeconds)
      .sort((left, right) => left.startedAt.localeCompare(right.startedAt));
    if (usable.length < 4) {
      continue;
    }
    const width = Math.max(2, Math.floor(usable.length / 3));
    const early = usable.slice(0, width);
    const late = usable.slice(-width);
    const earlySpeed = mean(
      present(early.map((row) => row.speedMps)).filter((value) => value > 0),
    );
    const lateSpeed = mean(
      present(late.map((row) => row.speedMps)).filter((value) => value > 0),
    );
    if (earlySpeed == null || lateSpeed == null || earlySpeed <= 0) {
      continue;
    }
    const similarHr = late.filter((row) => {
      const lateHr = row.avgHr;
      if (lateHr == null) {
        return false;
      }
      return early.some(
        (prior) => prior.avgHr != null && Math.abs(prior.avgHr - lateHr) <= 5,
      );
    });
    const similarSpeed = mean(
      present(similarHr.map((row) => row.speedMps)).filter((value) => value > 0),
    );
    const change = ((similarSpeed ?? lateSpeed) - earlySpeed) / earlySpeed;
    if (similarSpeed != null) {
      usedSimilarHr = true;
    }
    compared += 1;
    if (change > 0.02) {
      improving += 1;
    } else if (change < -0.02) {
      declining += 1;
    }
  }

  if (compared < 1) {
    return { status: "unknown", evidence: null };
  }
  if (improving > declining && improving >= 1) {
    return {
      status: "improving",
      evidence: usedSimilarHr
        ? "Comparable rides faster at similar heart rates"
        : "Repeated-route performance improving",
    };
  }
  if (declining > improving) {
    return {
      status: "declining",
      evidence: "Comparable rides slower than earlier in the block",
    };
  }
  return {
    status: "flat",
    evidence: "Repeated-route performance is flat",
  };
}

function responseScore(response: DirectionResponse) {
  if (response.status === "improving") {
    return 22;
  }
  if (response.status === "declining") {
    return -22;
  }
  return 0;
}

function consistencyScore(ratio: number | null) {
  if (ratio == null || Math.abs(ratio) <= 0.06) {
    return 0;
  }
  return clamp(ratio * 20, -20, 20);
}

function decideConfidence(
  state: DirectionState,
  response: DirectionResponse,
  windowDays: number,
): DirectionConfidence {
  if (state === "unknown") {
    return "low";
  }
  if (windowDays < 28) {
    return "low";
  }
  if (response.status === "improving" || response.status === "declining") {
    return "high";
  }
  return "moderate";
}

function summarize(state: DirectionState, response: DirectionResponse, strain: boolean) {
  if (state === "unknown") {
    return "A few more weeks of completed training before Direction is a fair reading.";
  }
  if (state === "declining") {
    return "Training stimulus and performance markers are easing.";
  }
  if (state === "maintaining") {
    return strain
      ? "Holding the level, at a high training cost."
      : "Enough work to hold the level, with little evidence of progression.";
  }
  if (response.status === "improving") {
    return strain
      ? "The programme is moving forward, at a high training cost."
      : "Training stimulus is progressing, and comparable performances are improving.";
  }
  return strain
    ? "Training stimulus is progressing, at a high training cost."
    : "Training stimulus is progressing and the mix is consistent.";
}

function performanceNote(state: DirectionState, response: DirectionResponse) {
  if (state === "unknown") {
    return null;
  }
  if (response.status === "unknown") {
    return "Limited comparable performance evidence.";
  }
  if (response.status === "improving") {
    return "Comparable performances are improving.";
  }
  if (response.status === "declining") {
    return "Comparable performances are slower.";
  }
  return "Comparable performances are flat.";
}

function trendWord(trend: "up" | "flat" | "down" | null) {
  if (trend === "up") {
    return "up";
  }
  if (trend === "down") {
    return "down";
  }
  if (trend === "flat") {
    return "stable";
  }
  return null;
}

function conclude(input: {
  state: DirectionState;
  score: number | null;
  strain: boolean;
  fitnessDelta: number | null;
  fatigueDelta: number | null;
  aerobicTrend: "up" | "flat" | "down" | null;
  specificTrend: "up" | "flat" | "down" | null;
  response: DirectionResponse;
}) {
  if (input.state === "unknown") {
    return "A few more weeks of completed training before Direction is a fair reading.";
  }
  const fitness =
    input.fitnessDelta != null && Math.abs(input.fitnessDelta) >= 0.8
      ? input.fitnessDelta > 0
        ? "Fitness was rising"
        : "Fitness was easing"
      : null;
  const fatigue =
    input.fatigueDelta != null && Math.abs(input.fatigueDelta) >= 1.2
      ? input.fatigueDelta < 0
        ? "accumulated fatigue fell"
        : "fatigue was climbing"
      : null;
  const despite: string[] = [];
  if (input.aerobicTrend === "down") {
    despite.push("lower aerobic consistency");
  }
  if (input.specificTrend === "down") {
    despite.push("less specific work");
  }
  if (input.response.status === "declining") {
    despite.push("slower comparable performances");
  }
  const firmly =
    input.score != null &&
    (input.score >= 35 || input.score <= -35 || (input.state === "maintaining" && Math.abs(input.score) <= 6));
  const nearBuilding = input.state === "maintaining" && input.score != null && input.score >= 8;
  const placement = nearBuilding
    ? "close to Building, still in"
    : firmly && input.state !== "maintaining"
      ? "firmly into"
      : "into";
  const drivers = [fitness, fatigue].filter(Boolean);
  let sentence =
    drivers.length === 2
      ? `${drivers[0]} while ${drivers[1]}`
      : drivers[0] ??
        (input.state === "maintaining"
          ? "There was enough work to hold the level"
          : "The mix of stimulus and cost");
  sentence += `, enough to put Direction ${placement} ${directionLabel(input.state)}`;
  if (despite.length > 0) {
    sentence += ` despite ${despite.join(" and ")}`;
  }
  if (input.strain) {
    sentence += ", at a high training cost";
  }
  return `${sentence}.`;
}

function rawAt(window: DirectionDay[], response: DirectionResponse) {
  const first = window[0];
  const last = window[window.length - 1];
  const aerobic = present(window.map((day) => day.aerobic_raw ?? day.aerobic_reserve));
  const specific = present(window.map((day) => day.specific_raw ?? day.specific_capacity));
  const aerobicRatio = trendRatio(aerobic);
  const specificRatio = trendRatio(specific);
  const loadRatio = trendRatio(weeklyLoad(window));

  const fitnessDelta =
    first.fitness != null && last.fitness != null ? last.fitness - first.fitness : null;
  const fatigueDelta =
    first.fatigue != null && last.fatigue != null ? last.fatigue - first.fatigue : null;
  const readinessDelta =
    first.potential != null && last.potential != null
      ? last.potential - first.potential
      : null;
  const form = last.form;

  const stimulus = clamp(
    clamp((fitnessDelta ?? 0) * 5, -36, 36) + clamp((loadRatio ?? 0) * 12, -12, 12),
    -40,
    40,
  );
  const aerobicPart = consistencyScore(aerobicRatio);
  const specificPart = consistencyScore(specificRatio);
  const responsePart = responseScore(response);
  const excess =
    fitnessDelta != null &&
    fatigueDelta != null &&
    fatigueDelta > 1.4 &&
    fatigueDelta > fitnessDelta + 1.1
      ? clamp((fatigueDelta - Math.max(fitnessDelta, 0)) * 2.4, 0, 30)
      : 0;
  const raw = clamp(stimulus + aerobicPart + specificPart + responsePart - excess, -100, 100);
  const strain =
    excess >= 14 && ((form != null && form <= -8) || (readinessDelta != null && readinessDelta <= -6));

  const aerobicTrend = trendOf(aerobicRatio);
  const specificTrend = trendOf(specificRatio);
  const signals: DirectionSignal[] = [];
  if (fitnessDelta != null && Math.abs(fitnessDelta) >= 0.8) {
    signals.push({ label: "Fitness", value: signed(fitnessDelta) });
  }
  const aerobicWord = trendWord(aerobicTrend);
  if (aerobicWord) {
    signals.push({ label: "Aerobic consistency", value: aerobicWord });
  }
  const specificWord = trendWord(specificTrend);
  if (specificWord) {
    signals.push({ label: "Specific work", value: specificWord });
  }
  if (fatigueDelta != null && Math.abs(fatigueDelta) >= 1.2) {
    signals.push({ label: "Fatigue", value: signed(fatigueDelta) });
  }

  return {
    raw,
    strain,
    signals,
    fitnessDelta,
    fatigueDelta,
    aerobicTrend,
    specificTrend,
  };
}

function readingFor(
  score: number | null,
  strain: boolean,
  signals: DirectionSignal[],
  windowDays: number,
  asOf: string | null,
  response: DirectionResponse,
  facts?: {
    fitnessDelta: number | null;
    fatigueDelta: number | null;
    aerobicTrend: "up" | "flat" | "down" | null;
    specificTrend: "up" | "flat" | "down" | null;
  },
): DirectionReading {
  const state = directionStateFromScore(score);
  const rounded = score == null ? null : Math.round(score);
  const confidence = decideConfidence(state, response, windowDays);
  const summary = summarize(state, response, strain);
  const note = performanceNote(state, response);
  const conclusion = conclude({
    state,
    score: rounded,
    strain,
    fitnessDelta: facts?.fitnessDelta ?? null,
    fatigueDelta: facts?.fatigueDelta ?? null,
    aerobicTrend: facts?.aerobicTrend ?? null,
    specificTrend: facts?.specificTrend ?? null,
    response,
  });
  const windowLabel = windowLabelFor(windowDays);
  const evidence = signals.map((signal) => `${signal.label} ${signal.value}`);
  return {
    state,
    label: directionLabel(state),
    score: rounded,
    strain,
    summary,
    conclusion,
    confidence,
    confidenceLabel: directionConfidenceLabel(confidence),
    performanceNote: note,
    explanation: [conclusion, directionConfidenceLabel(confidence), note].filter(Boolean).join(" "),
    evidence,
    signals,
    windowLabel,
    windowDays,
    asOf,
    trajectory: null,
    trajectoryLabel: null,
  };
}

function withTrajectory(series: DirectionReading[]): DirectionReading[] {
  return series.map((reading, index) => {
    if (reading.score == null || reading.state === "unknown") {
      return reading;
    }
    const target = index - DIRECTION_TRAJECTORY_DAYS;
    if (target < 0) {
      return reading;
    }
    let prior: number | null = null;
    for (let i = target; i >= Math.max(0, target - 7); i -= 1) {
      if (series[i].score != null) {
        prior = series[i].score;
        break;
      }
    }
    if (prior == null) {
      return reading;
    }
    const delta = reading.score - prior;
    const trajectory: DirectionTrajectory =
      delta >= DIRECTION_TRAJECTORY_DELTA ? "up" : delta <= -DIRECTION_TRAJECTORY_DELTA ? "down" : "flat";
    return {
      ...reading,
      trajectory,
      trajectoryLabel: directionTrajectoryLabel(trajectory),
    };
  });
}

export function inferDirectionSeries(
  days: DirectionDay[],
  today: string,
  attempts: RouteResponseAttempt[] = [],
  calibration?: DirectionCalibration | null,
): DirectionReading[] {
  const history = hydrateDirectionDays(days, calibration)
    .filter((day) => day.date <= today)
    .sort((left, right) => left.date.localeCompare(right.date));
  const alpha = 2 / (DIRECTION_SMOOTH_DAYS + 1);
  let smoothed: number | null = null;
  return withTrajectory(history.map((day, index) => {
    const window = history.slice(Math.max(0, index - DIRECTION_WINDOW_DAYS + 1), index + 1);
    const asOf = day.date;
    if (window.length < DIRECTION_MIN_DAYS) {
      return readingFor(null, false, [], window.length, asOf, {
        status: "unknown",
        evidence: null,
      });
    }
    const response = observeRouteResponse(attempts, asOf);
    const { raw, strain, signals, fitnessDelta, fatigueDelta, aerobicTrend, specificTrend } =
      rawAt(window, response);
    smoothed = smoothed == null ? raw : alpha * raw + (1 - alpha) * smoothed;
    return readingFor(smoothed, strain, signals, window.length, asOf, response, {
      fitnessDelta,
      fatigueDelta,
      aerobicTrend,
      specificTrend,
    });
  }));
}

export function inferDirection(
  days: DirectionDay[],
  today: string,
  attempts: RouteResponseAttempt[] = [],
  calibration?: DirectionCalibration | null,
): DirectionReading {
  const series = inferDirectionSeries(days, today, attempts, calibration);
  return (
    series.at(-1) ??
    readingFor(null, false, [], 0, null, { status: "unknown", evidence: null })
  );
}

export function directionTone(state: DirectionState | null, strain = false) {
  if (strain || state === "declining") {
    return "text-ember";
  }
  if (state === "building") {
    return "text-forest";
  }
  return "text-ink";
}

export function directionConfidenceOpacity(confidence: DirectionConfidence) {
  if (confidence === "high") {
    return 1;
  }
  if (confidence === "moderate") {
    return 0.72;
  }
  return 0.42;
}
