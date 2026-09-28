import type { Json } from "@/lib/database.types";
import { overnightSleepMinutes } from "@/lib/recovery";
import {
  pickFromPriority,
  parseRecoveryPriority,
  keepResolved,
  connectedOrder,
  RECOVERY_METRICS,
  type RecoverySourceId,
  type RecoverySourcePayload,
  type RecoverySourcePriority,
} from "@/lib/recovery/priority";
import { recomputePerformanceState } from "@/lib/load/banister";
import { createAdminClient } from "@/lib/supabase/admin";

export {
  parseRecoveryPriority,
  pickFromPriority,
  keepResolved,
  connectedOrder,
  RECOVERY_METRICS,
  recoverySourceLabel,
  withConnectedSources,
  type RecoveryMetric,
  type RecoverySourceId,
  type RecoverySourcePayload,
  type RecoverySourcePriority,
} from "@/lib/recovery/priority";

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const next = Number(value);
    return Number.isFinite(next) ? next : null;
  }
  return null;
}

export function coverageFor(payload: RecoverySourcePayload) {
  const sleep = overnightSleepMinutes(payload.sleep?.durationMinutes ?? null);
  const hrv = payload.hrvRmssdMs != null;
  const rhr = payload.restingHrBpm != null;
  if (sleep && hrv && rhr) {
    return "complete" as const;
  }
  if (sleep || hrv || rhr || payload.respiratoryRate != null || payload.spo2Pct != null) {
    return "partial" as const;
  }
  return "pending" as const;
}

export async function saveRecoveryObservation(input: {
  athleteId: string;
  date: string;
  source: RecoverySourceId;
  payload: RecoverySourcePayload;
}) {
  const admin = createAdminClient();
  const coverage = coverageFor(input.payload);
  const { error } = await admin.from("recovery_observations").upsert(
    {
      athlete_id: input.athleteId,
      date: input.date,
      source: input.source,
      payload: input.payload as unknown as Json,
      coverage,
      retrieved_at: new Date().toISOString(),
    },
    { onConflict: "athlete_id,date,source" },
  );
  if (error) {
    throw new Error(error.message);
  }
  return coverage;
}

export async function loadRecoveryObservations(athleteId: string, from: string, to: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("recovery_observations")
    .select("date, source, payload, coverage")
    .eq("athlete_id", athleteId)
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: true });
  if (error) {
    throw new Error(error.message);
  }
  return data ?? [];
}

export async function loadRecoveryPriority(athleteId: string): Promise<RecoverySourcePriority> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("recovery_source_preference")
    .eq("id", athleteId)
    .maybeSingle();
  return parseRecoveryPriority(data?.recovery_source_preference);
}

export async function saveRecoveryPriority(
  athleteId: string,
  priority: RecoverySourcePriority,
) {
  const admin = createAdminClient();
  const next: RecoverySourcePriority = {
    sleep: priority.sleep,
    hrv: priority.hrv,
    resting_hr: priority.resting_hr,
    pending: priority.pending ?? [],
  };
  const { error } = await admin
    .from("profiles")
    .update({ recovery_source_preference: next })
    .eq("id", athleteId);
  if (error) {
    throw new Error(error.message);
  }
  return next;
}

/** Append a recovery source without changing who is first. */
export async function registerRecoverySource(
  athleteId: string,
  source: RecoverySourceId,
) {
  const current = await loadRecoveryPriority(athleteId);
  const seeded = { ...current };
  if (
    seeded.sleep.length === 0 &&
    seeded.hrv.length === 0 &&
    seeded.resting_hr.length === 0
  ) {
    const admin = createAdminClient();
    const { data: coros } = await admin
      .from("integrations")
      .select("id")
      .eq("athlete_id", athleteId)
      .eq("provider", "coros")
      .eq("status", "connected")
      .maybeSingle();
    if (coros && source !== "coros") {
      seeded.sleep = ["coros"];
      seeded.hrv = ["coros"];
      seeded.resting_hr = ["coros"];
    }
  }

  const already =
    seeded.sleep.includes(source) ||
    seeded.hrv.includes(source) ||
    seeded.resting_hr.includes(source);
  const hadOrder =
    current.sleep.length > 0 || current.hrv.length > 0 || current.resting_hr.length > 0;

  for (const metric of RECOVERY_METRICS) {
    if (!seeded[metric].includes(source)) {
      seeded[metric] = [...seeded[metric], source];
    }
  }
  if (!already && hadOrder && !seeded.pending.includes(source)) {
    seeded.pending = [...seeded.pending, source];
  }
  await saveRecoveryPriority(athleteId, seeded);
  return seeded;
}

async function loadConnectedRecoverySources(athleteId: string): Promise<RecoverySourceId[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("integrations")
    .select("provider")
    .eq("athlete_id", athleteId)
    .eq("status", "connected")
    .in("provider", ["coros", "google_health"]);
  return (data ?? []).map((row) => row.provider);
}

export async function resolveDailyRecovery(
  athleteId: string,
  date: string,
  options?: { recast?: boolean },
) {
  const admin = createAdminClient();
  const recast = options?.recast === true;
  const [priority, connected] = await Promise.all([
    loadRecoveryPriority(athleteId),
    loadConnectedRecoverySources(athleteId),
  ]);
  const sleepOrder = connectedOrder(priority.sleep, connected);
  const hrvOrder = connectedOrder(priority.hrv, connected);
  const rhrOrder = connectedOrder(priority.resting_hr, connected);
  const stressOrder = connectedOrder(["coros"], connected);
  const { data, error } = await admin
    .from("recovery_observations")
    .select("source, payload")
    .eq("athlete_id", athleteId)
    .eq("date", date);
  if (error) {
    throw new Error(error.message);
  }
  const observations = (data ?? []).map((row) => ({
    source: row.source,
    payload: (row.payload ?? {}) as RecoverySourcePayload,
  }));

  const { data: existing } = await admin
    .from("daily_recovery")
    .select(
      "resting_hr, sleep_hrv_ms, sleep_minutes, sleep_score, stress_avg, sleep_source, hrv_source, resting_hr_source, respiratory_rate, spo2_pct, sleep_temperature_c, sleep_temperature_baseline_c, sleep_temperature_delta_c, sleep_start, sleep_end",
    )
    .eq("athlete_id", athleteId)
    .eq("date", date)
    .maybeSingle();

  const sleep = keepResolved({
    recast,
    order: sleepOrder,
    existingValue: existing?.sleep_minutes,
    existingSource: existing?.sleep_source,
    picked: pickFromPriority(observations, sleepOrder, (payload) =>
      overnightSleepMinutes(payload.sleep?.durationMinutes ?? null),
    ),
  });
  const sleepMinutes = sleep.value;
  const sleepDetail = recast
    ? pickFromPriority(observations, sleepOrder, (payload) => payload.sleep ?? null)
    : {
        value: {
          durationMinutes: existing?.sleep_minutes ?? null,
          startAt: existing?.sleep_start,
          endAt: existing?.sleep_end,
        },
        source: existing?.sleep_source ?? null,
      };

  const hrv = keepResolved({
    recast,
    order: hrvOrder,
    existingValue: existing?.sleep_hrv_ms,
    existingSource: existing?.hrv_source,
    picked: pickFromPriority(observations, hrvOrder, (payload) =>
      asNumber(payload.hrvRmssdMs),
    ),
  });
  const rhr = keepResolved({
    recast,
    order: rhrOrder,
    existingValue: existing?.resting_hr,
    existingSource: existing?.resting_hr_source,
    picked: pickFromPriority(observations, rhrOrder, (payload) =>
      asNumber(payload.restingHrBpm),
    ),
  });
  const respiratory = recast
    ? pickFromPriority(observations, hrvOrder, (payload) =>
        asNumber(payload.respiratoryRate),
      )
    : {
        value: existing?.respiratory_rate ?? null,
        source: null,
      };
  const spo2 = recast
    ? pickFromPriority(observations, sleepOrder, (payload) => asNumber(payload.spo2Pct))
    : { value: existing?.spo2_pct ?? null, source: null };
  const temperature = recast
    ? pickFromPriority(observations, sleepOrder, (payload) => payload.sleepTemperature ?? null)
    : {
        value: existing
          ? {
              nightlyC: existing.sleep_temperature_c,
              baselineC: existing.sleep_temperature_baseline_c,
              deltaC: existing.sleep_temperature_delta_c,
            }
          : null,
        source: null,
      };
  const score = pickFromPriority(observations, sleepOrder, (payload) =>
    asNumber(payload.sleepScore),
  );
  const stress = keepResolved({
    recast,
    order: stressOrder,
    existingValue: existing?.stress_avg,
    existingSource: existing?.stress_avg != null ? "coros" : null,
    picked: pickFromPriority(observations, stressOrder, (payload) =>
      asNumber(payload.stressAvg),
    ),
  });

  const coverage =
    sleepMinutes != null && hrv.value != null && rhr.value != null
      ? "complete"
      : sleepMinutes != null || hrv.value != null || rhr.value != null
        ? "partial"
        : "pending";

  const source =
    sleep.source ?? hrv.source ?? rhr.source ?? observations[0]?.source ?? "unknown";

  const { error: upsertError } = await admin.from("daily_recovery").upsert(
    {
      athlete_id: athleteId,
      date,
      source,
      coverage,
      resting_hr: rhr.value != null ? Math.round(Number(rhr.value)) : null,
      sleep_hrv_ms: hrv.value,
      sleep_minutes: sleepMinutes,
      sleep_score: recast ? score.value : existing?.sleep_score ?? score.value,
      stress_avg: stress.value,
      sleep_source: sleep.source,
      hrv_source: hrv.source,
      resting_hr_source: rhr.source,
      respiratory_rate: recast ? respiratory.value : existing?.respiratory_rate ?? respiratory.value,
      spo2_pct: recast ? spo2.value : existing?.spo2_pct ?? spo2.value,
      sleep_temperature_c: recast
        ? (temperature.value?.nightlyC ?? null)
        : existing?.sleep_temperature_c ?? temperature.value?.nightlyC ?? null,
      sleep_temperature_baseline_c: recast
        ? (temperature.value?.baselineC ?? null)
        : existing?.sleep_temperature_baseline_c ?? temperature.value?.baselineC ?? null,
      sleep_temperature_delta_c: recast
        ? (temperature.value?.deltaC ?? null)
        : existing?.sleep_temperature_delta_c ?? temperature.value?.deltaC ?? null,
      sleep_start: recast
        ? (sleepDetail.value?.startAt ?? null)
        : existing?.sleep_start ?? sleepDetail.value?.startAt ?? null,
      sleep_end: recast
        ? (sleepDetail.value?.endAt ?? null)
        : existing?.sleep_end ?? sleepDetail.value?.endAt ?? null,
    },
    { onConflict: "athlete_id,date" },
  );
  if (upsertError) {
    throw new Error(upsertError.message);
  }
  return coverage;
}

export async function resolveDailyRecoveryRange(
  athleteId: string,
  dates: string[],
  options?: { recast?: boolean },
) {
  const unique = [...new Set(dates)].sort();
  for (const date of unique) {
    await resolveDailyRecovery(athleteId, date, options);
  }
}

export async function recastRecoveryHistory(athleteId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("recovery_observations")
    .select("date")
    .eq("athlete_id", athleteId);
  if (error) {
    throw new Error(error.message);
  }
  const dates = [...new Set((data ?? []).map((row) => row.date))].sort();
  await resolveDailyRecoveryRange(athleteId, dates, { recast: true });
  if (dates[0]) {
    const { data: profile } = await admin
      .from("profiles")
      .select("timezone")
      .eq("id", athleteId)
      .maybeSingle();
    await recomputePerformanceState(
      athleteId,
      profile?.timezone || "Europe/London",
      dates[0],
    );
  }
  return dates.length;
}
