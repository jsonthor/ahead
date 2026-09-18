/**
 * Canonical completed activity. Importers turn a vendor payload into
 * this shape. Once it is in Potential, the source is almost irrelevant:
 * load, fitness, fatigue, form, and Ask Ahead all run on these
 * observations — never on Garmin Training Effect or COROS Training Load.
 *
 * Model from the lowest common denominator. Enrich when better data exists.
 * FIT / streams are a bonus raw source, not the foundation.
 */

import type { ActivitySource } from "@/lib/activity-source";
import type { WorkoutSport } from "@/lib/workout";

export const ACTIVITY_VERSION = 1;

export type ActivityVendorMetrics = Record<string, number | string | boolean>;

export type ActivityCapabilities = {
  has_hr: boolean;
  has_power: boolean;
  has_pace: boolean;
  has_laps: boolean;
  has_streams: boolean;
  has_fit: boolean;
};

export type LoadMethod =
  | "hr_stream"
  | "hr_duration"
  | "power_duration"
  | "pace_duration"
  | "duration_rpe"
  | "duration_sport";

export type DataQuality = "rich" | "good" | "estimated";

export type PotentialActivity = {
  version: typeof ACTIVITY_VERSION;
  id: string;
  athleteId: string;
  source: ActivitySource;
  sourceActivityId: string;
  sport: WorkoutSport;
  startedAt: string;
  durationSeconds: number;
  distanceMeters?: number;
  elevationGainMeters?: number;
  avgHr?: number;
  maxHr?: number;
  avgPower?: number;
  normalizedPower?: number;
  avgCadence?: number;
  avgSpeedMps?: number;
  /** Optional 1–10 effort. Used only when HR, power, and pace are missing. */
  rpe?: number;
  /** Storage key for original FIT / GPX / vendor dump. Bonus, not required. */
  rawFileKey?: string;
  /** Potential's training load — never copied from the vendor. */
  load?: number;
  /** Potential's intensity — never copied from the vendor. */
  intensity?: number;
  loadMethod?: LoadMethod;
  dataQuality?: DataQuality;
  capabilities?: ActivityCapabilities;
  /**
   * Vendor-derived numbers kept as metadata only.
   * e.g. garmin_training_effect, coros_training_load, polar_cardio_load.
   * Do not feed these into daily_loads or the assistant.
   */
  vendor?: ActivityVendorMetrics;
};

export type ActivityImporter<Raw> = {
  source: ActivitySource;
  toPotential: (raw: Raw, athleteId: string) => Omit<PotentialActivity, "id" | "load" | "intensity">;
};

export function activityCapabilities(input: {
  avgHr?: number | null;
  avgPower?: number | null;
  distanceM?: number | null;
  durationSeconds?: number | null;
  avgSpeedMps?: number | null;
  hasLaps?: boolean;
  hasStreams?: boolean;
  hasFit?: boolean;
}): ActivityCapabilities {
  const duration = (input.durationSeconds ?? 0) > 0;
  const distance = (input.distanceM ?? 0) > 0;
  const speed = (input.avgSpeedMps ?? 0) > 0 || (duration && distance);
  return {
    has_hr: (input.avgHr ?? 0) > 0,
    has_power: (input.avgPower ?? 0) > 0,
    has_pace: speed,
    has_laps: Boolean(input.hasLaps),
    has_streams: Boolean(input.hasStreams),
    has_fit: Boolean(input.hasFit),
  };
}

export function loadMethodLabel(method: LoadMethod | null | undefined): string | null {
  switch (method) {
    case "hr_stream":
      return "from heart rate stream";
    case "hr_duration":
      return "from heart rate";
    case "power_duration":
      return "from power";
    case "pace_duration":
      return "from pace";
    case "duration_rpe":
      return "from duration and effort";
    case "duration_sport":
      return "estimated from duration";
    default:
      return null;
  }
}

export function dataQualityLabel(quality: DataQuality | null | undefined): string | null {
  switch (quality) {
    case "rich":
      return "detailed";
    case "good":
      return "good";
    case "estimated":
      return "estimated";
    default:
      return null;
  }
}
