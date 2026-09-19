import {
  LTHR_ZONE_VERSION,
  PCT_MAX_ZONE_VERSION,
  type HrModel,
  type HrModelConfidence,
  type HrZoneBounds,
  type ThresholdSport,
  type ZoneMethod,
} from "@/lib/hr-model/types";

export type HrZoneSeconds = {
  z1: number;
  z2: number;
  z3: number;
  z4: number;
  z5: number;
};

export type ZoneScheme = {
  method: ZoneMethod;
  anchor: number;
  version: string;
};

export const HR_ZONE_CUTOFFS = [0.6, 0.7, 0.8, 0.9] as const;
export const LTHR_ZONE_CUTOFFS = [0.81, 0.9, 0.94, 1] as const;

export function thresholdSportOf(sport: string): ThresholdSport | null {
  if (sport === "ride") {
    return "cycling";
  }
  if (sport === "run") {
    return "running";
  }
  return null;
}

export function isReliableThreshold(
  value: number | null | undefined,
  confidence: HrModelConfidence | null | undefined,
): value is number {
  return (
    typeof value === "number" &&
    value >= 140 &&
    value <= 210 &&
    (confidence === "high" || confidence === "moderate")
  );
}

export function thresholdForSport(model: HrModel, sport: string): number | null {
  const kind = thresholdSportOf(sport);
  if (kind === "cycling") {
    return model.cyclingLthr;
  }
  if (kind === "running") {
    return model.runningLthr;
  }
  return null;
}

export function zoneSchemeFor(model: HrModel, sport: string): ZoneScheme | null {
  const lthr = thresholdForSport(model, sport);
  if (isReliableThreshold(lthr, model.thresholdConfidence)) {
    return { method: "lthr", anchor: lthr, version: LTHR_ZONE_VERSION };
  }
  if (model.hrMax != null && model.source !== "unknown") {
    return { method: "pct-max", anchor: model.hrMax, version: PCT_MAX_ZONE_VERSION };
  }
  return null;
}

function cutoffsFor(method: ZoneMethod) {
  return method === "lthr" ? LTHR_ZONE_CUTOFFS : HR_ZONE_CUTOFFS;
}

export function zoneBoundsFromScheme(scheme: ZoneScheme): HrZoneBounds {
  const [z1, z2, z3, z4] = cutoffsFor(scheme.method).map((pct) => scheme.anchor * pct);
  return {
    z1: { min: 0, max: z1 },
    z2: { min: z1, max: z2 },
    z3: { min: z2, max: z3 },
    z4: { min: z3, max: z4 },
    z5: { min: z4, max: null },
  };
}

export function zoneBoundsFromHrMax(hrMax: number): HrZoneBounds {
  return zoneBoundsFromScheme({
    method: "pct-max",
    anchor: hrMax,
    version: PCT_MAX_ZONE_VERSION,
  });
}

export function modelWithZones(model: HrModel, sport = "ride"): HrModel {
  const scheme = zoneSchemeFor(model, sport);
  if (!scheme) {
    return model;
  }
  return {
    ...model,
    version: scheme.version,
    zones: zoneBoundsFromScheme(scheme),
  };
}

export function zoneForHr(hr: number, scheme: ZoneScheme): keyof HrZoneSeconds {
  const pct = hr / scheme.anchor;
  const [z1, z2, z3, z4] = cutoffsFor(scheme.method);
  if (pct < z1) {
    return "z1";
  }
  if (pct < z2) {
    return "z2";
  }
  if (pct < z3) {
    return "z3";
  }
  if (pct < z4) {
    return "z4";
  }
  return "z5";
}

export function zoneSecondsFromStream(
  points: { t: number; hr?: number | null }[],
  scheme: ZoneScheme,
): HrZoneSeconds {
  const zones: HrZoneSeconds = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 };
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
    zones[zoneForHr(hr, scheme)] += dt;
  }
  return zones;
}

export function snapshotBounds(scheme: ZoneScheme) {
  const [z1, z2, z3, z4] = cutoffsFor(scheme.method);
  return {
    hr_z1_max: Math.round(scheme.anchor * z1),
    hr_z2_max: Math.round(scheme.anchor * z2),
    hr_z3_max: Math.round(scheme.anchor * z3),
    hr_z4_max: Math.round(scheme.anchor * z4),
  };
}
