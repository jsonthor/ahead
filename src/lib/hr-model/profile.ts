import { dateKeyInZone } from "@/lib/calendar";
import { noticesAsJson, parseZoneNotices, type ZoneNotice } from "@/lib/hr-model/notice";
import { isPlausibleLthr, isPlausibleHrMax } from "@/lib/hr-model/observe";
import { resolveHrModel } from "@/lib/hr-model/resolve";
import { loadHrModelHistory, writeHrModelVersion } from "@/lib/hr-model/store";
import type { HrModel } from "@/lib/hr-model/types";
import { recomputeAthleteSummaryLoads } from "@/lib/load/recompute";
import { createAdminClient } from "@/lib/supabase/admin";

export type ZoneSnapshot = {
  applied: {
    hrMax: number | null;
    cyclingLthr: number | null;
    runningLthr: number | null;
    hrMaxSource: HrModel["source"];
    cyclingSource: HrModel["thresholdSource"];
    runningSource: HrModel["thresholdSource"];
    hrMaxConfidence: HrModel["confidence"];
    thresholdConfidence: HrModel["thresholdConfidence"];
  };
  estimated: {
    hrMax: number | null;
    cyclingLthr: number | null;
    runningLthr: number | null;
  };
  notices: ZoneNotice[];
  sessionCount: number;
};

function estimatedFromHistory(history: Awaited<ReturnType<typeof loadHrModelHistory>>) {
  const observed = [...history].reverse().find((row) => row.source === "observed");
  return {
    hrMax: observed?.hr_max ?? null,
    cyclingLthr: observed?.cycling_lthr ?? null,
    runningLthr: observed?.running_lthr ?? null,
  };
}

export async function loadZoneSnapshot(athleteId: string, today: string): Promise<ZoneSnapshot> {
  const admin = createAdminClient();
  const [applied, history, profile, countResult] = await Promise.all([
    resolveHrModel(athleteId, today),
    loadHrModelHistory(athleteId),
    admin.from("profiles").select("hr_zone_notices").eq("id", athleteId).maybeSingle(),
    admin
      .from("activities")
      .select("id", { count: "exact", head: true })
      .eq("athlete_id", athleteId)
      .eq("intelligence_eligible", true),
  ]);
  return {
    applied: {
      hrMax: applied.hrMax,
      cyclingLthr: applied.cyclingLthr,
      runningLthr: applied.runningLthr,
      hrMaxSource: applied.source,
      cyclingSource:
        history.find((row) => row.cycling_lthr === applied.cyclingLthr)?.threshold_source ??
        applied.thresholdSource,
      runningSource:
        history.find((row) => row.running_lthr === applied.runningLthr)?.threshold_source ??
        applied.thresholdSource,
      hrMaxConfidence: applied.confidence,
      thresholdConfidence: applied.thresholdConfidence,
    },
    estimated: estimatedFromHistory(history),
    notices: parseZoneNotices(profile.data?.hr_zone_notices),
    sessionCount: countResult.count ?? 0,
  };
}

function optionalBpm(value: unknown, kind: "max" | "threshold") {
  if (value == null || value === "") {
    return null;
  }
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    throw new Error("Heart-rate values have to be numbers.");
  }
  const rounded = Math.round(n);
  if (kind === "max" && !isPlausibleHrMax(rounded)) {
    throw new Error("Maximum heart rate should be between 140 and 220.");
  }
  if (kind === "threshold" && !isPlausibleLthr(rounded)) {
    throw new Error("Threshold heart rate should be between 140 and 210.");
  }
  return rounded;
}

export type ZoneSaveProgress = {
  phase: "saving" | "sessions" | "daily" | "done" | "error";
  message: string;
  processed: number;
  total: number;
  snapshot?: ZoneSnapshot;
  error?: string;
};

export async function saveAthleteZones(input: {
  athleteId: string;
  timeZone: string;
  hrMax: unknown;
  cyclingLthr: unknown;
  runningLthr: unknown;
  onProgress?: (progress: ZoneSaveProgress) => void | Promise<void>;
}) {
  const today = dateKeyInZone(new Date(), input.timeZone);
  const current = await resolveHrModel(input.athleteId, today);
  const hrMax = optionalBpm(input.hrMax, "max") ?? current.hrMax;
  if (hrMax == null) {
    throw new Error("Ahead needs a maximum heart rate before zones can be saved.");
  }
  const cyclingLthr = optionalBpm(input.cyclingLthr, "threshold");
  const runningLthr = optionalBpm(input.runningLthr, "threshold");
  if (cyclingLthr != null && cyclingLthr > hrMax - 3) {
    throw new Error("Cycling threshold should sit a few beats below maximum heart rate.");
  }
  if (runningLthr != null && runningLthr > hrMax - 3) {
    throw new Error("Running threshold should sit a few beats below maximum heart rate.");
  }
  await input.onProgress?.({
    phase: "saving",
    message: "Saving your zones…",
    processed: 0,
    total: 0,
  });
  await writeHrModelVersion({
    athleteId: input.athleteId,
    hrMax,
    source: "manual",
    confidence: "high",
    validFrom: today,
    cyclingLthr,
    runningLthr,
    thresholdSource: cyclingLthr != null || runningLthr != null ? "manual" : null,
    thresholdConfidence: cyclingLthr != null || runningLthr != null ? "high" : null,
  });
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("hr_zone_notices")
    .eq("id", input.athleteId)
    .maybeSingle();
  const notices = parseZoneNotices(data?.hr_zone_notices).map((notice) => ({
    ...notice,
    dismissed: true,
  }));
  await admin
    .from("profiles")
    .update({ hr_zone_notices: noticesAsJson(notices) })
    .eq("id", input.athleteId);
  await recomputeAthleteSummaryLoads(input.athleteId, input.timeZone, {
    refreshModel: false,
    onProgress: async (progress) => {
      if (progress.phase === "daily") {
        await input.onProgress?.({
          phase: "daily",
          message: "Updating Fitness, Fatigue, and Readiness…",
          processed: progress.processed,
          total: progress.total,
        });
        return;
      }
      await input.onProgress?.({
        phase: "sessions",
        message: `Recalculating intensity on ${progress.processed} of ${progress.total} sessions…`,
        processed: progress.processed,
        total: progress.total,
      });
    },
  });
  const snapshot = await loadZoneSnapshot(input.athleteId, today);
  await input.onProgress?.({
    phase: "done",
    message: "Zones updated.",
    processed: snapshot.sessionCount,
    total: snapshot.sessionCount,
    snapshot,
  });
  return snapshot;
}
