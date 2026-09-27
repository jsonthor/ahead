import { dateKeyInZone } from "@/lib/calendar";
import { GoogleHealthAuthError } from "@/lib/google-health/client";
import { backfillWindow, fetchGoogleRecovery } from "@/lib/google-health/map-recovery";
import { GOOGLE_HEALTH_PROVIDER } from "@/lib/google-health/types";
import type { ImportProgress } from "@/lib/coros/progress";
import {
  saveRecoveryObservation,
  resolveDailyRecoveryRange,
} from "@/lib/recovery/source";
import { createAdminClient } from "@/lib/supabase/admin";

export async function syncGoogleHealthRecovery(input: {
  athleteId: string;
  timeZone?: string;
  onProgress?: (progress: ImportProgress) => void;
}) {
  const timezone = input.timeZone || "Europe/London";
  const today = dateKeyInZone(new Date(), timezone);
  const { from, toExclusive } = backfillWindow(today);
  input.onProgress?.({
    phase: "wellness",
    message: "Getting overnight recovery from Google Health…",
    processed: 0,
    total: 0,
    saved: 0,
  });

  const days = await fetchGoogleRecovery(input.athleteId, from, toExclusive);
  const dates = [...days.keys()].sort();
  let saved = 0;
  for (const date of dates) {
    const payload = days.get(date);
    if (!payload) {
      continue;
    }
    await saveRecoveryObservation({
      athleteId: input.athleteId,
      date,
      source: GOOGLE_HEALTH_PROVIDER,
      payload,
    });
    saved += 1;
    input.onProgress?.({
      phase: "wellness",
      message: "Saving overnight recovery…",
      processed: saved,
      total: dates.length,
      saved,
    });
  }
  await resolveDailyRecoveryRange(input.athleteId, dates);

  const admin = createAdminClient();
  const finished = new Date().toISOString();
  await admin
    .from("integrations")
    .update({ last_sync_at: finished })
    .eq("athlete_id", input.athleteId)
    .eq("provider", GOOGLE_HEALTH_PROVIDER);
  await admin.from("integration_syncs").insert({
    athlete_id: input.athleteId,
    provider: GOOGLE_HEALTH_PROVIDER,
    started_at: finished,
    finished_at: finished,
    status: "ok",
    recovery_days: saved,
    activities_saved: 0,
    message: "Recovery only. No workouts imported.",
  });

  input.onProgress?.({
    phase: "done",
    message:
      saved > 0
        ? `Google Health synced · ${saved} recovery days`
        : "Google Health is connected. No overnight data yet.",
    processed: saved,
    total: saved,
    saved,
  });
  return { saved };
}

export { GoogleHealthAuthError };
