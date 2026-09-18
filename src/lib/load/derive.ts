import {
  activityCapabilities,
  type ActivityCapabilities,
  type DataQuality,
  type LoadMethod,
} from "@/lib/activity";
import type { StreamPoint } from "@/lib/fit/parse";
import type { WorkoutSport } from "@/lib/workout";

export const LOAD_FORMULA_VERSION = "summary-cascade-v4";

export type HrZoneSeconds = {
  z1: number;
  z2: number;
  z3: number;
  z4: number;
  z5: number;
};

export type TrainingMix = {
  easy_seconds: number;
  specific_seconds: number;
  high_seconds: number;
};

export type MixLap = {
  durationSeconds?: number | null;
  avgHr?: number | null;
  avgPower?: number | null;
};

type IntensityBand = "easy" | "specific" | "high";

export type DerivedActivityMetrics = {
  potential_load: number;
  intensity: number | null;
  aerobic_load: number;
  specific_load: number;
  hr_zone_seconds: HrZoneSeconds;
  training_mix: TrainingMix;
  load_method: LoadMethod;
  data_quality: DataQuality;
  capabilities: ActivityCapabilities;
  formula_version: typeof LOAD_FORMULA_VERSION;
};

const EMPTY_ZONES: HrZoneSeconds = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 };

const SPORT_DURATION_FACTOR: Record<WorkoutSport, number> = {
  run: 1,
  ride: 0.75,
  swim: 1.1,
  triathlon: 0.9,
  walk: 0.35,
  strength: 0.45,
  row: 1,
  ski: 1,
  other: 0.5,
};

const EASY_SPEED_MPS: Partial<Record<WorkoutSport, number>> = {
  run: 2.8,
  walk: 1.4,
  swim: 1,
  ride: 6.5,
  row: 3.2,
  ski: 2.6,
};

export function hrMaxForZones(profileMax?: number | null): number {
  return profileMax && profileMax >= 140 && profileMax <= 220 ? profileMax : 190;
}

export function zoneForHr(hr: number, hrMax: number): keyof HrZoneSeconds {
  const pct = hr / hrMax;
  if (pct < 0.6) {
    return "z1";
  }
  if (pct < 0.7) {
    return "z2";
  }
  if (pct < 0.8) {
    return "z3";
  }
  if (pct < 0.9) {
    return "z4";
  }
  return "z5";
}

export function zoneSecondsFromStream(
  points: StreamPoint[],
  hrMax: number,
): HrZoneSeconds {
  const zones = { ...EMPTY_ZONES };
  for (let index = 0; index < points.length; index += 1) {
    const hr = points[index]?.hr;
    if (hr == null || hr < 40) {
      continue;
    }
    const next = points[index + 1]?.t;
    const dt =
      next != null && next > points[index].t
        ? Math.min(30, next - points[index].t)
        : 1;
    zones[zoneForHr(hr, hrMax)] += dt;
  }
  return zones;
}

export function mixFromZones(zones: HrZoneSeconds): TrainingMix {
  return {
    easy_seconds: zones.z1 + zones.z2,
    specific_seconds: zones.z3 + zones.z4,
    high_seconds: zones.z5,
  };
}

const SESSION_MIX: Partial<Record<string, [number, number, number]>> = {
  recovery: [1, 0, 0],
  endurance: [0.88, 0.12, 0],
  long: [0.85, 0.15, 0],
  tempo: [0.42, 0.5, 0.08],
  intervals: [0.5, 0.38, 0.12],
  quality: [0.5, 0.38, 0.12],
  race: [0.15, 0.58, 0.27],
  test: [0.2, 0.45, 0.35],
  strength: [0.7, 0.3, 0],
};

const BAND_MIX: Record<IntensityBand, [number, number, number]> = {
  easy: [0.88, 0.12, 0],
  specific: [0.5, 0.4, 0.1],
  high: [0.4, 0.3, 0.3],
};

function applyMix(durationSeconds: number, parts: [number, number, number]): TrainingMix {
  const easy = Math.round(durationSeconds * parts[0]);
  const specific = Math.round(durationSeconds * parts[1]);
  const high = Math.max(0, durationSeconds - easy - specific);
  return { easy_seconds: easy, specific_seconds: specific, high_seconds: high };
}

export function cyclingIntensityFactor(input: {
  avgHr?: number | null;
  hrMax?: number | null;
  avgPower?: number | null;
  avgSpeedMps?: number | null;
  rpe?: number | null;
}): number | null {
  const hrMax = hrMaxForZones(input.hrMax);
  if (input.avgHr && input.avgHr >= 40) {
    return input.avgHr / hrMax;
  }
  if (input.avgPower && input.avgPower > 0) {
    return input.avgPower / 200;
  }
  if (input.avgSpeedMps && input.avgSpeedMps > 0) {
    return input.avgSpeedMps / 8.3;
  }
  if (input.rpe && input.rpe >= 1) {
    return input.rpe / 10;
  }
  return null;
}

export function mixFromCyclingIntensity(durationSeconds: number, intensity: number | null) {
  if (intensity == null || intensity < 0.7) {
    return applyMix(durationSeconds, [1, 0, 0]);
  }
  if (intensity < 0.8) {
    return applyMix(durationSeconds, [0.72, 0.28, 0]);
  }
  if (intensity < 0.9) {
    return applyMix(durationSeconds, [0.35, 0.5, 0.15]);
  }
  return applyMix(durationSeconds, [0.15, 0.45, 0.4]);
}

export function intensityBand(input: {
  sport: WorkoutSport | string;
  avgHr?: number | null;
  hrMax?: number | null;
  avgPower?: number | null;
  avgSpeedMps?: number | null;
  rpe?: number | null;
}): IntensityBand {
  const hrMax = hrMaxForZones(input.hrMax);
  if (input.avgHr && input.avgHr >= 40) {
    const zone = zoneForHr(input.avgHr, hrMax);
    if (zone === "z1" || zone === "z2") {
      return "easy";
    }
    if (zone === "z5") {
      return "high";
    }
    return "specific";
  }
  if (input.avgPower && input.avgPower > 0) {
    if (input.avgPower < 110) {
      return "easy";
    }
    if (input.avgPower < 160) {
      return "specific";
    }
    return "high";
  }
  const speed = input.avgSpeedMps ?? 0;
  if (speed > 0 && input.sport === "run") {
    const relative = speed / (EASY_SPEED_MPS.run ?? 2.8);
    if (relative < 0.95) {
      return "easy";
    }
    if (relative < 1.2) {
      return "specific";
    }
    return "high";
  }
  if (speed > 0 && input.sport === "ride") {
    if (speed < 7.5) {
      return "easy";
    }
    if (speed < 9.5) {
      return "specific";
    }
    return "high";
  }
  if (input.rpe && input.rpe >= 1) {
    if (input.rpe <= 4) {
      return "easy";
    }
    if (input.rpe <= 7) {
      return "specific";
    }
    return "high";
  }
  return "easy";
}

export function estimateTrainingMix(
  durationSeconds: number,
  band: IntensityBand,
  sessionType?: string | null,
): TrainingMix {
  const key = sessionType?.trim().toLowerCase() ?? "";
  return applyMix(durationSeconds, SESSION_MIX[key] ?? BAND_MIX[band]);
}

export function mixFromLaps(
  laps: MixLap[],
  input: {
    sport: WorkoutSport | string;
    hrMax?: number | null;
  },
): TrainingMix | null {
  const mix: TrainingMix = { easy_seconds: 0, specific_seconds: 0, high_seconds: 0 };
  let classified = 0;
  let classifiedLaps = 0;
  let total = 0;
  for (const lap of laps) {
    const seconds = lap.durationSeconds ?? 0;
    if (seconds <= 0) {
      continue;
    }
    total += seconds;
    if ((lap.avgHr ?? 0) < 40 && (lap.avgPower ?? 0) <= 0) {
      continue;
    }
    const band = intensityBand({
      sport: input.sport,
      avgHr: lap.avgHr,
      hrMax: input.hrMax,
      avgPower: lap.avgPower,
    });
    mix.easy_seconds += band === "easy" ? seconds : 0;
    mix.specific_seconds += band === "specific" ? seconds : 0;
    mix.high_seconds += band === "high" ? seconds : 0;
    classified += seconds;
    classifiedLaps += 1;
  }
  if (classifiedLaps < 2) {
    return null;
  }
  if (total > classified) {
    mix.easy_seconds += total - classified;
  }
  return mix;
}

function edwardsLoad(zones: HrZoneSeconds) {
  // Zone-weighted minutes, scaled so 60 min in Z3 ≈ 60 load.
  return (zones.z1 * 1 + zones.z2 * 2 + zones.z3 * 3 + zones.z4 * 4 + zones.z5 * 5) / 180;
}

function hasZoneTime(zones: HrZoneSeconds) {
  return zones.z1 + zones.z2 + zones.z3 + zones.z4 + zones.z5 > 0;
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function streamHasHr(points: StreamPoint[] | undefined) {
  return Boolean(points?.some((point) => point.hr && point.hr >= 40));
}

export function deriveActivityMetrics(input: {
  sport: WorkoutSport | string;
  durationSeconds: number | null;
  distanceM?: number | null;
  avgHr: number | null;
  avgPower?: number | null;
  normalizedPower?: number | null;
  avgSpeedMps?: number | null;
  rpe?: number | null;
  sessionType?: string | null;
  stream?: StreamPoint[];
  hrMax?: number | null;
  hasLaps?: boolean;
  hasFit?: boolean;
  laps?: MixLap[];
}): DerivedActivityMetrics {
  const sport = (input.sport as WorkoutSport) || "other";
  const minutes = Math.max(0, (input.durationSeconds ?? 0) / 60);
  const hours = minutes / 60;
  const rpe =
    input.rpe && input.rpe >= 1 && input.rpe <= 10 ? input.rpe : null;
  const hrMax = hrMaxForZones(input.hrMax);
  const speed =
    input.avgSpeedMps && input.avgSpeedMps > 0
      ? input.avgSpeedMps
      : input.distanceM && input.durationSeconds && input.durationSeconds > 0
        ? input.distanceM / input.durationSeconds
        : null;
  const power = input.normalizedPower || input.avgPower || null;
  const capabilities = activityCapabilities({
    avgHr: input.avgHr,
    avgPower: power,
    distanceM: input.distanceM,
    durationSeconds: input.durationSeconds,
    avgSpeedMps: speed,
    hasLaps: input.hasLaps || (input.laps?.length ?? 0) > 0,
    hasStreams: streamHasHr(input.stream) || Boolean(input.stream && input.stream.length > 0),
    hasFit: input.hasFit,
  });

  const zones = { ...EMPTY_ZONES };
  let load_method: LoadMethod = "duration_sport";
  let data_quality: DataQuality = "estimated";
  let potential_load = minutes * (SPORT_DURATION_FACTOR[sport] ?? 0.5);

  if (streamHasHr(input.stream)) {
    Object.assign(zones, zoneSecondsFromStream(input.stream ?? [], hrMax));
    if (hasZoneTime(zones)) {
      potential_load = edwardsLoad(zones);
      load_method = "hr_stream";
      data_quality = "rich";
    }
  }

  if (load_method === "duration_sport" && input.avgHr && input.avgHr >= 40 && minutes > 0) {
    zones[zoneForHr(input.avgHr, hrMax)] = input.durationSeconds ?? 0;
    potential_load = edwardsLoad(zones);
    load_method = "hr_duration";
    data_quality = "good";
  }

  if (load_method === "duration_sport" && power && power > 0 && minutes > 0) {
    potential_load = minutes * (power / 130);
    load_method = "power_duration";
    data_quality = "good";
  }

  if (load_method === "duration_sport" && speed && speed > 0 && minutes > 0) {
    const easy = EASY_SPEED_MPS[sport] ?? 2.8;
    const intensity = Math.min(2.5, Math.max(0.4, speed / easy));
    potential_load = minutes * intensity * (SPORT_DURATION_FACTOR[sport] ?? 0.5);
    load_method = "pace_duration";
    data_quality = "good";
  }

  if (load_method === "duration_sport" && rpe && minutes > 0) {
    potential_load = minutes * (rpe / 5) * (SPORT_DURATION_FACTOR[sport] ?? 0.5);
    load_method = "duration_rpe";
    data_quality = "estimated";
  }

  if (
    (load_method === "duration_sport" || load_method === "duration_rpe") &&
    (input.sessionType === "race" || input.sessionType === "test")
  ) {
    potential_load *= 1.15;
  }

  let mix: TrainingMix = { easy_seconds: 0, specific_seconds: 0, high_seconds: 0 };
  const duration = input.durationSeconds ?? 0;
  if (load_method === "hr_stream" && hasZoneTime(zones)) {
    mix = mixFromZones(zones);
  } else if (duration > 0) {
    mix =
      mixFromLaps(input.laps ?? [], { sport, hrMax: input.hrMax }) ??
      (sport === "ride"
        ? mixFromCyclingIntensity(
            duration,
            cyclingIntensityFactor({
              avgHr: input.avgHr,
              hrMax: input.hrMax,
              avgPower: power,
              avgSpeedMps: speed,
              rpe,
            }),
          )
        : estimateTrainingMix(
            duration,
            intensityBand({
              sport,
              avgHr: input.avgHr,
              hrMax: input.hrMax,
              avgPower: power,
              avgSpeedMps: speed,
              rpe,
            }),
            input.sessionType,
          ));
  }

  return {
    potential_load: round1(potential_load),
    intensity: hours > 0 ? round1(potential_load / hours) : null,
    aerobic_load: round1((zones.z1 * 1 + zones.z2 * 2) / 180),
    specific_load: round1((zones.z3 * 3 + zones.z4 * 4 + zones.z5 * 5) / 180),
    hr_zone_seconds: {
      z1: Math.round(zones.z1),
      z2: Math.round(zones.z2),
      z3: Math.round(zones.z3),
      z4: Math.round(zones.z4),
      z5: Math.round(zones.z5),
    },
    training_mix: {
      easy_seconds: Math.round(mix.easy_seconds),
      specific_seconds: Math.round(mix.specific_seconds),
      high_seconds: Math.round(mix.high_seconds),
    },
    load_method,
    data_quality,
    capabilities,
    formula_version: LOAD_FORMULA_VERSION,
  };
}
