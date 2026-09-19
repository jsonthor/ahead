/**
 * Performance — one daily state, two views. Keep in step with
 * src/lib/load/performance.ts.
 */

const PERFORMANCE_SLOW_TAU = 24;
const PERFORMANCE_TREND_DAYS = 28;
const PERFORMANCE_MOVE_DAYS = 7;
const PERFORMANCE_MIN_DAYS = 28;
const PERFORMANCE_BUILDING_MIN = 4;
const PERFORMANCE_DECLINING_MAX = -4;
const PERFORMANCE_CAPACITY_FALL = -1;
const AEROBIC_WEIGHT = 0.65;
const SPECIFIC_WEIGHT = 0.35;

export type PerformanceState = "building" | "maintaining" | "declining" | "unknown";
export type PerformanceRecent = "up" | "down" | "flat";

export type PerformanceDayInput = {
  date: string;
  potential: number | null;
  aerobic_reserve?: number | null;
  specific_capacity?: number | null;
};

export type PerformanceReading = {
  asOf: string | null;
  score: number | null;
  delta: number | null;
  state: PerformanceState;
  label: string;
  trend: number | null;
  capacityDelta: number | null;
  recent: PerformanceRecent | null;
  recentLabel: string | null;
  summary: string;
  guarded: boolean;
};

type PerformancePoint = {
  date: string;
  score: number;
  displayed: number;
  slow: number;
  capacity: number | null;
};

const LABELS: Record<PerformanceState, string> = {
  building: "Building",
  maintaining: "Maintaining",
  declining: "Declining",
  unknown: "Unknown",
};

function addDaysToKey(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

function alpha(tau: number) {
  return 1 - Math.exp(-1 / tau);
}

function displayPotential(value: number) {
  return Math.round(value);
}

function capacityScore(aerobic: number | null | undefined, specific: number | null | undefined) {
  if (aerobic == null || specific == null) {
    return null;
  }
  return (AEROBIC_WEIGHT * (aerobic / 100) + SPECIFIC_WEIGHT * (specific / 100)) * 100;
}

function inferPerformanceSeries(days: PerformanceDayInput[]): PerformancePoint[] {
  const sorted = [...days]
    .filter((day) => day.potential != null)
    .sort((left, right) => left.date.localeCompare(right.date));
  let slow: number | null = null;
  return sorted.map((day) => {
    const score = day.potential as number;
    slow = slow == null ? score : slow + alpha(PERFORMANCE_SLOW_TAU) * (score - slow);
    return {
      date: day.date,
      score,
      displayed: displayPotential(score),
      slow,
      capacity: capacityScore(day.aerobic_reserve, day.specific_capacity),
    };
  });
}

function nearestOnOrBefore(points: PerformancePoint[], date: string) {
  return [...points].reverse().find((point) => point.date <= date) ?? null;
}

function recentOf(delta: number | null): PerformanceRecent | null {
  if (delta == null || delta === 0) {
    return delta === 0 ? "flat" : null;
  }
  return delta > 0 ? "up" : "down";
}

function recentLabelOf(recent: PerformanceRecent | null) {
  if (recent === "up") {
    return "trending up";
  }
  if (recent === "down") {
    return "trending down";
  }
  return null;
}

function levelClause(score: number) {
  if (score >= 60) {
    return "above your usual level";
  }
  if (score <= 40) {
    return "below your usual level";
  }
  return "around your usual level";
}

function capitalize(value: string) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function summarize(reading: {
  state: PerformanceState;
  score: number | null;
  recent: PerformanceRecent | null;
  guarded: boolean;
}) {
  if (reading.state === "unknown" || reading.score == null) {
    return "A few more weeks of completed training before Performance can be read.";
  }
  const level = levelClause(reading.score);
  if (reading.guarded) {
    return `More available recently, but built capacity is not rising. ${capitalize(level)}.`;
  }
  if (reading.state === "building") {
    return `Your training state is ${level} and improving.`;
  }
  if (reading.state === "declining") {
    return `Your training state is ${level} and has been easing.`;
  }
  if (reading.recent === "up") {
    return `${capitalize(level)} and improving recently.`;
  }
  if (reading.recent === "down") {
    return `${capitalize(level)}, easing this week.`;
  }
  return `Your training state is ${level} and holding.`;
}

export function inferPerformance(days: PerformanceDayInput[], asOf: string): PerformanceReading {
  const series = inferPerformanceSeries(days.filter((day) => day.date <= asOf));
  const latest = nearestOnOrBefore(series, asOf);
  if (!latest) {
    return {
      asOf: null,
      score: null,
      delta: null,
      state: "unknown",
      label: LABELS.unknown,
      trend: null,
      capacityDelta: null,
      recent: null,
      recentLabel: null,
      summary: summarize({ state: "unknown", score: null, recent: null, guarded: false }),
      guarded: false,
    };
  }

  const weekAgo = nearestOnOrBefore(series, addDaysToKey(latest.date, -PERFORMANCE_MOVE_DAYS));
  const delta = weekAgo ? latest.displayed - weekAgo.displayed : null;
  const recent = recentOf(delta);
  const prior = nearestOnOrBefore(series, addDaysToKey(latest.date, -PERFORMANCE_TREND_DAYS));
  const enough = series.length >= PERFORMANCE_MIN_DAYS && prior != null && prior.date < latest.date;
  const trend = enough ? latest.slow - prior.slow : null;
  const capacityDelta =
    enough && latest.capacity != null && prior?.capacity != null
      ? latest.capacity - prior.capacity
      : null;

  let state: PerformanceState = "unknown";
  let guarded = false;
  if (trend != null) {
    if (trend <= PERFORMANCE_DECLINING_MAX) {
      state = "declining";
    } else if (trend >= PERFORMANCE_BUILDING_MIN) {
      if (capacityDelta != null && capacityDelta <= PERFORMANCE_CAPACITY_FALL) {
        state = "maintaining";
        guarded = true;
      } else {
        state = "building";
      }
    } else {
      state = "maintaining";
    }
  }

  return {
    asOf: latest.date,
    score: latest.displayed,
    delta,
    trend: trend == null ? null : Math.round(trend * 10) / 10,
    capacityDelta: capacityDelta == null ? null : Math.round(capacityDelta * 10) / 10,
    state,
    label: LABELS[state],
    recent,
    recentLabel: recentLabelOf(recent),
    summary: summarize({ state, score: latest.displayed, recent, guarded }),
    guarded,
  };
}
