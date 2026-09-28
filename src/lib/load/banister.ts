import { addDaysToKey, dateKeyInZone } from "@/lib/calendar";
import type { DataQuality } from "@/lib/activity";
import type { Json } from "@/lib/database.types";
import type { TrainingMix } from "@/lib/load/derive";
import {
  ACUTE_TAU,
  ACCUSTOMED_TAU,
  applyRecoveryToPerformance,
  calculatePotentialSeries,
  ewmaStep,
  isPotentialCalibration,
  POTENTIAL_VERSION,
  recoveryDelta,
  strainScore,
} from "@/lib/load/potential";
import {
  calculateTrainingState,
  TRAINING_STATE_VERSION,
} from "@/lib/load/training-state";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/supabase/page";

export const DAILY_FORMULA_VERSION = `${TRAINING_STATE_VERSION}+${POTENTIAL_VERSION}`;

const UPSERT_CHUNK = 500;

type ActivityLoadRow = {
  started_at: string;
  sport: string;
  duration_seconds: number | null;
  intelligence_eligible: boolean;
  activity_metrics: {
    potential_load: number | null;
    training_mix: Json;
    data_quality: string | null;
  } | null;
};

type RecoveryRow = {
  date: string;
  resting_hr: number | null;
  sleep_minutes: number | null;
  sleep_hrv_ms?: number | null;
  hrv_ms?: number | null;
  stress_avg?: number | null;
  stress?: number | null;
};

type DayLoad = {
  load: number;
  cyclingEasy: number;
  cyclingSpecific: number;
  cyclingHigh: number;
  otherAerobic: number;
  rich: number;
  good: number;
  estimated: number;
};

function isCycling(sport: string) {
  return sport === "ride";
}

function isOtherAerobic(sport: string) {
  return sport === "run" || sport === "swim" || sport === "walk" || sport === "other";
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function asMix(value: Json): TrainingMix | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const row = value as {
    easy_seconds?: unknown;
    specific_seconds?: unknown;
    high_seconds?: unknown;
  };
  return {
    easy_seconds: Number(row.easy_seconds) || 0,
    specific_seconds: Number(row.specific_seconds) || 0,
    high_seconds: Number(row.high_seconds) || 0,
  };
}

function metricsOf(row: ActivityLoadRow) {
  const value = row.activity_metrics;
  if (!value) {
    return null;
  }
  return {
    potential_load: value.potential_load,
    training_mix: asMix(value.training_mix),
    data_quality: value.data_quality,
  };
}

function dayQuality(day: DayLoad): DataQuality | null {
  if (day.load <= 0) {
    return null;
  }
  if (day.rich >= day.good && day.rich >= day.estimated) {
    return "rich";
  }
  if (day.good >= day.estimated) {
    return "good";
  }
  return "estimated";
}

function emptyDay(): DayLoad {
  return {
    load: 0,
    cyclingEasy: 0,
    cyclingSpecific: 0,
    cyclingHigh: 0,
    otherAerobic: 0,
    rich: 0,
    good: 0,
    estimated: 0,
  };
}

/**
 * Banister Fitness / Fatigue / Form and aerobic / specific capacity are
 * load-only. Recovery never manufactures training load.
 *
 * Strain and Performance apply a recovery adjustment on top of that
 * load-derived strain. Call recomputePerformanceState when recovery
 * changes; call recomputeTrainingState / advanceTrainingStateToDate
 * when recorded load or the calendar date changes.
 */

export async function recomputeTrainingState(athleteId: string, timeZone: string) {
  const admin = createAdminClient();
  const data = await fetchAllRows<ActivityLoadRow>((from, to) =>
    admin
      .from("activities")
      .select(
        "started_at, sport, duration_seconds, intelligence_eligible, activity_metrics(potential_load, training_mix, data_quality)",
      )
      .eq("athlete_id", athleteId)
      .eq("intelligence_eligible", true)
      .order("started_at", { ascending: true })
      .range(from, to),
  );
  const byDate = new Map<string, DayLoad>();
  for (const row of data) {
    const key = dateKeyInZone(new Date(row.started_at), timeZone);
    const metrics = metricsOf(row);
    const current = byDate.get(key) ?? emptyDay();
    const load = metrics?.potential_load ?? 0;
    current.load += load;
    const mix = metrics?.training_mix;
    const duration =
      row.duration_seconds ??
      (mix?.easy_seconds ?? 0) + (mix?.specific_seconds ?? 0) + (mix?.high_seconds ?? 0);
    if (isCycling(row.sport)) {
      current.cyclingEasy += mix?.easy_seconds ?? 0;
      current.cyclingSpecific += mix?.specific_seconds ?? 0;
      current.cyclingHigh += mix?.high_seconds ?? 0;
    } else if (isOtherAerobic(row.sport)) {
      current.otherAerobic += duration;
    }
    const quality = metrics?.data_quality;
    if (quality === "rich" || quality === "good" || quality === "estimated") {
      current[quality] += load;
    } else {
      current.estimated += load;
    }
    byDate.set(key, current);
  }

  const today = dateKeyInZone(new Date(), timeZone);
  if (byDate.size === 0) {
    await admin.from("daily_loads").delete().eq("athlete_id", athleteId);
    return 0;
  }

  const start = [...byDate.keys()].sort()[0] ?? today;
  const series: { date: string; load: number }[] = [];
  const potentialDays: {
    date: string;
    cyclingZ12Hours: number;
    cyclingZ34Hours: number;
    cyclingZ5Hours: number;
    otherAerobicHours: number;
    load: number;
    recoveryDelta: number;
  }[] = [];
  for (let key = start; key <= today; key = addDaysToKey(key, 1)) {
    const mix = byDate.get(key) ?? emptyDay();
    series.push({ date: key, load: mix.load });
    potentialDays.push({
      date: key,
      cyclingZ12Hours: mix.cyclingEasy / 3600,
      cyclingZ34Hours: mix.cyclingSpecific / 3600,
      cyclingZ5Hours: mix.cyclingHigh / 3600,
      otherAerobicHours: mix.otherAerobic / 3600,
      load: mix.load,
      recoveryDelta: 0,
    });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("potential_calibration")
    .eq("id", athleteId)
    .maybeSingle();
  const storedCalibration = profile?.potential_calibration;
  const existingCalibration = isPotentialCalibration(storedCalibration)
    ? storedCalibration
    : null;
  const potentialState = calculatePotentialSeries(potentialDays, existingCalibration);
  if (potentialState.freeze) {
    const { error: calibrationError } = await admin
      .from("profiles")
      .update({ potential_calibration: potentialState.calibration as unknown as Json })
      .eq("id", athleteId);
    if (calibrationError) {
      throw calibrationError;
    }
  }
  const potentialByDate = new Map(potentialState.series.map((row) => [row.date, row]));

  const state = calculateTrainingState(series, { status: "actual" });
  const rows = state.map((day) => {
    const mix = byDate.get(day.date) ?? emptyDay();
    const potential = potentialByDate.get(day.date);
    return {
      athlete_id: athleteId,
      date: day.date,
      training_load: day.load,
      fitness: day.fitness,
      fatigue: day.fatigue,
      form: day.form,
      aerobic_reserve: round1(potential?.aerobic_reserve ?? 0),
      specific_capacity: round1(potential?.specific_capacity ?? 0),
      aerobic_raw: potential?.aerobic_raw ?? null,
      specific_raw: potential?.specific_raw ?? null,
      acute_fatigue: round1(potential?.acute_fatigue ?? 0),
      development: null,
      potential: round1(potential?.potential ?? 0),
      race_readiness: round1(clamp(50 + day.form)),
      data_quality: dayQuality(mix),
      status: day.status,
      formula_version: DAILY_FORMULA_VERSION,
    };
  });

  if (rows.length === 0) {
    return 0;
  }
  await admin.from("daily_loads").delete().eq("athlete_id", athleteId).lt("date", start);
  await admin.from("daily_loads").delete().eq("athlete_id", athleteId).gt("date", today);
  for (let index = 0; index < rows.length; index += UPSERT_CHUNK) {
    const { error: upsertError } = await admin
      .from("daily_loads")
      .upsert(rows.slice(index, index + UPSERT_CHUNK), {
        onConflict: "athlete_id,date",
      });
    if (upsertError) {
      throw upsertError;
    }
  }
  return rows.length;
}

async function loadRecoveryByDate(athleteId: string) {
  const admin = createAdminClient();
  const recovery = await fetchAllRows<RecoveryRow>((from, to) =>
    admin
      .from("daily_recovery")
      .select("date, resting_hr, sleep_minutes, sleep_hrv_ms, stress_avg")
      .eq("athlete_id", athleteId)
      .order("date", { ascending: true })
      .range(from, to),
  );
  const recoveryByDate = new Map(
    recovery.map((row) => [
      row.date,
      {
        resting_hr: row.resting_hr,
        sleep_minutes: row.sleep_minutes,
        hrv_ms: row.sleep_hrv_ms ?? row.hrv_ms ?? null,
        stress: row.stress_avg ?? row.stress ?? null,
      },
    ]),
  );
  if (recoveryByDate.size === 0) {
    const wellness = await fetchAllRows<RecoveryRow>((from, to) =>
      admin
        .from("wellness_days")
        .select("date, resting_hr, sleep_minutes, hrv_ms, stress")
        .eq("athlete_id", athleteId)
        .order("date", { ascending: true })
        .range(from, to),
    );
    for (const row of wellness) {
      recoveryByDate.set(row.date, {
        resting_hr: row.resting_hr,
        sleep_minutes: row.sleep_minutes,
        hrv_ms: row.hrv_ms ?? null,
        stress: row.stress ?? null,
      });
    }
  }
  return recoveryByDate;
}

/**
 * Refresh Strain and Performance from canonical recovery. Does not rewrite
 * Fitness, Fatigue, Form, aerobic capacity, or specific capacity.
 */
export async function recomputePerformanceState(
  athleteId: string,
  timeZone: string,
  fromDate?: string,
) {
  const admin = createAdminClient();
  const today = dateKeyInZone(new Date(), timeZone);
  const rows = await fetchAllRows<{
    date: string;
    training_load: number | null;
    aerobic_reserve: number | null;
    specific_capacity: number | null;
    potential: number | null;
    acute_fatigue: number | null;
  }>((from, to) =>
    admin
      .from("daily_loads")
      .select("date, training_load, aerobic_reserve, specific_capacity, potential, acute_fatigue")
      .eq("athlete_id", athleteId)
      .neq("status", "forecast")
      .lte("date", today)
      .order("date", { ascending: true })
      .range(from, to),
  );
  if (rows.length === 0) {
    return 0;
  }
  const { data: profile } = await admin
    .from("profiles")
    .select("potential_calibration")
    .eq("id", athleteId)
    .maybeSingle();
  const calibration = isPotentialCalibration(profile?.potential_calibration)
    ? profile.potential_calibration
    : null;
  if (!calibration) {
    return 0;
  }
  const recoveryByDate = await loadRecoveryByDate(athleteId);
  let acute: number | null = null;
  let acc: number | null = null;
  let updated = 0;
  for (const row of rows) {
    const load = row.training_load ?? 0;
    acute = ewmaStep(acute, load, ACUTE_TAU);
    acc = ewmaStep(acc, load, ACCUSTOMED_TAU);
    if (fromDate && row.date < fromDate) {
      continue;
    }
    const loadStrain = strainScore(acute, acc);
    const delta = recoveryDelta(row.date, recoveryByDate, addDaysToKey);
    const next = applyRecoveryToPerformance({
      aerobicReserve: row.aerobic_reserve ?? 0,
      specificCapacity: row.specific_capacity ?? 0,
      loadStrain,
      recoveryDelta: delta,
      calibration,
    });
    const acuteFatigue = round1(next.acute_fatigue);
    const potential = round1(next.potential);
    if (row.acute_fatigue === acuteFatigue && row.potential === potential) {
      continue;
    }
    const { error } = await admin
      .from("daily_loads")
      .update({
        acute_fatigue: acuteFatigue,
        potential,
      })
      .eq("athlete_id", athleteId)
      .eq("date", row.date);
    if (error) {
      throw error;
    }
    updated += 1;
  }
  return updated;
}

export async function recomputeDailyLoads(athleteId: string, timeZone: string) {
  const days = await recomputeTrainingState(athleteId, timeZone);
  if (days > 0) {
    await recomputePerformanceState(athleteId, timeZone);
  }
  return days;
}

/** recordedLoad = 0 means no file yet, not a confirmed rest day. */
export async function advanceTrainingStateToDate(
  athleteId: string,
  timeZone: string,
  targetDate?: string,
) {
  const today = targetDate ?? dateKeyInZone(new Date(), timeZone);
  const admin = createAdminClient();
  const { data: last } = await admin
    .from("daily_loads")
    .select("date")
    .eq("athlete_id", athleteId)
    .neq("status", "forecast")
    .lte("date", today)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (last?.date && last.date >= today) {
    return { advanced: 0, last: last.date };
  }
  const days = await recomputeTrainingState(athleteId, timeZone);
  const fromDate = last?.date ? addDaysToKey(last.date, 1) : undefined;
  if (days > 0) {
    await recomputePerformanceState(athleteId, timeZone, fromDate);
  }
  return { advanced: days, last: last?.date ?? null };
}

export async function advanceAllAthleteTrainingState() {
  const admin = createAdminClient();
  const profiles = await fetchAllRows<{ id: string; timezone: string }>((from, to) =>
    admin.from("profiles").select("id, timezone").range(from, to),
  );
  const results: Array<{ athleteId: string; advanced: number }> = [];
  for (const profile of profiles) {
    const next = await advanceTrainingStateToDate(
      profile.id,
      profile.timezone || "Europe/London",
    );
    results.push({ athleteId: profile.id, advanced: next.advanced });
  }
  return results;
}
