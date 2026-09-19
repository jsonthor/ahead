/**
 * Potential v0.7 — how much of the capacity already built is currently
 * expressible, on a 0–100 athlete-relative scale.
 *
 * Shown as Performance. Not freshness (Fatigue), not race result.
 * Built from Potential mix + load. FIT/streams are not required.
 * Calibration is frozen to that mix; bump POTENTIAL_VERSION when mix
 * inputs change (HR zone model) so stale 0–100 scales are discarded.
 */

export const AEROBIC_TAU = 42;
export const SPECIFIC_TAU = 18;
export const ACUTE_TAU = 8;
export const ACCUSTOMED_TAU = 28;
export const POTENTIAL_VERSION = "potential-v0.7";
export const OTHER_AEROBIC_WEIGHT = 0.2;
export const AEROBIC_FROM_SPECIFIC = 0.35;
export const SPECIFIC_FROM_TEMPO = 0.8;
export const SPECIFIC_FROM_Z5 = 1.8;
export const FATIGUE_PENALTY = 0.38;
export const AEROBIC_WEIGHT = 0.65;
export const SPECIFIC_WEIGHT = 0.35;

export type PotentialCalibration = {
  version: typeof POTENTIAL_VERSION;
  frozen_at: string;
  aerobic_low: number;
  aerobic_high: number;
  specific_low: number;
  specific_high: number;
  potential_low: number;
  potential_high: number;
};

export type DailyPotential = {
  date: string;
  aerobic_raw: number;
  specific_raw: number;
  acute_load: number;
  acc_load: number;
  aerobic_reserve: number;
  specific_capacity: number;
  acute_fatigue: number;
  capacity: number;
  potential: number;
};

export type PotentialDayInput = {
  date: string;
  cyclingZ12Hours: number;
  cyclingZ34Hours: number;
  cyclingZ5Hours: number;
  otherAerobicHours: number;
  load: number;
  recoveryDelta?: number;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

export function alpha(tau: number) {
  return 1 - Math.exp(-1 / tau);
}

export function ewmaStep(previous: number | null, incoming: number, tau: number) {
  if (previous == null) {
    return incoming;
  }
  return previous + alpha(tau) * (incoming - previous);
}

export function effectiveZ5(hours: number) {
  const z5 = Math.max(0, hours);
  return Math.min(z5, 1) + 0.3 * Math.max(z5 - 1, 0);
}

export function dayInputs(day: PotentialDayInput) {
  const z12 = Math.max(0, day.cyclingZ12Hours);
  const z34 = Math.max(0, day.cyclingZ34Hours);
  const z5 = effectiveZ5(day.cyclingZ5Hours);
  const other = Math.max(0, day.otherAerobicHours);
  return {
    aerobic: z12 + AEROBIC_FROM_SPECIFIC * z34 + OTHER_AEROBIC_WEIGHT * other,
    specific: SPECIFIC_FROM_TEMPO * z34 + SPECIFIC_FROM_Z5 * z5,
    load: Math.max(0, day.load),
  };
}

function percentile(values: number[], p: number) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  if (low === high) {
    return sorted[low];
  }
  return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}

function median(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function padRange(low: number, high: number, minSpan: number) {
  if (high - low >= minSpan) {
    return { low, high };
  }
  const mid = (low + high) / 2;
  return { low: mid - minSpan / 2, high: mid + minSpan / 2 };
}

export function mapToHundred(value: number, low: number, high: number) {
  if (high <= low) {
    return 50;
  }
  return clamp((100 * (value - low)) / (high - low));
}

export function unmapFromHundred(score: number, low: number, high: number) {
  return low + (clamp(score) / 100) * (high - low);
}

export function strainScore(acuteLoad: number, accLoad: number) {
  if (accLoad < 1) {
    return 50;
  }
  return clamp(50 * (acuteLoad / accLoad));
}

export function capacityOf(aerobic: number, specific: number) {
  return AEROBIC_WEIGHT * (aerobic / 100) + SPECIFIC_WEIGHT * (specific / 100);
}

export function rawPotentialOf(capacity: number, fatigue: number) {
  return Math.max(0, capacity - FATIGUE_PENALTY * (fatigue / 100));
}

export function scoreDisplayedPotential(
  rawPotential: number,
  low: number,
  high: number,
) {
  return mapToHundred(rawPotential, low, high);
}

/** Integer shown on Today / History. Must match SQL ai_displayed_daily_state. */
export function displayPotential(value: number) {
  return Math.round(value);
}

export function fatigueBand(fatigue: number) {
  if (fatigue < 25) {
    return "exceptionally fresh";
  }
  if (fatigue < 40) {
    return "fresh";
  }
  if (fatigue < 60) {
    return "normal";
  }
  if (fatigue < 75) {
    return "carrying";
  }
  if (fatigue < 90) {
    return "high";
  }
  return "unusually high";
}

function isSunday(date: string) {
  return new Date(`${date}T12:00:00.000Z`).getUTCDay() === 0;
}

export function isPotentialCalibration(value: unknown): value is PotentialCalibration {
  if (!value || typeof value !== "object") {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    row.version === POTENTIAL_VERSION &&
    typeof row.aerobic_low === "number" &&
    typeof row.aerobic_high === "number" &&
    typeof row.specific_low === "number" &&
    typeof row.specific_high === "number" &&
    typeof row.potential_low === "number" &&
    typeof row.potential_high === "number"
  );
}

function sampleDays<T extends { date: string }>(rows: T[]) {
  const sundays = rows.filter((row) => isSunday(row.date));
  return sundays.length > 0 ? sundays : rows;
}

export function buildCalibration(
  raw: { date: string; aerobic: number; specific: number }[],
  frozenAt: string,
): PotentialCalibration {
  const warmed = raw.length > AEROBIC_TAU ? raw.slice(AEROBIC_TAU) : raw;
  const sample = sampleDays(warmed);
  const aerobicValues = sample.map((row) => row.aerobic);
  const specificValues = sample.map((row) => row.specific);
  const aerobic = padRange(
    percentile(aerobicValues, 0.1),
    percentile(aerobicValues, 0.9),
    Math.max(0.35, 1.35 * median(aerobicValues)),
  );
  const specific = padRange(
    percentile(specificValues, 0.1),
    percentile(specificValues, 0.9),
    Math.max(0.2, 1.1 * median(specificValues)),
  );
  const capacities = sample.map((row) =>
    capacityOf(
      mapToHundred(row.aerobic, aerobic.low, aerobic.high),
      mapToHundred(row.specific, specific.low, specific.high),
    ),
  );
  const potential = padRange(
    percentile(capacities, 0.05),
    percentile(capacities, 0.95),
    0.08,
  );
  return {
    version: POTENTIAL_VERSION,
    frozen_at: frozenAt,
    aerobic_low: aerobic.low,
    aerobic_high: aerobic.high,
    specific_low: specific.low,
    specific_high: specific.high,
    potential_low: potential.low,
    potential_high: potential.high,
  };
}

function scoreDay(
  date: string,
  aerobicRaw: number,
  specificRaw: number,
  acuteLoad: number,
  accLoad: number,
  recoveryDelta: number,
  calibration: PotentialCalibration,
): DailyPotential {
  const aerobic_reserve = mapToHundred(
    aerobicRaw,
    calibration.aerobic_low,
    calibration.aerobic_high,
  );
  const specific_capacity = mapToHundred(
    specificRaw,
    calibration.specific_low,
    calibration.specific_high,
  );
  const acute_fatigue = clamp(strainScore(acuteLoad, accLoad) + recoveryDelta);
  const capacity = capacityOf(aerobic_reserve, specific_capacity);
  return {
    date,
    aerobic_raw: aerobicRaw,
    specific_raw: specificRaw,
    acute_load: acuteLoad,
    acc_load: accLoad,
    aerobic_reserve,
    specific_capacity,
    acute_fatigue,
    capacity,
    potential: scoreDisplayedPotential(
      rawPotentialOf(capacity, acute_fatigue),
      calibration.potential_low,
      calibration.potential_high,
    ),
  };
}

export function calculatePotentialSeries(
  days: PotentialDayInput[],
  existing?: PotentialCalibration | null,
): { series: DailyPotential[]; calibration: PotentialCalibration; freeze: boolean } {
  let aerobic: number | null = null;
  let specific: number | null = null;
  let acute: number | null = null;
  let acc: number | null = null;
  const raw = days.map((day) => {
    const input = dayInputs(day);
    const nextAerobic = ewmaStep(aerobic, input.aerobic, AEROBIC_TAU);
    const nextSpecific = ewmaStep(specific, input.specific, SPECIFIC_TAU);
    const nextAcute = ewmaStep(acute, input.load, ACUTE_TAU);
    const nextAcc = ewmaStep(acc, input.load, ACCUSTOMED_TAU);
    aerobic = nextAerobic;
    specific = nextSpecific;
    acute = nextAcute;
    acc = nextAcc;
    return {
      date: day.date,
      aerobic: nextAerobic,
      specific: nextSpecific,
      acute: nextAcute,
      acc: nextAcc,
      recoveryDelta: day.recoveryDelta ?? 0,
    };
  });
  const freeze = !existing && raw.length >= 42;
  const calibration =
    existing ??
    buildCalibration(
      raw,
      days[days.length - 1]?.date ?? new Date().toISOString().slice(0, 10),
    );
  const series = raw.map((row) =>
    scoreDay(
      row.date,
      row.aerobic,
      row.specific,
      row.acute,
      row.acc,
      row.recoveryDelta,
      calibration,
    ),
  );
  return { series, calibration, freeze };
}

export function forecastPotential(
  last: DailyPotential,
  dates: string[],
  calibration?: PotentialCalibration | null,
): DailyPotential[] {
  let aerobic = last.aerobic_raw;
  let specific = last.specific_raw;
  let acute = last.acute_load;
  let acc = last.acc_load;
  if ((aerobic === 0 && specific === 0) && calibration) {
    aerobic = unmapFromHundred(last.aerobic_reserve, calibration.aerobic_low, calibration.aerobic_high);
    specific = unmapFromHundred(
      last.specific_capacity,
      calibration.specific_low,
      calibration.specific_high,
    );
  }
  if (acute === 0 && acc === 0) {
    const strain = Math.max(last.acute_fatigue / 50, 0.01);
    acc = 20;
    acute = strain * acc;
  }
  const anchors = calibration ?? {
    version: POTENTIAL_VERSION,
    frozen_at: last.date,
    aerobic_low: 0,
    aerobic_high: Math.max(aerobic, 1),
    specific_low: 0,
    specific_high: Math.max(specific, 1),
    potential_low: 0,
    potential_high: 1,
  };
  return dates.map((date) => {
    aerobic = ewmaStep(aerobic, 0, AEROBIC_TAU);
    specific = ewmaStep(specific, 0, SPECIFIC_TAU);
    acute = ewmaStep(acute, 0, ACUTE_TAU);
    acc = ewmaStep(acc, 0, ACCUSTOMED_TAU);
    return scoreDay(date, aerobic, specific, acute, acc, 0, anchors);
  });
}

function recoverySignal(recent: number, baseline: number, higherIsBetter: boolean) {
  if (!Number.isFinite(recent) || !Number.isFinite(baseline) || baseline <= 0) {
    return null;
  }
  if (recent < 0) {
    return null;
  }
  if (recent === 0 && higherIsBetter) {
    return null;
  }
  const change = recent / baseline - 1;
  const directed = higherIsBetter ? change : -change;
  return clamp(directed / 0.12, -1, 1);
}

export type RecoveryObservation = {
  resting_hr: number | null;
  sleep_minutes: number | null;
  hrv_ms: number | null;
  stress: number | null;
};

export function recoveryDelta(
  date: string,
  byDate: Map<string, RecoveryObservation>,
  addDays: (key: string, days: number) => string,
) {
  function collect(
    days: number,
    read: (row: RecoveryObservation) => number | null,
    ok: (value: number) => boolean,
  ) {
    const values: number[] = [];
    for (let offset = 0; offset < days; offset += 1) {
      const row = byDate.get(addDays(date, -offset));
      const value = row ? read(row) : null;
      if (value != null && ok(value)) {
        values.push(value);
      }
    }
    return values.length === 0 ? null : median(values);
  }

  const weighted: { signal: number; weight: number }[] = [];
  const hrvRecent = collect(7, (row) => row.hrv_ms, (value) => value > 0);
  const hrvBase = collect(28, (row) => row.hrv_ms, (value) => value > 0);
  if (hrvRecent != null && hrvBase != null) {
    const signal = recoverySignal(hrvRecent, hrvBase, true);
    if (signal != null) {
      weighted.push({ signal, weight: 1 });
    }
  }
  const hrRecent = collect(7, (row) => row.resting_hr, (value) => value > 30);
  const hrBase = collect(28, (row) => row.resting_hr, (value) => value > 30);
  if (hrRecent != null && hrBase != null) {
    const signal = recoverySignal(hrRecent, hrBase, false);
    if (signal != null) {
      weighted.push({ signal, weight: 1 });
    }
  }
  const sleepRecent = collect(7, (row) => row.sleep_minutes, (value) => value >= 120);
  const sleepBase = collect(28, (row) => row.sleep_minutes, (value) => value >= 120);
  if (sleepRecent != null && sleepBase != null) {
    const signal = recoverySignal(sleepRecent, sleepBase, true);
    if (signal != null) {
      weighted.push({ signal, weight: 0.7 });
    }
  }
  const stressRecent = collect(7, (row) => row.stress, (value) => value >= 0);
  const stressBase = collect(28, (row) => row.stress, (value) => value >= 0);
  if (stressRecent != null && stressBase != null) {
    const signal = recoverySignal(stressRecent, stressBase, false);
    if (signal != null) {
      weighted.push({ signal, weight: 0.7 });
    }
  }
  if (weighted.length === 0) {
    return 0;
  }
  const combined =
    weighted.reduce((sum, row) => sum + row.signal * row.weight, 0) /
    weighted.reduce((sum, row) => sum + row.weight, 0);
  return clamp(-20 * combined, -20, 20);
}
