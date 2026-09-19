import { dateKeyInZone } from "@/lib/calendar";
import { readActivityStream } from "@/lib/fit/stream-store";
import { activityMetricsWrite } from "@/lib/ingest/persist";
import { loadHrModelHistory } from "@/lib/hr-model/store";
import {
  refreshAthleteHrModelHistory,
  resolveHrModelFromHistory,
} from "@/lib/hr-model/resolve";
import { deriveActivityMetrics } from "@/lib/load/derive";
import { recomputeDailyLoads } from "@/lib/load/banister";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/supabase/page";
import type { WorkoutSport } from "@/lib/workout";

type ActivitySummaryRow = {
  id: string;
  source_activity_id: string;
  started_at: string;
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

export type RecomputeProgress = {
  phase: "sessions" | "daily";
  processed: number;
  total: number;
};

export async function recomputeAthleteSummaryLoads(
  athleteId: string,
  timeZone: string,
  options?: {
    refreshModel?: boolean;
    onProgress?: (progress: RecomputeProgress) => void | Promise<void>;
  },
) {
  if (options?.refreshModel !== false) {
    await refreshAthleteHrModelHistory(athleteId, timeZone);
  }
  const admin = createAdminClient();
  const data = await fetchAllRows<ActivitySummaryRow>((from, to) =>
    admin
      .from("activities")
      .select(
        "id, source_activity_id, started_at, sport, duration_seconds, distance_m, avg_hr, max_hr, avg_power, normalized_power, avg_speed_mps, rpe, session_type, raw_fit_key",
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
  const history = await loadHrModelHistory(athleteId);
  let processed = 0;
  for (const row of data) {
    const activityDate = dateKeyInZone(new Date(row.started_at), timeZone);
    const hrModel = resolveHrModelFromHistory(history, activityDate);
    const stream = await readActivityStream({
      athleteId,
      sourceActivityId: row.source_activity_id,
    });
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
      stream: stream ?? undefined,
      hrModel,
      sessionMaxHr: row.max_hr,
      hasFit: Boolean(row.raw_fit_key),
      hasLaps: activityLaps.length > 0,
      laps: activityLaps.map((lap) => ({
        durationSeconds: lap.duration_seconds,
        avgHr: lap.avg_hr,
        avgPower: lap.avg_power,
      })),
    });
    const { error: upsertError } = await admin
      .from("activity_metrics")
      .upsert(activityMetricsWrite(row.id, metrics));
    if (upsertError) {
      console.error("Summary load upsert failed", { id: row.id, upsertError });
    }
    processed += 1;
    if (processed === 1 || processed === data.length || processed % 5 === 0) {
      await options?.onProgress?.({
        phase: "sessions",
        processed,
        total: data.length,
      });
    }
  }
  await options?.onProgress?.({
    phase: "daily",
    processed: data.length,
    total: data.length,
  });
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
