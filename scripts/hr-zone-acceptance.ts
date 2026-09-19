import {
  deriveObservedHrMax,
  deriveObservedLthr,
  isPlausibleLthr,
  maxTimeWeightedMean,
  sessionThresholdHr,
} from "../src/lib/hr-model/observe";
import { UNKNOWN_HR_MODEL, type HrModel } from "../src/lib/hr-model/types";
import { zoneForHr, type ZoneScheme } from "../src/lib/hr-model/zones";
import { deriveActivityMetrics } from "../src/lib/load/derive";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function steadyStream(from = 140, to = 162, seconds = 3600) {
  const points: { t: number; hr: number }[] = [];
  for (let t = 0; t < seconds; t += 1) {
    const mid = (from + to) / 2;
    const amp = (to - from) / 2;
    points.push({ t, hr: Math.round(mid + amp * Math.sin(t / 180)) });
  }
  return points;
}

function flatStream(hr: number, seconds: number) {
  return Array.from({ length: seconds }, (_, t) => ({ t, hr }));
}

const pctMax: ZoneScheme = { method: "pct-max", anchor: 199, version: "pct-max-v1" };
const lthr: ZoneScheme = { method: "lthr", anchor: 187, version: "lthr-v1" };

const pctMaxModel: HrModel = {
  hrMax: 199,
  source: "observed",
  confidence: "high",
  cyclingLthr: null,
  runningLthr: null,
  thresholdSource: null,
  thresholdConfidence: null,
  version: "pct-max-v1",
};

const lthrModel: HrModel = {
  ...pctMaxModel,
  cyclingLthr: 187,
  thresholdSource: "observed",
  thresholdConfidence: "high",
  version: "lthr-v1",
};

const fallback = deriveActivityMetrics({
  sport: "ride",
  durationSeconds: 3613,
  avgHr: 151,
  sessionMaxHr: 166,
  hrModel: pctMaxModel,
  stream: steadyStream(),
});

assert(fallback.hr_model.hrMax === 199, `used ${fallback.hr_model.hrMax}, not 199`);
assert(fallback.zone_method === "pct-max", "missing LTHR must fall back to % HRmax");
assert(fallback.intensity_classification.status === "uncertain", "% HRmax zoning is a fallback");
assert(fallback.hr_z4_max === 179, `Z5 threshold snapshot was ${fallback.hr_z4_max}, expected 179`);
assert(zoneForHr(151, pctMax) === "z3", "151 / 199 must be Z3");
assert(zoneForHr(166, pctMax) === "z4", "166 / 199 must be Z4");
assert(zoneForHr(180, pctMax) === "z5", "180 / 199 must be Z5");
assert(
  fallback.hr_zone_seconds.z5 < 60,
  `Z5 was ${Math.round(fallback.hr_zone_seconds.z5 / 60)} min; a 140–162 stream cannot be Z5 against 199`,
);
assert(fallback.hr_zone_seconds.z3 > fallback.hr_zone_seconds.z5, "stream should be primarily Z3");

const tuesday = deriveActivityMetrics({
  sport: "ride",
  durationSeconds: 3613,
  avgHr: 151,
  sessionMaxHr: 166,
  hrModel: lthrModel,
  stream: steadyStream(),
});

assert(tuesday.zone_method === "lthr", "reliable cycling LTHR must win");
assert(tuesday.threshold_hr === 187, `threshold snapshot was ${tuesday.threshold_hr}`);
assert(tuesday.hr_z1_max === 151, `LTHR Z1 top should be 151, got ${tuesday.hr_z1_max}`);
assert(tuesday.hr_z2_max === 168, `LTHR Z2 top should be 168, got ${tuesday.hr_z2_max}`);
assert(zoneForHr(151, lthr) === "z1", "151 / 187 is the top of Z1");
assert(zoneForHr(162, lthr) === "z2", "162 / 187 must be Z2");
assert(zoneForHr(166, lthr) === "z2", "166 / 187 must be Z2");
assert(zoneForHr(187, lthr) === "z5", "187 / 187 must be Z5");
assert(
  tuesday.hr_zone_seconds.z1 + tuesday.hr_zone_seconds.z2 >
    tuesday.hr_zone_seconds.z3 + tuesday.hr_zone_seconds.z4 + tuesday.hr_zone_seconds.z5,
  `Tuesday 140–162 against LTHR 187 should be mostly Z1/Z2; got Z1=${Math.round(tuesday.hr_zone_seconds.z1 / 60)} Z2=${Math.round(tuesday.hr_zone_seconds.z2 / 60)} Z3=${Math.round(tuesday.hr_zone_seconds.z3 / 60)}`,
);
assert(tuesday.intensity_classification.status === "trusted", "high-confidence LTHR is trusted");

const unknown = deriveActivityMetrics({
  sport: "ride",
  durationSeconds: 3613,
  avgHr: 151,
  sessionMaxHr: 166,
  hrModel: UNKNOWN_HR_MODEL,
  stream: steadyStream(),
});

assert(unknown.hr_model.source === "unknown", "missing model must stay unknown");
assert(unknown.intensity_classification.status === "unavailable", "unknown must be unavailable");
assert(
  unknown.hr_zone_seconds.z1 +
    unknown.hr_zone_seconds.z2 +
    unknown.hr_zone_seconds.z3 +
    unknown.hr_zone_seconds.z4 +
    unknown.hr_zone_seconds.z5 ===
    0,
  "unknown must not manufacture zone durations",
);
assert(
  unknown.training_mix.easy_seconds +
    unknown.training_mix.specific_seconds +
    unknown.training_mix.high_seconds ===
    0,
  "unknown must not claim HR mix",
);

const observed = deriveObservedHrMax([
  { date: "2024-11-07", peak: 172 },
  { date: "2026-08-31", peak: 199 },
  { date: "2026-09-02", peak: 197 },
]);
assert(observed?.hrMax === 199, "observed max should be the robust peak");
assert(
  observed?.validFrom === "2024-11-07",
  `observed model must apply from first HR evidence, got ${observed?.validFrom}`,
);

assert(sessionThresholdHr(197, 180) === 187, "max(60-min, 95% of 20-min) should match TrainingPeaks");
assert(maxTimeWeightedMean(flatStream(187, 3600), 20 * 60) === 187, "flat 187 stream should read 187");
assert(isPlausibleLthr(145, 199) === false, "easy-hour 145 is not a cycling threshold against 199");
assert(isPlausibleLthr(160, 199) === true, "160 is the floor of plausible LTHR against 199");
assert(isPlausibleLthr(187, 199) === true, "187 is a plausible cycling threshold against 199");

const estimated = deriveObservedLthr(
  [
    { date: "2026-04-12", candidate: 184 },
    { date: "2026-07-04", candidate: 187 },
    { date: "2026-08-20", candidate: 186 },
  ],
  199,
);
assert(estimated?.lthr === 187, `estimated LTHR was ${estimated?.lthr}`);
assert(estimated?.confidence === "high", "three hard efforts near the peak are high confidence");

const clustered = deriveObservedLthr(
  [
    { date: "2026-08-31", candidate: 175 },
    { date: "2026-09-07", candidate: 181 },
    { date: "2026-09-14", candidate: 173 },
  ],
  199,
);
assert(clustered?.lthr === 181, `clustered LTHR was ${clustered?.lthr}`);
assert(clustered?.confidence === "high", "nearby hard efforts should confirm the peak");

const isolated = deriveObservedLthr([{ date: "2026-09-15", candidate: 187 }], 199);
assert(isolated == null, "a single hard effort must not invent threshold");

console.log("HR zone acceptance passed.");
