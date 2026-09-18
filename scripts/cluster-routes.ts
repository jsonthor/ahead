import { gunzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { assignActivityRoute } from "../src/lib/route/assign";
import { activityStreamPath } from "../src/lib/fit/stream";
import type { StreamPoint } from "../src/lib/fit/parse";
import { createAdminClient } from "../src/lib/supabase/admin";

function loadLocalEnv() {
  const text = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadLocalEnv();

function decodeStream(bytes: Buffer): StreamPoint[] | null {
  try {
    const json = (
      bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes
    ).toString("utf8");
    const parsed = JSON.parse(json) as unknown;
    return Array.isArray(parsed) ? (parsed as StreamPoint[]) : null;
  } catch {
    return null;
  }
}

async function main() {
  const rebuild = process.argv.includes("--rebuild");
  const admin = createAdminClient();
  if (rebuild) {
    await admin.from("activity_routes").delete().gte("created_at", "1970-01-01");
    await admin.from("route_clusters").delete().gte("created_at", "1970-01-01");
  }

  const { data: activities, error } = await admin
    .from("activities")
    .select("id, athlete_id, source_activity_id, sport, distance_m, elevation_m, started_at")
    .eq("status", "ready")
    .order("started_at", { ascending: true });
  if (error) {
    throw error;
  }

  let clustered = 0;
  let skipped = 0;
  for (const activity of activities ?? []) {
    if (!rebuild) {
      const { data: existing } = await admin
        .from("activity_routes")
        .select("route_cluster_id")
        .eq("activity_id", activity.id)
        .maybeSingle();
      if (existing?.route_cluster_id) {
        skipped += 1;
        continue;
      }
    }
    const path = activityStreamPath(activity.athlete_id, activity.source_activity_id);
    const { data: file } = await admin.storage.from("activity-streams").download(path);
    if (!file) {
      skipped += 1;
      continue;
    }
    const stream = decodeStream(Buffer.from(await file.arrayBuffer()));
    if (!stream || stream.length < 2) {
      skipped += 1;
      continue;
    }
    const clusterId = await assignActivityRoute({
      athleteId: activity.athlete_id,
      activityId: activity.id,
      sport: activity.sport,
      distanceM: activity.distance_m,
      elevationM: activity.elevation_m,
      stream,
      replace: rebuild,
    });
    if (clusterId) {
      clustered += 1;
    } else {
      skipped += 1;
    }
  }

  const { data: clusters } = await admin
    .from("route_clusters")
    .select("id, sport, attempt_count, typical_distance_m")
    .gt("attempt_count", 1)
    .order("attempt_count", { ascending: false });
  console.log(`clustered=${clustered} skipped=${skipped} repeated_routes=${clusters?.length ?? 0}`);
  for (const cluster of clusters ?? []) {
    const miles = cluster.typical_distance_m ? (cluster.typical_distance_m / 1609.344).toFixed(1) : "?";
    console.log(`  ${cluster.sport} ${miles} mi × ${cluster.attempt_count}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
