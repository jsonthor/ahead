export const MIN_OVERNIGHT_SLEEP_MINUTES = 120;
export const MAX_OVERNIGHT_SLEEP_MINUTES = 16 * 60;
export const RECOVERY_TYPICAL_DAYS = 28;
export const RECOVERY_TYPICAL_MIN_SAMPLES = 7;

export type RecoveryObservation = {
  date: string;
  resting_hr: number | null;
  sleep_hrv_ms: number | null;
  sleep_minutes: number | null;
  sleep_score: number | null;
  stress_avg: number | null;
};

function sleepMinutesFrom(value: number): number | null {
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  if (value <= 24) {
    return Math.round(value * 60);
  }
  if (value <= 24 * 60) {
    return Math.round(value);
  }
  if (value <= 24 * 3600) {
    return Math.round(value / 60);
  }
  return null;
}

export function overnightSleepMinutes(value: number | null | undefined): number | null {
  if (value == null) {
    return null;
  }
  const minutes = sleepMinutesFrom(value);
  return minutes != null &&
    minutes >= MIN_OVERNIGHT_SLEEP_MINUTES &&
    minutes <= MAX_OVERNIGHT_SLEEP_MINUTES
    ? minutes
    : null;
}

export function formatSleepClock(minutes: number | null | undefined): string | null {
  const overnight = overnightSleepMinutes(minutes);
  if (overnight == null) {
    return null;
  }
  const hours = Math.floor(overnight / 60);
  const rest = overnight % 60;
  if (rest === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${rest}m`;
}

export function formatHrv(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }
  return String(Math.round(value));
}

export function formatRestingHr(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }
  return String(Math.round(value));
}

export function formatStress(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }
  return String(Math.round(value));
}

export function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const ranked = [...values].sort((left, right) => left - right);
  const mid = Math.floor(ranked.length / 2);
  if (ranked.length % 2 === 0) {
    return (ranked[mid - 1] + ranked[mid]) / 2;
  }
  return ranked[mid];
}

export type RangeStatus = "in" | "below" | "above";

export type RecoveryRange = {
  status: RangeStatus;
  low: number;
  high: number;
};

function percentile(ranked: number[], p: number) {
  const index = (ranked.length - 1) * p;
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  if (lo === hi) {
    return ranked[lo];
  }
  return ranked[lo] + (ranked[hi] - ranked[lo]) * (index - lo);
}

export function recoveryRange(
  rows: RecoveryObservation[],
  before: string,
  read: (row: RecoveryObservation) => number | null,
  value: number | null | undefined,
  minSpan: number,
): RecoveryRange | null {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }
  const from = rows.filter((row) => row.date < before).slice(-RECOVERY_TYPICAL_DAYS);
  const values = from.map(read).filter((entry): entry is number => entry != null);
  if (values.length < RECOVERY_TYPICAL_MIN_SAMPLES) {
    return null;
  }
  const ranked = [...values].sort((left, right) => left - right);
  let low = percentile(ranked, 0.25);
  let high = percentile(ranked, 0.75);
  if (high - low < minSpan) {
    const mid = median(ranked);
    if (mid == null) {
      return null;
    }
    low = mid - minSpan / 2;
    high = mid + minSpan / 2;
  }
  return {
    status: value < low ? "below" : value > high ? "above" : "in",
    low,
    high,
  };
}

export function rangeFavorable(status: RangeStatus, better: "higher" | "lower") {
  return (
    status === "in" ||
    (status === "below" && better === "lower") ||
    (status === "above" && better === "higher")
  );
}

export function hasRecoverySignal(row: RecoveryObservation) {
  return (
    overnightSleepMinutes(row.sleep_minutes) != null ||
    row.sleep_hrv_ms != null ||
    row.resting_hr != null ||
    row.stress_avg != null
  );
}
