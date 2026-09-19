import type { HrModel, IntensityClassification } from "@/lib/hr-model/types";
import { zoneSchemeFor, type HrZoneSeconds, type ZoneScheme } from "@/lib/hr-model/zones";

export function classifyIntensity(model: HrModel, sport: string): IntensityClassification {
  const scheme = zoneSchemeFor(model, sport);
  if (!scheme) {
    return {
      status: "unavailable",
      reason: "No athlete HR model",
    };
  }
  if (scheme.method === "lthr" && model.thresholdConfidence === "high") {
    return {
      status: "trusted",
      reason: `${model.thresholdSource === "manual" ? "Manual" : model.thresholdSource === "observed" ? "Observed" : "Provider"} ${sport === "ride" ? "cycling" : "running"} threshold ${scheme.anchor}, high confidence`,
    };
  }
  if (scheme.method === "lthr") {
    return {
      status: "uncertain",
      reason: `Threshold ${scheme.anchor} inferred from limited hard efforts`,
    };
  }
  return {
    status: "uncertain",
    reason: `Using % HRmax ${model.hrMax} because no reliable sport-specific threshold is available`,
  };
}

export function hrCalibrationWarning(input: {
  model: HrModel;
  scheme: ZoneScheme | null;
  avgHr: number | null;
  sessionMaxHr: number | null;
  durationSeconds: number | null;
  zones: HrZoneSeconds | null;
  sessionType?: string | null;
}): string | null {
  if (!input.scheme || input.model.source === "unknown") {
    return "Heart-rate zones unavailable. Ahead doesn't yet have a reliable maximum or threshold for this athlete.";
  }
  const duration = input.durationSeconds ?? 0;
  const z5 = input.zones?.z5 ?? 0;
  const z5Floor =
    input.scheme.method === "lthr" ? input.scheme.anchor : input.scheme.anchor * 0.9;
  const long = duration >= 40 * 60;
  const ordinary =
    input.sessionType !== "race" &&
    input.sessionType !== "test" &&
    input.sessionType !== "intervals";
  if (
    input.scheme.method === "pct-max" &&
    input.sessionMaxHr != null &&
    input.model.hrMax != null &&
    Math.abs(input.sessionMaxHr - input.model.hrMax) <= 2 &&
    long
  ) {
    return "Heart-rate zones may need calibration. This session's peak sits on Ahead's athlete HRmax, which is unlikely for a long steady effort.";
  }
  if (z5 >= 30 * 60 && ordinary) {
    const avg = input.avgHr != null ? ` This ride averaged ${input.avgHr} bpm` : "";
    return `Heart-rate zones may need calibration.${avg} but ${Math.round(z5 / 60)} minutes were classified as Z5. Ahead's HR model for this activity is not reliable enough to interpret its intensity.`;
  }
  if (input.avgHr != null && input.avgHr >= z5Floor && long && ordinary) {
    return `Heart-rate zones may need calibration. This ride averaged ${input.avgHr} bpm, at or above the Z5 threshold of ${Math.round(z5Floor)}.`;
  }
  return null;
}
