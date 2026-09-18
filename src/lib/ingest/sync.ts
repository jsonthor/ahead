import { createAdminClient } from "@/lib/supabase/admin";

export async function recordIntegrationSync(input: {
  athleteId: string;
  provider: string;
  startedAt: Date;
  status: "ok" | "error";
  activitiesSaved?: number;
  recoveryDays?: number;
  message?: string;
}) {
  const admin = createAdminClient();
  const finishedAt = new Date().toISOString();
  const { error } = await admin.from("integration_syncs").insert({
    athlete_id: input.athleteId,
    provider: input.provider,
    started_at: input.startedAt.toISOString(),
    finished_at: finishedAt,
    status: input.status,
    activities_saved: input.activitiesSaved ?? null,
    recovery_days: input.recoveryDays ?? null,
    message: input.message?.slice(0, 400) ?? null,
  });
  if (error) {
    console.error("integration_syncs insert failed", error);
  }
}
