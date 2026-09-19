import { athleteAge } from "@/lib/athlete-age";
import { addDaysToKey, dateKeyInZone } from "@/lib/calendar";
import { CALENDAR_EVENT_COLUMNS, parseCalendarEvent } from "@/lib/calendar-event";
import { summarize, type OnboardingAnswers } from "@/lib/onboarding";
import type { Database, Json } from "@/lib/database.types";
import { fetchRouteAttempts } from "@/lib/load/direction-data";
import { DIRECTION_HISTORY_DAYS, inferDirection, isDirectionCalibration } from "@/lib/load/direction";
import { displayPotential } from "@/lib/load/potential";
import { displayTrainingState } from "@/lib/load/training-state";
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient<Database>;

function onboardingFrom(value: Json | null): OnboardingAnswers | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const row = value as OnboardingAnswers;
  if (typeof row.version !== "number" || !row.values) {
    return null;
  }
  return row;
}

export async function buildContextPacket(
  client: Client,
  athleteId: string,
  timeZone: string,
) {
  const today = dateKeyInZone(new Date(), timeZone);
  const from = addDaysToKey(today, -(DIRECTION_HISTORY_DAYS - 1));
  const recentFrom = addDaysToKey(today, -13);
  const to = addDaysToKey(today, 14);
  const activityFrom = `${addDaysToKey(recentFrom, -1)}T00:00:00.000Z`;
  const activityTo = `${addDaysToKey(to, 2)}T00:00:00.000Z`;

  const [profileRes, loadsRes, eventsRes, activitiesRes, memoriesRes, routeAttempts] =
    await Promise.all([
    client
      .from("profiles")
      .select("display_name, timezone, units, date_of_birth, onboarding, potential_calibration")
      .eq("id", athleteId)
      .maybeSingle(),
    client
      .from("daily_loads")
      .select(
        "date, training_load, fitness, fatigue, form, potential, aerobic_reserve, specific_capacity, aerobic_raw, specific_raw, acute_fatigue",
      )
      .gte("date", from)
      .lte("date", today)
      .order("date", { ascending: true }),
    client
      .from("calendar_items")
      .select(CALENDAR_EVENT_COLUMNS)
      .gte("date", recentFrom)
      .lte("date", to)
      .order("date", { ascending: true }),
    client
      .from("activities")
      .select(
        "id, sport, started_at, duration_seconds, distance_m, avg_hr, session_type, activity_metrics(potential_load)",
      )
      .eq("intelligence_eligible", true)
      .eq("status", "ready")
      .gte("started_at", activityFrom)
      .lt("started_at", activityTo)
      .order("started_at", { ascending: true }),
    client
      .from("athlete_memories")
      .select("type, content, importance")
      .is("superseded_at", null)
      .order("importance", { ascending: false })
      .limit(12),
    fetchRouteAttempts(client, today, DIRECTION_HISTORY_DAYS),
  ]);

  const profile = profileRes.data;
  const onboarding = onboardingFrom(profile?.onboarding ?? null);
  const loads = loadsRes.data ?? [];
  const todayLoad = [...loads]
    .reverse()
    .find((row) => row.date <= today && row.potential != null);
  const calibration = isDirectionCalibration(profile?.potential_calibration)
    ? profile.potential_calibration
    : null;
  const direction = inferDirection(loads, today, routeAttempts, calibration);
  const shown =
    todayLoad?.fitness != null && todayLoad.fatigue != null
      ? displayTrainingState({
          fitness: todayLoad.fitness,
          fatigue: todayLoad.fatigue,
        })
      : null;

  const activities = (
    (activitiesRes.data as
      | {
          id: string;
          sport: string;
          started_at: string;
          duration_seconds: number | null;
          distance_m: number | null;
          avg_hr: number | null;
          session_type: string | null;
          activity_metrics:
            | { potential_load: number | null }
            | { potential_load: number | null }[]
            | null;
        }[]
      | null) ?? []
  ).map((row) => {
    const metrics = Array.isArray(row.activity_metrics)
      ? row.activity_metrics[0]
      : row.activity_metrics;
    return {
      id: row.id,
      date: dateKeyInZone(new Date(row.started_at), timeZone),
      sport: row.sport,
      duration_seconds: row.duration_seconds,
      distance_m: row.distance_m,
      avg_hr: row.avg_hr,
      session_type: row.session_type,
      load: metrics?.potential_load ?? null,
    };
  });

  return {
    today,
    timezone: timeZone,
    athlete: {
      name: profile?.display_name ?? "Athlete",
      units: profile?.units ?? "metric",
      ...(athleteAge(profile?.date_of_birth, new Date(), timeZone) ?? {}),
      onboarding: onboarding ? summarize(onboarding) : null,
      memory: (memoriesRes.data ?? []).map((row) => `${row.type}: ${row.content}`),
    },
    todayState: todayLoad
      ? {
          asOf: todayLoad.date,
          readiness:
            todayLoad.potential != null ? displayPotential(todayLoad.potential) : null,
          potential:
            todayLoad.potential != null ? displayPotential(todayLoad.potential) : null,
          aerobic:
            todayLoad.aerobic_reserve != null
              ? displayPotential(todayLoad.aerobic_reserve)
              : null,
          specific:
            todayLoad.specific_capacity != null
              ? displayPotential(todayLoad.specific_capacity)
              : null,
          fatigueSuppression:
            todayLoad.acute_fatigue != null
              ? displayPotential(todayLoad.acute_fatigue)
              : null,
          fitness: shown?.fitness ?? todayLoad.fitness,
          fatigue: shown?.fatigue ?? todayLoad.fatigue,
          form: shown?.form ?? todayLoad.form,
          load: todayLoad.training_load,
          direction: {
            state: direction.state,
            label: direction.label,
            score: direction.score,
            strain: direction.strain,
            summary: direction.summary,
            conclusion: direction.conclusion,
            confidence: direction.confidence,
            confidenceLabel: direction.confidenceLabel,
            performanceNote: direction.performanceNote,
            explanation: direction.explanation,
            evidence: direction.evidence,
            signals: direction.signals,
            windowLabel: direction.windowLabel,
            windowDays: direction.windowDays,
            trajectory: direction.trajectory,
            trajectoryLabel: direction.trajectoryLabel,
          },
        }
      : null,
    last14Days: {
      loads: loads.filter((row) => row.date >= recentFrom),
      events: (eventsRes.data ?? []).map(parseCalendarEvent).map((event) => ({
        id: event.id,
        date: event.date,
        sport: event.sport,
        title: event.title,
        intent: event.intent,
        planned_seconds: event.planned_seconds,
        linked_activity_id: event.linked_activity_id,
      })),
      activities,
    },
  };
}
