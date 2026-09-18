export type RouteAttempt = {
  activityId: string;
  startedAt: string;
  durationSeconds: number | null;
  movingSeconds: number | null;
  elapsedSeconds: number | null;
  distanceM: number | null;
  avgHr: number | null;
  avgSpeedMps: number | null;
  overlap: number | null;
};

export type RouteComparability = {
  caution: boolean;
  reasons: string[];
};

const SIMILAR_HR_BPM = 5;
const LONG_STOP_SECONDS = 180;
const MARGINAL_OVERLAP = 0.92;

function median(values: number[]) {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
  }
  return sorted[mid] ?? null;
}

function speedOf(attempt: RouteAttempt) {
  if (attempt.avgSpeedMps && attempt.avgSpeedMps > 0) {
    return attempt.avgSpeedMps;
  }
  const seconds = attempt.movingSeconds ?? attempt.durationSeconds;
  if (attempt.distanceM && seconds && seconds > 0) {
    return attempt.distanceM / seconds;
  }
  return null;
}

function timeOf(attempt: RouteAttempt) {
  return attempt.movingSeconds ?? attempt.durationSeconds;
}

function stoppedSeconds(attempt: RouteAttempt) {
  const elapsed = attempt.elapsedSeconds ?? attempt.durationSeconds;
  const moving = attempt.movingSeconds ?? attempt.durationSeconds;
  if (elapsed == null || moving == null) {
    return 0;
  }
  return Math.max(0, elapsed - moving);
}

export function comparabilityOf(attempt: RouteAttempt, typicalDistanceM: number | null): RouteComparability {
  const reasons: string[] = [];
  if (stoppedSeconds(attempt) >= LONG_STOP_SECONDS) {
    reasons.push("long stopped time");
  }
  if (attempt.avgHr == null) {
    reasons.push("missing heart rate");
  }
  if (
    typicalDistanceM &&
    attempt.distanceM &&
    Math.abs(attempt.distanceM - typicalDistanceM) / typicalDistanceM > 0.05
  ) {
    reasons.push("distance unusually different");
  }
  if (attempt.overlap != null && attempt.overlap < MARGINAL_OVERLAP) {
    reasons.push("route match only just above threshold");
  }
  return { caution: reasons.length > 0, reasons };
}

export function routeComparison(input: {
  current: RouteAttempt;
  attempts: RouteAttempt[];
  typicalDistanceM: number | null;
}) {
  const others = input.attempts.filter((attempt) => attempt.activityId !== input.current.activityId);
  if (others.length === 0) {
    return null;
  }
  const typicalTime = median(others.map(timeOf).filter((value): value is number => value != null && value > 0));
  const typicalHr = median(others.map((attempt) => attempt.avgHr).filter((value): value is number => value != null));
  const typicalSpeed = median(
    others.map(speedOf).filter((value): value is number => value != null && value > 0),
  );
  const currentTime = timeOf(input.current);
  const currentSpeed = speedOf(input.current);
  const similarHr = others.filter(
    (attempt) =>
      input.current.avgHr != null &&
      attempt.avgHr != null &&
      Math.abs(attempt.avgHr - input.current.avgHr) <= SIMILAR_HR_BPM,
  );
  const similarMedianSpeed = median(
    similarHr.map(speedOf).filter((value): value is number => value != null && value > 0),
  );
  const similarFasterPct =
    currentSpeed && similarMedianSpeed
      ? Math.round(((currentSpeed - similarMedianSpeed) / similarMedianSpeed) * 1000) / 10
      : null;

  return {
    attemptCount: others.length + 1,
    typical: {
      timeSeconds: typicalTime,
      avgHr: typicalHr != null ? Math.round(typicalHr) : null,
      speedMps: typicalSpeed,
    },
    current: {
      timeSeconds: currentTime,
      avgHr: input.current.avgHr,
      speedMps: currentSpeed,
    },
    timeDeltaSeconds:
      typicalTime != null && currentTime != null ? typicalTime - currentTime : null,
    hrDelta:
      typicalHr != null && input.current.avgHr != null
        ? input.current.avgHr - Math.round(typicalHr)
        : null,
    similarHr:
      similarHr.length >= 3 && similarFasterPct != null
        ? { count: similarHr.length, fasterPct: similarFasterPct }
        : null,
    comparability: comparabilityOf(input.current, input.typicalDistanceM),
  };
}

export function formatSignedDuration(seconds: number) {
  const abs = Math.abs(Math.round(seconds));
  const minutes = Math.floor(abs / 60);
  const rest = abs % 60;
  const clock = minutes > 0 ? `${minutes}:${String(rest).padStart(2, "0")}` : `${rest}s`;
  if (seconds > 0) {
    return `${clock} faster`;
  }
  if (seconds < 0) {
    return `${clock} slower`;
  }
  return "same time";
}

export function formatSignedHr(delta: number) {
  if (delta === 0) {
    return "same heart rate";
  }
  const abs = Math.abs(delta);
  return delta < 0 ? `${abs} bpm lower` : `${abs} bpm higher`;
}
