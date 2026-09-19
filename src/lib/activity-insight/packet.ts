import { addDaysToKey, dateKeyInZone } from "@/lib/calendar";
import {
  CALENDAR_EVENT_COLUMNS,
  parseCalendarEvent,
  type CalendarEvent,
} from "@/lib/calendar-event";
import type { Database } from "@/lib/database.types";
import { displayPotential } from "@/lib/load/potential";
import { displayTrainingState } from "@/lib/load/training-state";
import { routeComparison, type RouteAttempt } from "@/lib/route/compare";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActivityInsightPacket, ClassificationConfidence } from "@/lib/activity-insight/types";

type Client = SupabaseClient<Database>;

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function minutes(seconds: number | null | undefined) {
  if (seconds == null) {
    return null;
  }
  return Math.round((seconds / 60) * 10) / 10;
}

function asConfidence(value: string | null | undefined): ClassificationConfidence {
  if (value === "trusted" || value === "uncertain" || value === "unavailable") {
    return value;
  }
  return "unavailable";
}

function durationMatched(actualSeconds: number | null, plannedMinutes: number | null) {
  if (actualSeconds == null || plannedMinutes == null || plannedMinutes <= 0) {
    return null;
  }
  const actual = actualSeconds / 60;
  return Math.abs(actual - plannedMinutes) / plannedMinutes <= 0.2;
}

function intensityMatched(input: {
  plannedLoad: number | null;
  actualLoad: number | null;
  purpose: string | null;
  plannedIntensity: string | null;
  mix: { easyMinutes: number; specificMinutes: number; highMinutes: number } | null;
  classification: ClassificationConfidence;
}) {
  if (input.classification !== "trusted") {
    return null;
  }
  const intendedEasy = /easy|opener|recovery|spin|light/i.test(
    `${input.purpose ?? ""} ${input.plannedIntensity ?? ""}`,
  );
  const intendedHard = /threshold|interval|vo2|quality|race|sweet/i.test(
    `${input.purpose ?? ""} ${input.plannedIntensity ?? ""}`,
  );
  if (input.mix) {
    const total = input.mix.easyMinutes + input.mix.specificMinutes + input.mix.highMinutes;
    if (total > 0) {
      const easyShare = input.mix.easyMinutes / total;
      const hardShare = (input.mix.specificMinutes + input.mix.highMinutes) / total;
      if (intendedEasy) {
        return easyShare >= 0.55;
      }
      if (intendedHard) {
        return hardShare >= 0.45;
      }
    }
  }
  if (input.plannedLoad != null && input.actualLoad != null && input.plannedLoad > 0) {
    return Math.abs(input.actualLoad - input.plannedLoad) / input.plannedLoad <= 0.25;
  }
  return null;
}

function structureVerified(structure: string | null, hasPower: boolean) {
  if (!structure) {
    return null;
  }
  if (/\b(pickup|sprint|interval|3\s*[×x])/i.test(structure) && !hasPower) {
    return null;
  }
  return hasPower ? true : null;
}

export async function buildActivityInsightPacket(input: {
  client: Client;
  athleteId: string;
  activityId: string;
  timeZone: string;
}): Promise<{
  packet: ActivityInsightPacket;
  formulaVersion: string | null;
  hrModelVersion: string | null;
  event: CalendarEvent | null;
}> {
  const supabase = input.client;
  const { data: activity, error } = await supabase
    .from("activities")
    .select(
      "id, sport, started_at, duration_seconds, moving_seconds, elapsed_seconds, distance_m, elevation_m, avg_hr, max_hr, avg_power, normalized_power, avg_speed_mps, session_type, activity_metrics(potential_load, intensity, training_mix, hr_zone_seconds, load_method, data_quality, hr_model_max, hr_model_source, hr_model_confidence, threshold_hr, threshold_source, threshold_confidence, zone_method, intensity_classification, formula_version, hr_zone_model_version)",
    )
    .eq("id", input.activityId)
    .eq("athlete_id", input.athleteId)
    .maybeSingle();
  if (error || !activity) {
    throw new Error("Activity not found.");
  }

  const metrics = one(
    activity.activity_metrics as
      | Record<string, unknown>
      | Record<string, unknown>[]
      | null,
  );
  const date = dateKeyInZone(new Date(activity.started_at), input.timeZone);
  const lookback = addDaysToKey(date, -7);
  const ahead = addDaysToKey(date, 21);
  const weekFrom = `${lookback}T00:00:00.000Z`;
  const hardFromMs = Date.parse(activity.started_at) - 72 * 60 * 60 * 1000;

  const [
    { data: eventRow },
    { data: futureEvents },
    { data: laps },
    { data: routeRow },
    { data: dayLoad },
    { data: weekLoads },
    { data: recentActivities },
    { data: wellness },
    { data: recovery },
  ] = await Promise.all([
    supabase
      .from("calendar_items")
      .select(CALENDAR_EVENT_COLUMNS)
      .eq("linked_activity_id", input.activityId)
      .maybeSingle(),
    supabase
      .from("calendar_items")
      .select(CALENDAR_EVENT_COLUMNS)
      .eq("athlete_id", input.athleteId)
      .gte("date", date)
      .lte("date", ahead)
      .order("date"),
    supabase
      .from("activity_laps")
      .select("duration_seconds, avg_hr, avg_power, distance_m")
      .eq("activity_id", input.activityId)
      .order("source_index")
      .limit(8),
    supabase
      .from("activity_routes")
      .select("route_cluster_id, route_overlap")
      .eq("activity_id", input.activityId)
      .maybeSingle(),
    supabase
      .from("daily_loads")
      .select("fitness, fatigue, form, potential")
      .eq("athlete_id", input.athleteId)
      .eq("date", date)
      .maybeSingle(),
    supabase
      .from("daily_loads")
      .select("date, training_load")
      .eq("athlete_id", input.athleteId)
      .gte("date", lookback)
      .lt("date", date),
    supabase
      .from("activities")
      .select("id, started_at, duration_seconds, session_type, activity_metrics(intensity, training_mix, intensity_classification)")
      .eq("athlete_id", input.athleteId)
      .gte("started_at", weekFrom)
      .lt("started_at", activity.started_at)
      .order("started_at"),
    supabase
      .from("wellness_days")
      .select("resting_hr, sleep_minutes, hrv_ms")
      .eq("athlete_id", input.athleteId)
      .eq("date", date)
      .maybeSingle(),
    supabase
      .from("daily_recovery")
      .select("resting_hr, sleep_hrv_ms, sleep_minutes")
      .eq("athlete_id", input.athleteId)
      .eq("date", date)
      .maybeSingle(),
  ]);

  const event = eventRow ? parseCalendarEvent(eventRow) : null;
  const upcoming = (futureEvents ?? []).map(parseCalendarEvent);
  const nextRace = upcoming.find((row) => row.intent === "race" && row.date >= date) ?? null;
  const nextSession =
    upcoming.find(
      (row) =>
        row.intent === "training" &&
        row.id !== event?.id &&
        (row.date > date || (row.date === date && row.linked_activity_id !== input.activityId)),
    ) ?? null;

  const mixRaw = metrics?.training_mix as
    | { easy_seconds?: number; specific_seconds?: number; high_seconds?: number }
    | null
    | undefined;
  const mix = mixRaw
    ? {
        easyMinutes: minutes(Number(mixRaw.easy_seconds) || 0) ?? 0,
        specificMinutes: minutes(Number(mixRaw.specific_seconds) || 0) ?? 0,
        highMinutes: minutes(Number(mixRaw.high_seconds) || 0) ?? 0,
      }
    : null;
  const zonesRaw = metrics?.hr_zone_seconds as
    | { z1?: number; z2?: number; z3?: number; z4?: number; z5?: number }
    | null
    | undefined;
  const classification = asConfidence(
    typeof metrics?.intensity_classification === "string"
      ? metrics.intensity_classification
      : null,
  );
  const plannedMinutes =
    event?.planned_seconds != null ? Math.round(event.planned_seconds / 60) : null;
  const structure = event?.workout
    ? event.workout.blocks
        .map((block) => [block.name, block.detail].filter(Boolean).join(": "))
        .join(" · ")
    : event?.purpose ?? null;
  const hasPower = activity.avg_power != null || activity.normalized_power != null;
  const load =
    typeof metrics?.potential_load === "number" ? metrics.potential_load : null;

  const limitations: string[] = [];
  if (!hasPower) {
    limitations.push("No power channel.");
  }
  if (classification === "unavailable") {
    limitations.push("HR intensity cannot be classified from zones.");
  } else if (classification === "uncertain") {
    limitations.push("HR zone classification is uncertain.");
  }
  if (!event) {
    limitations.push("This activity was not linked to a planned workout.");
  }

  let repeatedRoute: ActivityInsightPacket["performance"] = undefined;
  if (routeRow?.route_cluster_id) {
    const [{ data: cluster }, { data: members }] = await Promise.all([
      supabase
        .from("route_clusters")
        .select("typical_distance_m")
        .eq("id", routeRow.route_cluster_id)
        .maybeSingle(),
      supabase
        .from("activity_routes")
        .select("activity_id, route_overlap")
        .eq("route_cluster_id", routeRow.route_cluster_id),
    ]);
    const ids = (members ?? []).map((row) => row.activity_id);
    const { data: attempts } = ids.length
      ? await supabase
          .from("activities")
          .select(
            "id, started_at, duration_seconds, moving_seconds, elapsed_seconds, distance_m, avg_hr, avg_speed_mps",
          )
          .in("id", ids)
      : { data: [] };
    const overlap = new Map(
      (members ?? []).map((row) => [row.activity_id, row.route_overlap]),
    );
    const rows: RouteAttempt[] = (attempts ?? []).map((row) => ({
      activityId: row.id,
      startedAt: row.started_at,
      durationSeconds: row.duration_seconds,
      movingSeconds: row.moving_seconds,
      elapsedSeconds: row.elapsed_seconds,
      distanceM: row.distance_m,
      avgHr: row.avg_hr,
      avgSpeedMps: row.avg_speed_mps,
      overlap: overlap.get(row.id) ?? null,
    }));
    const current = rows.find((row) => row.activityId === input.activityId);
    const compared = current
      ? routeComparison({
          current,
          attempts: rows,
          typicalDistanceM: cluster?.typical_distance_m ?? null,
        })
      : null;
    if (compared) {
      repeatedRoute = {
        repeatedRoute: {
          attemptCount: compared.attemptCount,
          comparisonAvailable: !compared.comparability.caution,
          speedChangePct: compared.similarHr?.fasterPct ?? null,
          hrChangeBpm: compared.hrDelta ?? null,
          comparisonConfidence: compared.comparability.caution ? "limited" : "moderate",
        },
      };
    }
  }

  const weekLoad = (weekLoads ?? []).reduce(
    (sum, row) => sum + (row.training_load ?? 0),
    0,
  );
  const weekHours =
    (recentActivities ?? []).reduce((sum, row) => sum + (row.duration_seconds ?? 0), 0) / 3600;
  const hardSessions = (recentActivities ?? []).filter((row) => {
    if (Date.parse(row.started_at) < hardFromMs) {
      return false;
    }
    const rowMetrics = one(row.activity_metrics as Record<string, unknown>[] | null);
    if (rowMetrics?.intensity_classification !== "trusted") {
      return false;
    }
    const intensity = Number(rowMetrics?.intensity);
    if (Number.isFinite(intensity) && intensity >= 70) {
      return true;
    }
    const mixValue = rowMetrics?.training_mix as
      | { easy_seconds?: number; specific_seconds?: number; high_seconds?: number }
      | undefined;
    const easy = Number(mixValue?.easy_seconds) || 0;
    const specific = Number(mixValue?.specific_seconds) || 0;
    const high = Number(mixValue?.high_seconds) || 0;
    const total = easy + specific + high;
    return total > 0 && (specific + high) / total >= 0.55;
  }).length;

  const sleep =
    wellness?.sleep_minutes ?? recovery?.sleep_minutes ?? null;
  const hrv = wellness?.hrv_ms ?? recovery?.sleep_hrv_ms ?? null;
  const resting = wellness?.resting_hr ?? recovery?.resting_hr ?? null;
  const recoveryBits = [
    sleep != null ? "sleep" : null,
    hrv != null ? "hrv" : null,
    resting != null ? "resting_hr" : null,
  ].filter(Boolean);

  const packet: ActivityInsightPacket = {
    athlete: {
      sportContext:
        activity.sport === "ride"
          ? "cycling"
          : activity.sport === "run"
            ? "running"
            : activity.sport,
      upcomingPriority: nextRace?.title ?? null,
    },
    activity: {
      id: activity.id,
      sport: activity.sport,
      startedAt: activity.started_at,
      durationSeconds: activity.duration_seconds,
      movingSeconds: activity.moving_seconds,
      distanceM: activity.distance_m,
      elevationM: activity.elevation_m,
      avgHr: activity.avg_hr,
      maxHr: activity.max_hr,
      avgPower: activity.avg_power,
      normalizedPower: activity.normalized_power,
      avgSpeed: activity.avg_speed_mps,
      trainingLoad: load,
      loadMethod: typeof metrics?.load_method === "string" ? metrics.load_method : null,
      classificationConfidence: classification,
    },
    physiology: {
      hrMax: typeof metrics?.hr_model_max === "number" ? metrics.hr_model_max : null,
      hrMaxSource: typeof metrics?.hr_model_source === "string" ? metrics.hr_model_source : null,
      hrMaxConfidence:
        typeof metrics?.hr_model_confidence === "string" ? metrics.hr_model_confidence : null,
      thresholdHr: typeof metrics?.threshold_hr === "number" ? metrics.threshold_hr : null,
      thresholdHrSource:
        typeof metrics?.threshold_source === "string" ? metrics.threshold_source : null,
      thresholdHrConfidence:
        typeof metrics?.threshold_confidence === "string"
          ? metrics.threshold_confidence
          : null,
      zoneMethod: typeof metrics?.zone_method === "string" ? metrics.zone_method : null,
      hrZones: zonesRaw
        ? {
            z1Seconds: Number(zonesRaw.z1) || 0,
            z2Seconds: Number(zonesRaw.z2) || 0,
            z3Seconds: Number(zonesRaw.z3) || 0,
            z4Seconds: Number(zonesRaw.z4) || 0,
            z5Seconds: Number(zonesRaw.z5) || 0,
          }
        : undefined,
    },
    trainingMix: mix ?? undefined,
    plannedWorkout: event
      ? {
          title: event.title,
          purpose: event.purpose ?? event.workout?.purpose ?? null,
          targetDurationMinutes: plannedMinutes,
          prescribedStructure: structure,
          plannedIntensity: event.workout?.intensity ?? null,
          plannedLoad: event.planned_load,
          comparison: {
            durationMatched: durationMatched(activity.duration_seconds, plannedMinutes),
            intensityMatched: intensityMatched({
              plannedLoad: event.planned_load,
              actualLoad: load,
              purpose: event.purpose ?? event.workout?.purpose ?? null,
              plannedIntensity: event.workout?.intensity ?? null,
              mix,
              classification,
            }),
            structureVerified: structureVerified(structure, hasPower),
          },
        }
      : undefined,
    laps: (laps ?? []).map((lap) => ({
      durationSeconds: lap.duration_seconds,
      avgHr: lap.avg_hr,
      avgPower: lap.avg_power,
      avgSpeed:
        lap.distance_m && lap.duration_seconds
          ? lap.distance_m / lap.duration_seconds
          : null,
    })),
    performance: repeatedRoute,
    recovery: {
      readiness:
        dayLoad?.potential != null ? displayPotential(dayLoad.potential) : null,
      sleepDurationMinutes: sleep,
      hrv,
      restingHr: resting,
      recoveryCoverage: recoveryBits.length ? recoveryBits.join(",") : "none",
    },
    currentState: (() => {
      if (dayLoad?.fitness == null || dayLoad.fatigue == null) {
        return {
          fitness: dayLoad?.fitness != null ? Math.round(dayLoad.fitness * 10) / 10 : null,
          fatigue: dayLoad?.fatigue != null ? Math.round(dayLoad.fatigue * 10) / 10 : null,
          form: dayLoad?.form != null ? Math.round(dayLoad.form * 10) / 10 : null,
        };
      }
      const shown = displayTrainingState({
        fitness: dayLoad.fitness,
        fatigue: dayLoad.fatigue,
      });
      return {
        fitness: shown.fitness,
        fatigue: shown.fatigue,
        form: shown.form,
      };
    })(),
    recentContext: {
      previous7DayLoad: weekLoad > 0 ? Math.round(weekLoad) : null,
      previous7DayHours: weekHours > 0 ? Math.round(weekHours * 10) / 10 : null,
      hardSessionsPrevious72h: hardSessions,
    },
    forwardContext: {
      nextRace: nextRace
        ? {
            name: nextRace.title,
            startsAt: nextRace.date,
            priority: nextRace.importance,
          }
        : undefined,
      nextPlannedSession: nextSession
        ? {
            title: nextSession.title,
            startsAt: nextSession.date,
            purpose: nextSession.purpose,
          }
        : undefined,
    },
    weather: { available: false },
    dataLimitations: limitations,
  };

  return {
    packet,
    formulaVersion: typeof metrics?.formula_version === "string" ? metrics.formula_version : null,
    hrModelVersion:
      typeof metrics?.hr_zone_model_version === "string"
        ? metrics.hr_zone_model_version
        : null,
    event,
  };
}
