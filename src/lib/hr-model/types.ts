export const PCT_MAX_ZONE_VERSION = "pct-max-v1";
export const LTHR_ZONE_VERSION = "lthr-v1";
export const HR_ZONE_MODEL_VERSION = LTHR_ZONE_VERSION;

export type HrModelSource = "manual" | "provider_profile" | "observed" | "unknown";

export type HrModelConfidence = "high" | "moderate" | "low";

export type ThresholdSport = "cycling" | "running";

export type ZoneMethod = "lthr" | "pct-max";

export type IntensityClassificationStatus = "trusted" | "uncertain" | "unavailable";

export type HrZoneBounds = {
  z1: { min: number; max: number };
  z2: { min: number; max: number };
  z3: { min: number; max: number };
  z4: { min: number; max: number };
  z5: { min: number; max: null };
};

export type HrModel = {
  hrMax: number | null;
  source: HrModelSource;
  confidence: HrModelConfidence | null;
  cyclingLthr: number | null;
  runningLthr: number | null;
  thresholdSource: Exclude<HrModelSource, "unknown"> | null;
  thresholdConfidence: HrModelConfidence | null;
  validFrom?: string;
  validTo?: string | null;
  version: string;
  zones?: HrZoneBounds;
};

export type IntensityClassification = {
  status: IntensityClassificationStatus;
  reason: string | null;
};

export const UNKNOWN_HR_MODEL: HrModel = {
  hrMax: null,
  source: "unknown",
  confidence: null,
  cyclingLthr: null,
  runningLthr: null,
  thresholdSource: null,
  thresholdConfidence: null,
  version: HR_ZONE_MODEL_VERSION,
};

export type AthleteHrModelRow = {
  id: string;
  athlete_id: string;
  hr_max: number;
  source: Exclude<HrModelSource, "unknown">;
  confidence: HrModelConfidence;
  cycling_lthr: number | null;
  running_lthr: number | null;
  threshold_source: Exclude<HrModelSource, "unknown"> | null;
  threshold_confidence: HrModelConfidence | null;
  valid_from: string;
  valid_to: string | null;
  provider: string | null;
  provider_value_reference: string | null;
};
