import { activityInsightEligible, isRecentActivity } from "@/lib/activity-insight/eligible";
import { generateActivityInsight } from "@/lib/activity-insight/generate";
import { buildActivityInsightPacket } from "@/lib/activity-insight/packet";
import {
  loadLatestActivityInsight,
  markInsightStale,
  saveActivityInsight,
} from "@/lib/activity-insight/store";
import { insightFingerprint } from "@/lib/activity-insight/versions";
import type { Database } from "@/lib/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient<Database>;

export async function ensureActivityInsight(input: {
  client: Client;
  athleteId: string;
  activityId: string;
  timeZone: string;
  accessToken?: string;
  regenerate?: boolean;
}) {
  const built = await buildActivityInsightPacket({
    client: input.client,
    athleteId: input.athleteId,
    activityId: input.activityId,
    timeZone: input.timeZone,
  });
  const eligible = activityInsightEligible({
    durationSeconds: built.packet.activity.durationSeconds,
    linkedToPlan: Boolean(built.packet.plannedWorkout),
    race: Boolean(built.event && built.event.intent === "race"),
  });
  if (!eligible) {
    return { insight: null, stale: false, eligible: false };
  }

  const fingerprint = insightFingerprint({
    packet: built.packet,
    formulaVersion: built.formulaVersion,
    hrModelVersion: built.hrModelVersion,
  });
  const existing = await loadLatestActivityInsight(input.client, input.activityId);
  if (existing && existing.fingerprint !== fingerprint && existing.status !== "stale") {
    await markInsightStale(input.client, existing.id);
    existing.status = "stale";
  }
  const shouldGenerate =
    input.regenerate ||
    !existing ||
    (existing.status === "stale" && isRecentActivity(built.packet.activity.startedAt));
  if (!shouldGenerate) {
    return {
      insight: existing,
      stale: existing?.status === "stale",
      eligible: true,
    };
  }

  const generated = await generateActivityInsight({
    athleteId: input.athleteId,
    activityId: input.activityId,
    packet: built.packet,
    fingerprint,
    accessToken: input.accessToken,
  });
  const insight = await saveActivityInsight(input.client, generated);
  return { insight, stale: false, eligible: true };
}
