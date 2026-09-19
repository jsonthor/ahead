import type { StreamPoint } from "@/lib/fit/parse";
import type { HrModelConfidence } from "@/lib/hr-model/types";

export type SustainedPeak = {
  date: string;
  peak: number;
};

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length === 0) {
    return null;
  }
  if (sorted.length % 2 === 0) {
    return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
  }
  return sorted[mid] ?? null;
}

export function maxRollingMedian(points: StreamPoint[], windowSeconds = 10) {
  const samples = points
    .map((point) => ({ t: point.t, hr: point.hr }))
    .filter((point): point is { t: number; hr: number } => point.hr != null && point.hr >= 40);
  if (samples.length < 5) {
    return null;
  }
  let peak: number | null = null;
  let start = 0;
  const window: number[] = [];
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    window.push(sample.hr);
    while (start < index && sample.t - samples[start].t > windowSeconds) {
      window.shift();
      start += 1;
    }
    if (window.length < 3) {
      continue;
    }
    const value = median(window);
    if (value != null && (peak == null || value > peak)) {
      peak = value;
    }
  }
  return peak == null ? null : Math.round(peak);
}

export function isPlausibleHrMax(value: number | null | undefined) {
  return typeof value === "number" && value >= 140 && value <= 220;
}

export function isArtefactPeak(peak: number) {
  return peak < 120 || peak > 220;
}

export function deriveObservedHrMax(peaks: SustainedPeak[]) {
  const clean = peaks.filter((row) => !isArtefactPeak(row.peak));
  if (clean.length === 0) {
    return null;
  }
  const hrMax = Math.max(...clean.map((row) => row.peak));
  const supporters = clean.filter((row) => hrMax - row.peak <= 5);
  const isolated = supporters.length === 1 && clean.length >= 2;
  const confidence: HrModelConfidence =
    supporters.length >= 3 ? "high" : isolated || supporters.length === 1 ? "low" : "moderate";
  const dated = clean.slice().sort((left, right) => left.date.localeCompare(right.date));
  return {
    hrMax,
    confidence,
    validFrom: dated[0]?.date ?? clean[0]!.date,
    supportingSessions: supporters.length,
  };
}

export function providerContradictedByObserved(
  providerHrMax: number,
  observedHrMax: number | null,
) {
  return observedHrMax != null && observedHrMax >= providerHrMax + 8;
}

export function maxTimeWeightedMean(
  points: StreamPoint[],
  windowSeconds: number,
  minCoverage = 0.8,
) {
  const samples = points
    .map((point) => ({ t: point.t, hr: point.hr }))
    .filter(
      (point): point is { t: number; hr: number } =>
        point.hr != null && point.hr >= 40 && point.hr <= 220,
    )
    .sort((left, right) => left.t - right.t);
  if (samples.length < 10) {
    return null;
  }

  let start = 0;
  let covered = 0;
  let weighted = 0;
  let best: number | null = null;

  function dtBetween(index: number) {
    const next = samples[index + 1];
    if (!next) {
      return 1;
    }
    return Math.min(30, Math.max(0, next.t - samples[index].t));
  }

  for (let end = 0; end < samples.length; end += 1) {
    if (end > 0) {
      const dt = dtBetween(end - 1);
      covered += dt;
      weighted += samples[end - 1]!.hr * dt;
    }
    while (start < end && samples[end]!.t - samples[start]!.t > windowSeconds) {
      const dt = dtBetween(start);
      covered -= dt;
      weighted -= samples[start]!.hr * dt;
      start += 1;
    }
    const span = samples[end]!.t - samples[start]!.t;
    if (span < windowSeconds * 0.95 || covered < windowSeconds * minCoverage) {
      continue;
    }
    const mean = weighted / covered;
    if (best == null || mean > best) {
      best = mean;
    }
  }
  return best == null ? null : Math.round(best);
}

export function sessionThresholdHr(peak20: number | null, peak60: number | null) {
  const from20 = peak20 != null ? 0.95 * peak20 : null;
  const candidates = [peak60, from20].filter((value): value is number => value != null);
  if (candidates.length === 0) {
    return null;
  }
  return Math.round(Math.max(...candidates));
}

export function isPlausibleLthr(value: number, hrMax?: number | null) {
  if (value < 140 || value > 210) {
    return false;
  }
  if (hrMax != null) {
    if (value > hrMax - 3) {
      return false;
    }
    if (value < hrMax * 0.8) {
      return false;
    }
  }
  return true;
}

export function deriveObservedLthr(
  sessions: { date: string; candidate: number }[],
  hrMax: number | null,
) {
  const clean = sessions.filter((row) => isPlausibleLthr(row.candidate, hrMax));
  if (clean.length === 0) {
    return null;
  }
  const lthr = Math.max(...clean.map((row) => row.candidate));
  const supporters = clean.filter((row) => lthr - row.candidate <= 8);
  if (clean.length < 2 || supporters.length < 2) {
    return null;
  }
  const dated = clean.slice().sort((left, right) => left.date.localeCompare(right.date));
  const confidence: HrModelConfidence =
    supporters.length >= 3 && hrMax != null ? "high" : "moderate";
  return {
    lthr,
    confidence,
    validFrom: dated[0]?.date ?? clean[0]!.date,
    supportingSessions: supporters.length,
  };
}
