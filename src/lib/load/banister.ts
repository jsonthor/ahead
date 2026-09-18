import { addDaysToKey, dateKeyInZone } from "@/lib/calendar";
import type { DataQuality } from "@/lib/activity";
import type { Json } from "@/lib/database.types";
import type { TrainingMix } from "@/lib/load/derive";
import {
  calculatePotentialSeries,
  isPotentialCalibration,
  recoveryDelta,
} from "@/lib/load/potential";
import {
  calculateTrainingState,
  TRAINING_STATE_VERSION,
} from "@/lib/load/training-state";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/supabase/page";

export const DAILY_FORMULA_VERSION = `${TRAINING_STATE_VERSION}+potential-v0.4`;

const UPSERT_CHUNK = 500;

type ActivityLoadRow = {
  started_at: string;
  sport: string;
  duration_seconds: number | null;
  intelligence_eligible: boolean;
  activity_metrics:
    | {
        potential_load: number | null;
        training_mix: TrainingMix | null;
        data_quality: DataQuality | null;
      }
    | {
        potential_load: number | null;
        training_mix: TrainingMix | null;
        data_quality: DataQuality | null;
      }[]
    | null;
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

function metricsOf(row: ActivityLoadRow) {
  const value = row.activity_metrics;
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value;
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
 * Banister Fatigue is load-only. Potential fatigue is strain vs accustomed
 * load, with recovery allowed to move it by at most ±20.
 */

export async function recomputeDailyLoads(athleteId: string, timeZone: string) {
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
      recoveryDelta: recoveryDelta(key, recoveryByDate, addDaysToKey),
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
