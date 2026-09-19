/**
 * Performance — one daily state, two views.
 *
 * Today's score is the existing Readiness number (capacity − strain,
 * mapped 0–100 against this athlete). The band is a slow trend of that
 * same series, not a second model. Building is vetoed if underlying
 * capacity is falling (availability returning is not Building).
 */

import { addDaysToKey } from "@/lib/calendar";
import { alpha, capacityOf, displayPotential } from "@/lib/load/potential";

export const PERFORMANCE_SLOW_TAU = 24;
export const PERFORMANCE_TREND_DAYS = 28;
export const PERFORMANCE_MOVE_DAYS = 7;
export const PERFORMANCE_MIN_DAYS = 28;
export const PERFORMANCE_HISTORY_DAYS = 90;
export const PERFORMANCE_BUILDING_MIN = 4;
export const PERFORMANCE_DECLINING_MAX = -4;
export const PERFORMANCE_CAPACITY_FALL = -1;
export const PERFORMANCE_VERSION = "performance-v1";

export const PERFORMANCE_STATES = ["building", "maintaining", "declining", "unknown"] as const;

export type PerformanceState = (typeof PERFORMANCE_STATES)[number];
export type PerformanceRecent = "up" | "down" | "flat";

export type PerformanceDayInput = {
  date: string;
  potential: number | null;
  aerobic_reserve?: number | null;
  specific_capacity?: number | null;
};

export type PerformancePoint = {
  date: string;
  score: number;
  displayed: number;
  slow: number;
  capacity: number | null;
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

const LABELS: Record<PerformanceState, string> = {
  building: "Building",
  maintaining: "Maintaining",
  declining: "Declining",
  unknown: "Unknown",
};

export function performanceLabel(state: PerformanceState | null) {
  return state ? LABELS[state] : LABELS.unknown;
}

export function performanceTone(state: PerformanceState | null) {
  if (state === "declining") {
    return "text-ember";
  }
  if (state === "building") {
    return "text-forest";
  }
  return "text-ink";
}

export function capacityScore(aerobic: number | null | undefined, specific: number | null | undefined) {
  if (aerobic == null || specific == null) {
    return null;
  }
  return capacityOf(aerobic, specific) * 100;
}

export function inferPerformanceSeries(days: PerformanceDayInput[]): PerformancePoint[] {
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

function capitalize(value: string) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
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
    state,
    label: LABELS[state],
    trend: trend == null ? null : Math.round(trend * 10) / 10,
    capacityDelta: capacityDelta == null ? null : Math.round(capacityDelta * 10) / 10,
    recent,
    recentLabel: recentLabelOf(recent),
    summary: summarize({ state, score: latest.displayed, recent, guarded }),
    guarded,
  };
}

export function componentWord(delta: number | null, displayed?: number | null, threshold = 2) {
  if (displayed != null && displayed >= 100 && (delta == null || delta >= 0)) {
    return "At top of range";
  }
  if (displayed != null && displayed <= 0 && (delta == null || delta <= 0)) {
    return "At bottom of range";
  }
  if (delta == null) {
    return null;
  }
  if (delta >= threshold) {
    return "Rising";
  }
  if (delta <= -threshold) {
    return "Easing";
  }
  return "Stable";
}

export function strainWord(acuteFatigue: number | null | undefined) {
  if (acuteFatigue == null) {
    return null;
  }
  if (acuteFatigue < 40) {
    return "Low";
  }
  if (acuteFatigue < 70) {
    return "Typical";
  }
  return "High";
}

export function performanceWhyLine(input: {
  aerobic: string | null;
  specific: string | null;
  strain: string | null;
}) {
  const strain = (input.strain ?? "typical").toLowerCase();
  const strainClause =
    strain === "typical"
      ? "while strain remains typical"
      : strain === "low"
        ? "while strain stays low"
        : "under high strain";
  const rising = (word: string | null) => word === "Rising" || word === "At top of range";
  const easing = (word: string | null) => word === "Easing" || word === "At bottom of range";
  if (
    (rising(input.aerobic) || rising(input.specific)) &&
    !easing(input.aerobic) &&
    !easing(input.specific)
  ) {
    return `Capacity is rising ${strainClause}.`;
  }
  if (easing(input.aerobic) && easing(input.specific)) {
    return `Capacity is easing ${strainClause}.`;
  }
  if (easing(input.aerobic) && !rising(input.specific)) {
    return `Aerobic capacity is easing ${strainClause}.`;
  }
  if (easing(input.specific) && !rising(input.aerobic)) {
    return `Specific capacity is easing ${strainClause}.`;
  }
  if (rising(input.aerobic) && easing(input.specific)) {
    return `Aerobic capacity is rising while specific capacity eases, ${strainClause}.`;
  }
  if (rising(input.specific) && easing(input.aerobic)) {
    return `Specific capacity is rising while aerobic capacity eases, ${strainClause}.`;
  }
  return `Capacity is holding ${strainClause}.`;
}
