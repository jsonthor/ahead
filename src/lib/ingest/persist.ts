import { gzipSync } from "node:zlib";
import type { MappedActivity } from "@/lib/coros/map";
import type { Json } from "@/lib/database.types";
import { activityStreamPath } from "@/lib/fit/stream";
import type { StreamPoint } from "@/lib/fit/parse";
import { deriveActivityMetrics } from "@/lib/load/derive";
import { assignActivityRoute } from "@/lib/route/assign";
import { createAdminClient } from "@/lib/supabase/admin";

export async function storeOriginalFile(input: {
  athleteId: string;
  sourceActivityId: string;
  bytes: Buffer;
  extension: "fit" | "gpx" | "tcx";
}) {
  const admin = createAdminClient();
  const path = `${input.athleteId}/${input.sourceActivityId}.${input.extension}`;
  const { error } = await admin.storage.from("activity-originals").upload(path, input.bytes, {
    contentType: "application/octet-stream",
    upsert: true,
  });
  if (error) {
    throw error;
  }
  return path;
}

export async function storeActivityStream(input: {
  athleteId: string;
  sourceActivityId: string;
  stream: StreamPoint[];
}) {
  if (input.stream.length === 0) {
    return null;
  }
  const admin = createAdminClient();
  const path = activityStreamPath(input.athleteId, input.sourceActivityId);
  const body = gzipSync(Buffer.from(JSON.stringify(input.stream)));
  const { error } = await admin.storage.from("activity-streams").upload(path, body, {
    contentType: "application/gzip",
    upsert: true,
  });
  if (error) {
    throw error;
  }
  return path;
}

export async function upsertImportedActivity(
  athleteId: string,
  activity: MappedActivity,
  extra: { raw_fit_key?: string | null },
) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("activities")
    .upsert(
      {
        athlete_id: athleteId,
        ...activity,
        ...(extra.raw_fit_key !== undefined ? { raw_fit_key: extra.raw_fit_key } : {}),
        status: "ready",
      },
      { onConflict: "athlete_id,source,source_activity_id" },
    )
    .select("id, raw_fit_key")
    .single();
  if (error) {
    throw error;
  }
  return data;
}

export async function upsertImportedMetrics(
  activityId: string,
  activity: MappedActivity,
  stream: StreamPoint[] | undefined,
  extra?: {
    hrMax?: number | null;
    hasFit?: boolean;
    hasLaps?: boolean;
    laps?: {
      duration_seconds: number | null;
      avg_hr: number | null;
      avg_power: number | null;
    }[];
  },
) {
  const metrics = deriveActivityMetrics({
    sport: activity.sport,
    durationSeconds: activity.duration_seconds,
    distanceM: activity.distance_m,
    avgHr: activity.avg_hr,
    avgPower: activity.avg_power,
    normalizedPower: activity.normalized_power,
    avgSpeedMps: activity.avg_speed_mps,
    stream,
    hrMax: extra?.hrMax ?? activity.max_hr,
    hasFit: extra?.hasFit,
    hasLaps: extra?.hasLaps || (extra?.laps?.length ?? 0) > 0,
    laps: extra?.laps?.map((lap) => ({
      durationSeconds: lap.duration_seconds,
      avgHr: lap.avg_hr,
      avgPower: lap.avg_power,
    })),
  });
  const admin = createAdminClient();
  const { error } = await admin.from("activity_metrics").upsert({
    activity_id: activityId,
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
  if (error) {
    throw error;
  }
  return metrics;
}

export async function replaceImportedLaps(
  activityId: string,
  athleteId: string,
  laps: {
    source_index: number;
    started_at: string | null;
    duration_seconds: number | null;
    distance_m: number | null;
    avg_hr: number | null;
    avg_power: number | null;
  }[],
) {
  if (laps.length === 0) {
    return;
  }
  const admin = createAdminClient();
  await admin.from("activity_laps").delete().eq("activity_id", activityId);
  const { error } = await admin.from("activity_laps").insert(
    laps.map((lap) => ({
      activity_id: activityId,
      athlete_id: athleteId,
      ...lap,
    })),
  );
  if (error) {
    console.error("Uploaded activity lap insert failed", error);
  }
}

export async function assignImportedRoute(input: {
  athleteId: string;
  activityId: string;
  sport: string;
  distanceM: number | null;
  elevationM: number | null;
  stream: StreamPoint[] | undefined;
}) {
  if (!input.stream || input.stream.length < 2) {
    return;
  }
  try {
    await assignActivityRoute({
      athleteId: input.athleteId,
      activityId: input.activityId,
      sport: input.sport,
      distanceM: input.distanceM,
      elevationM: input.elevationM,
      stream: input.stream,
    });
  } catch (error) {
    console.error("Activity route clustering failed", error);
  }
}
