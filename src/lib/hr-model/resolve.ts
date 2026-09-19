import { dateKeyInZone } from "@/lib/calendar";
import {
  deriveObservedHrMax,
  deriveObservedLthr,
  isPlausibleHrMax,
  maxRollingMedian,
  maxTimeWeightedMean,
  sessionThresholdHr,
} from "@/lib/hr-model/observe";
import {
  loadHrModelHistory,
  pickHrModel,
  writeHrModelVersion,
} from "@/lib/hr-model/store";
import { recordZoneRises } from "@/lib/hr-model/notice";
import {
  UNKNOWN_HR_MODEL,
  type AthleteHrModelRow,
  type HrModel,
  type ThresholdSport,
} from "@/lib/hr-model/types";
import { thresholdSportOf } from "@/lib/hr-model/zones";
import { readActivityStream } from "@/lib/fit/stream-store";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/supabase/page";

export function resolveHrModelFromHistory(
  rows: AthleteHrModelRow[],
  activityDate: string,
): HrModel {
  const current = rows.filter(
    (row) =>
      row.valid_from <= activityDate && (row.valid_to == null || row.valid_to > activityDate),
  );
  const picked = pickHrModel(current);
  if (picked.source !== "unknown") {
    return picked;
  }
  const later = rows.filter((row) => row.valid_from > activityDate);
  return later.length > 0 ? pickHrModel(later) : UNKNOWN_HR_MODEL;
}

export async function resolveHrModel(
  athleteId: string,
  activityDate: string,
): Promise<HrModel> {
  const rows = await loadHrModelHistory(athleteId);
  return resolveHrModelFromHistory(rows, activityDate);
}

export async function noteProviderProfileHrMax(input: {
  athleteId: string;
  activityDate: string;
  providerProfileHrMax: number | null | undefined;
  provider?: string;
  sessionMaxHr?: number | null;
}) {
  const value = input.providerProfileHrMax;
  if (!isPlausibleHrMax(value) || value == null) {
    return;
  }
  if (input.sessionMaxHr != null && Math.abs(value - input.sessionMaxHr) <= 2) {
    return;
  }
  const current = await resolveHrModel(input.athleteId, input.activityDate);
  if (current.source === "observed" && current.hrMax != null && current.hrMax >= value + 8) {
    return;
  }
  await writeHrModelVersion({
    athleteId: input.athleteId,
    hrMax: value,
    source: "provider_profile",
    confidence: "moderate",
    validFrom: input.activityDate,
    provider: input.provider ?? "fit_user_profile",
    providerValueReference: String(value),
  });
}

export async function refreshAthleteHrModelHistory(athleteId: string, timeZone: string) {
  const admin = createAdminClient();
  const { data: firstRow } = await admin
    .from("activities")
    .select("started_at")
    .eq("athlete_id", athleteId)
    .eq("intelligence_eligible", true)
    .order("started_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const firstActivityDate = firstRow?.started_at
    ? dateKeyInZone(new Date(firstRow.started_at), timeZone)
    : null;
  const activities = await fetchAllRows<{
    id: string;
    source_activity_id: string;
    started_at: string;
    max_hr: number | null;
    sport: string;
  }>((from, to) =>
    admin
      .from("activities")
      .select("id, source_activity_id, started_at, max_hr, sport")
      .eq("athlete_id", athleteId)
      .eq("intelligence_eligible", true)
      .not("raw_fit_key", "is", null)
      .range(from, to),
  );
  const peaks: { date: string; peak: number }[] = [];
  const thresholdEvidence: Record<ThresholdSport, { date: string; candidate: number }[]> = {
    cycling: [],
    running: [],
  };
  for (const activity of activities) {
    const stream = await readActivityStream({
      athleteId,
      sourceActivityId: activity.source_activity_id,
    });
    if (!stream?.length) {
      continue;
    }
    const date = dateKeyInZone(new Date(activity.started_at), timeZone);
    const peak = maxRollingMedian(stream, 10);
    if (peak != null) {
      peaks.push({ date, peak });
    }
    const sport = thresholdSportOf(activity.sport);
    if (!sport) {
      continue;
    }
    const candidate = sessionThresholdHr(
      maxTimeWeightedMean(stream, 20 * 60),
      maxTimeWeightedMean(stream, 60 * 60),
    );
    if (candidate != null) {
      thresholdEvidence[sport].push({ date, candidate });
    }
  }
  const observed = deriveObservedHrMax(peaks);
  if (!observed) {
    return UNKNOWN_HR_MODEL;
  }
  const today = dateKeyInZone(new Date(), timeZone);
  const previous = await resolveHrModel(athleteId, today);
  const cycling = deriveObservedLthr(thresholdEvidence.cycling, observed.hrMax);
  const running = deriveObservedLthr(thresholdEvidence.running, observed.hrMax);
  const threshold = cycling ?? running;
  await writeHrModelVersion({
    athleteId,
    hrMax: observed.hrMax,
    source: "observed",
    confidence: observed.confidence,
    validFrom: firstActivityDate ?? observed.validFrom,
    cyclingLthr: cycling?.lthr ?? null,
    runningLthr: running?.lthr ?? null,
    thresholdSource: threshold ? "observed" : null,
    thresholdConfidence: threshold?.confidence ?? null,
  });
  await recordZoneRises({
    athleteId,
    previous,
    next: {
      hrMax: observed.hrMax,
      cyclingLthr: cycling?.lthr ?? null,
      runningLthr: running?.lthr ?? null,
    },
    at: today,
  });
  return resolveHrModel(athleteId, firstActivityDate ?? observed.validFrom);
}
