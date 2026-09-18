import type { Json } from "@/lib/database.types";
import { deriveActivityMetrics } from "@/lib/load/derive";
import { recomputeDailyLoads } from "@/lib/load/banister";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/supabase/page";
import type { WorkoutSport } from "@/lib/workout";

type ActivitySummaryRow = {
  id: string;
  sport: string;
  duration_seconds: number | null;
  distance_m: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  avg_power: number | null;
  normalized_power: number | null;
  avg_speed_mps: number | null;
  rpe: number | null;
  session_type: string | null;
  raw_fit_key: string | null;
};

type LapRow = {
  activity_id: string;
  duration_seconds: number | null;
  avg_hr: number | null;
  avg_power: number | null;
};

export async function recomputeAthleteSummaryLoads(athleteId: string, timeZone: string) {
  const admin = createAdminClient();
  const data = await fetchAllRows<ActivitySummaryRow>((from, to) =>
    admin
      .from("activities")
      .select(
        "id, sport, duration_seconds, distance_m, avg_hr, max_hr, avg_power, normalized_power, avg_speed_mps, rpe, session_type, raw_fit_key",
      )
      .eq("athlete_id", athleteId)
      .eq("intelligence_eligible", true)
      .range(from, to),
  );
  const laps = await fetchAllRows<LapRow>((from, to) =>
    admin
      .from("activity_laps")
      .select("activity_id, duration_seconds, avg_hr, avg_power")
      .eq("athlete_id", athleteId)
      .range(from, to),
  );
  const lapsByActivity = new Map<string, LapRow[]>();
  for (const lap of laps) {
    const current = lapsByActivity.get(lap.activity_id) ?? [];
    current.push(lap);
    lapsByActivity.set(lap.activity_id, current);
  }
  for (const row of data) {
    const activityLaps = lapsByActivity.get(row.id) ?? [];
    const metrics = deriveActivityMetrics({
      sport: row.sport as WorkoutSport,
      durationSeconds: row.duration_seconds,
      distanceM: row.distance_m,
      avgHr: row.avg_hr,
      avgPower: row.avg_power,
      normalizedPower: row.normalized_power,
      avgSpeedMps: row.avg_speed_mps,
      rpe: row.rpe,
      sessionType: row.session_type,
      hrMax: row.max_hr,
      hasFit: Boolean(row.raw_fit_key),
      hasLaps: activityLaps.length > 0,
      laps: activityLaps.map((lap) => ({
        durationSeconds: lap.duration_seconds,
        avgHr: lap.avg_hr,
        avgPower: lap.avg_power,
      })),
    });
    const { error: upsertError } = await admin.from("activity_metrics").upsert({
      activity_id: row.id,
      potential_load: metrics.potential_load,
      intensity: metrics.intensity,
      aerobic_load: metrics.aerobic_load,
      specific_load: metrics.specific_load,
      hr_zone_seconds: metrics.hr_zone_seconds as unknown as Json,
      training_mix: metrics.training_mix as unknown as Json,
      load_method: metrics.load_method,
      data_quality: metrics.data_quality,
      capabilities: metrics.capabilities as unknown as Json,
      formula_version: metrics.formula_version,
    });
    if (upsertError) {
      console.error("Summary load upsert failed", { id: row.id, upsertError });
    }
  }
  return recomputeDailyLoads(athleteId, timeZone);
}

export async function recomputeAllAthleteDailyLoads() {
  const admin = createAdminClient();
  const profiles = await fetchAllRows<{ id: string; timezone: string }>((from, to) =>
    admin.from("profiles").select("id, timezone").range(from, to),
  );
  const results: { athleteId: string; days: number }[] = [];
  for (const profile of profiles) {
    const days = await recomputeDailyLoads(
      profile.id,
      profile.timezone || "Europe/London",
    );
    results.push({ athleteId: profile.id, days });
  }
  return results;
}

export async function recomputeAllAthleteSummaryLoads() {
  const admin = createAdminClient();
  const profiles = await fetchAllRows<{ id: string; timezone: string }>((from, to) =>
    admin.from("profiles").select("id, timezone").range(from, to),
  );
  const results: { athleteId: string; days: number }[] = [];
  for (const profile of profiles) {
    const days = await recomputeAthleteSummaryLoads(
      profile.id,
      profile.timezone || "Europe/London",
    );
    results.push({ athleteId: profile.id, days });
  }
  return results;
}
