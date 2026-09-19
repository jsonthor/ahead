import { openCorosClient } from "@/lib/coros/connect";
import { importRecentCorosActivities } from "@/lib/coros/import";
import { COROS_SYNC_STALE_MS, type ImportProgress } from "@/lib/coros/progress";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/site";

export { COROS_SYNC_STALE_MS };

export async function syncCorosAthlete(input: {
  origin: string;
  athleteId: string;
  onProgress?: (progress: ImportProgress) => void | Promise<void>;
}) {
  const session = await openCorosClient({
    origin: input.origin,
    athleteId: input.athleteId,
    returnPath: "/app",
  });
  if ("unauthorized" in session && session.unauthorized) {
    return { status: "reauth" as const };
  }
  const imported = await importRecentCorosActivities({
    client: session.client,
    athleteId: input.athleteId,
    onProgress: input.onProgress,
  });
  await session.client.close();
  return { status: "ok" as const, imported };
}

export async function syncAllConnectedCoros(origin = SITE_URL) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("integrations")
    .select("athlete_id, last_sync_at")
    .eq("provider", "coros")
    .eq("status", "connected");
  if (error) {
    throw new Error(error.message);
  }

  const results: Array<{
    athleteId: string;
    status: "ok" | "reauth" | "skipped" | "error";
    message?: string;
  }> = [];

  for (const row of data ?? []) {
    const last = row.last_sync_at ? Date.parse(row.last_sync_at) : 0;
    if (last && Date.now() - last < COROS_SYNC_STALE_MS) {
      results.push({ athleteId: row.athlete_id, status: "skipped" });
      continue;
    }
    try {
      const next = await syncCorosAthlete({
        origin,
        athleteId: row.athlete_id,
      });
      results.push({ athleteId: row.athlete_id, status: next.status });
    } catch (caught) {
      results.push({
        athleteId: row.athlete_id,
        status: "error",
        message: caught instanceof Error ? caught.message : "Import failed.",
      });
    }
  }

  return results;
}
