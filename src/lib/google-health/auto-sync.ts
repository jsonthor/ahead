import { COROS_SYNC_STALE_MS } from "@/lib/coros/progress";
import { GoogleHealthAuthError } from "@/lib/google-health/client";
import { GOOGLE_HEALTH_PROVIDER } from "@/lib/google-health/types";
import { syncGoogleHealthRecovery } from "@/lib/google-health/sync";
import { createAdminClient } from "@/lib/supabase/admin";

export async function syncAllConnectedGoogleHealth() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("integrations")
    .select("athlete_id, last_sync_at")
    .eq("provider", GOOGLE_HEALTH_PROVIDER)
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

    const { data: profile } = await admin
      .from("profiles")
      .select("timezone")
      .eq("id", row.athlete_id)
      .maybeSingle();

    try {
      await syncGoogleHealthRecovery({
        athleteId: row.athlete_id,
        timeZone: profile?.timezone ?? undefined,
      });
      results.push({ athleteId: row.athlete_id, status: "ok" });
    } catch (caught) {
      if (caught instanceof GoogleHealthAuthError) {
        results.push({ athleteId: row.athlete_id, status: "reauth" });
        continue;
      }
      results.push({
        athleteId: row.athlete_id,
        status: "error",
        message: caught instanceof Error ? caught.message : "Recovery sync failed.",
      });
    }
  }

  return results;
}
