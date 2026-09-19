import { createAdminClient } from "@/lib/supabase/admin";
import {
  UNKNOWN_HR_MODEL,
  type AthleteHrModelRow,
  type HrModel,
  type HrModelConfidence,
  type HrModelSource,
} from "@/lib/hr-model/types";
import { modelWithZones } from "@/lib/hr-model/zones";

const MODEL_COLUMNS =
  "id, athlete_id, hr_max, source, confidence, cycling_lthr, running_lthr, threshold_source, threshold_confidence, valid_from, valid_to, provider, provider_value_reference";

function optionalInt(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asRow(value: Record<string, unknown>): AthleteHrModelRow {
  return {
    id: String(value.id),
    athlete_id: String(value.athlete_id),
    hr_max: Number(value.hr_max),
    source: value.source as AthleteHrModelRow["source"],
    confidence: value.confidence as HrModelConfidence,
    cycling_lthr: optionalInt(value.cycling_lthr),
    running_lthr: optionalInt(value.running_lthr),
    threshold_source: (value.threshold_source as AthleteHrModelRow["threshold_source"]) ?? null,
    threshold_confidence: (value.threshold_confidence as HrModelConfidence | null) ?? null,
    valid_from: String(value.valid_from),
    valid_to: (value.valid_to as string | null) ?? null,
    provider: (value.provider as string | null) ?? null,
    provider_value_reference: (value.provider_value_reference as string | null) ?? null,
  };
}

function pickThresholdField(
  rows: AthleteHrModelRow[],
  field: "cycling_lthr" | "running_lthr",
): Pick<HrModel, "thresholdSource" | "thresholdConfidence"> & { value: number | null } {
  const ranked = [...rows]
    .filter((row) => row[field] != null)
    .sort((left, right) => {
      const rank = (row: AthleteHrModelRow) =>
        row.threshold_source === "manual" ? 0 : row.threshold_source === "observed" ? 1 : 2;
      return rank(left) - rank(right);
    });
  const chosen = ranked[0];
  if (!chosen || chosen[field] == null) {
    return { value: null, thresholdSource: null, thresholdConfidence: null };
  }
  return {
    value: chosen[field],
    thresholdSource: chosen.threshold_source,
    thresholdConfidence: chosen.threshold_confidence,
  };
}

function toModel(row: AthleteHrModelRow, extras?: Partial<HrModel>): HrModel {
  return modelWithZones({
    hrMax: row.hr_max,
    source: row.source,
    confidence: row.confidence,
    cyclingLthr: extras?.cyclingLthr ?? row.cycling_lthr,
    runningLthr: extras?.runningLthr ?? row.running_lthr,
    thresholdSource: extras?.thresholdSource ?? row.threshold_source,
    thresholdConfidence: extras?.thresholdConfidence ?? row.threshold_confidence,
    validFrom: row.valid_from,
    validTo: row.valid_to,
    version: extras?.version ?? (row.threshold_source ? "lthr-v1" : "pct-max-v1"),
  });
}

export async function loadHrModelsOn(athleteId: string, activityDate: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("athlete_hr_models")
    .select(MODEL_COLUMNS)
    .eq("athlete_id", athleteId)
    .lte("valid_from", activityDate)
    .or(`valid_to.is.null,valid_to.gt.${activityDate}`)
    .order("valid_from", { ascending: false });
  if (error) {
    console.error("Load HR models failed", error);
    return [];
  }
  return (data ?? []).map((row) => asRow(row as Record<string, unknown>));
}

export async function loadHrModelHistory(athleteId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("athlete_hr_models")
    .select(MODEL_COLUMNS)
    .eq("athlete_id", athleteId)
    .order("valid_from", { ascending: true });
  if (error) {
    console.error("Load HR model history failed", error);
    return [];
  }
  return (data ?? []).map((row) => asRow(row as Record<string, unknown>));
}

export function pickHrModel(rows: AthleteHrModelRow[], observedHrMax?: number | null): HrModel {
  const cycling = pickThresholdField(rows, "cycling_lthr");
  const running = pickThresholdField(rows, "running_lthr");
  const extras: Partial<HrModel> = {
    cyclingLthr: cycling.value,
    runningLthr: running.value,
    thresholdSource: cycling.thresholdSource ?? running.thresholdSource,
    thresholdConfidence: cycling.thresholdConfidence ?? running.thresholdConfidence,
  };
  const manual = rows.find((row) => row.source === "manual");
  if (manual) {
    return toModel(manual, extras);
  }
  const provider = rows.find((row) => row.source === "provider_profile");
  const observed = rows.find((row) => row.source === "observed");
  const observedMax = observed?.hr_max ?? observedHrMax ?? null;
  if (provider && (observedMax == null || observedMax < provider.hr_max + 8)) {
    return toModel(provider, extras);
  }
  if (observed) {
    return toModel(observed, extras);
  }
  return UNKNOWN_HR_MODEL;
}

export async function writeHrModelVersion(input: {
  athleteId: string;
  hrMax: number;
  source: Exclude<HrModelSource, "unknown">;
  confidence: HrModelConfidence;
  validFrom: string;
  provider?: string | null;
  providerValueReference?: string | null;
  cyclingLthr?: number | null;
  runningLthr?: number | null;
  thresholdSource?: Exclude<HrModelSource, "unknown"> | null;
  thresholdConfidence?: HrModelConfidence | null;
}) {
  const history = await loadHrModelHistory(input.athleteId);
  const open = history
    .filter((row) => row.source === input.source && row.valid_to == null)
    .at(-1);
  const nextLthr = {
    cycling_lthr:
      "cyclingLthr" in input ? (input.cyclingLthr ?? null) : (open?.cycling_lthr ?? null),
    running_lthr:
      "runningLthr" in input ? (input.runningLthr ?? null) : (open?.running_lthr ?? null),
    threshold_source:
      "thresholdSource" in input
        ? (input.thresholdSource ?? null)
        : (open?.threshold_source ?? null),
    threshold_confidence:
      "thresholdConfidence" in input
        ? (input.thresholdConfidence ?? null)
        : (open?.threshold_confidence ?? null),
  };
  const sameCore =
    open &&
    open.hr_max === input.hrMax &&
    open.confidence === input.confidence &&
    open.cycling_lthr === nextLthr.cycling_lthr &&
    open.running_lthr === nextLthr.running_lthr &&
    open.threshold_source === nextLthr.threshold_source &&
    open.threshold_confidence === nextLthr.threshold_confidence;
  if (open && sameCore) {
    if (input.validFrom < open.valid_from) {
      const admin = createAdminClient();
      await admin
        .from("athlete_hr_models")
        .update({ valid_from: input.validFrom })
        .eq("id", open.id);
      return { ...open, valid_from: input.validFrom, ...nextLthr };
    }
    return { ...open, ...nextLthr };
  }
  const admin = createAdminClient();
  if (open && open.valid_from < input.validFrom && !sameCore && open.hr_max !== input.hrMax) {
    await admin
      .from("athlete_hr_models")
      .update({ valid_to: input.validFrom })
      .eq("id", open.id);
  } else if (open && (open.valid_from >= input.validFrom || open.hr_max === input.hrMax)) {
    await admin
      .from("athlete_hr_models")
      .update({
        hr_max: input.hrMax,
        confidence: input.confidence,
        valid_from: input.validFrom < open.valid_from ? input.validFrom : open.valid_from,
        provider: input.provider ?? open.provider,
        provider_value_reference: input.providerValueReference ?? open.provider_value_reference,
        ...nextLthr,
      })
      .eq("id", open.id);
    return {
      ...open,
      hr_max: input.hrMax,
      confidence: input.confidence,
      valid_from: input.validFrom < open.valid_from ? input.validFrom : open.valid_from,
      ...nextLthr,
    };
  }
  const { data, error } = await admin
    .from("athlete_hr_models")
    .insert({
      athlete_id: input.athleteId,
      hr_max: input.hrMax,
      source: input.source,
      confidence: input.confidence,
      valid_from: input.validFrom,
      provider: input.provider ?? null,
      provider_value_reference: input.providerValueReference ?? null,
      ...nextLthr,
    })
    .select(MODEL_COLUMNS)
    .single();
  if (error) {
    console.error("Write HR model failed", error);
    throw new Error("Could not save the HR model.");
  }
  return asRow(data as Record<string, unknown>);
}
