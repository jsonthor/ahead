import { addDaysToKey, dateKeyInZone } from "@/lib/calendar";
import {
  CALENDAR_EVENT_COLUMNS,
  parseCalendarEvent,
} from "@/lib/calendar-event";
import {
  classifySession,
  recurringFixtures,
  uniqueRaces,
  type ReviewSession,
} from "@/lib/coach-review/recognize";
import { fetchRouteAttempts } from "@/lib/load/direction-data";
import {
  inferDirection,
  observeRouteResponse,
  type DirectionCalibration,
  type DirectionDay,
  isDirectionCalibration,
} from "@/lib/load/direction";
import { historyDays } from "@/lib/load/training-state";
import { DAYS, summarize, type OnboardingAnswers } from "@/lib/onboarding";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

type LoadRow = DirectionDay & {
  status: string | null;
};

export type ReviewPacket = {
  periodStart: string;
  periodEnd: string;
  nextStart: string;
  nextEnd: string;
  historyDays: number;
  trainedDays: number;
  trainingLoad: number;
  fitnessStart: number | null;
  fitnessEnd: number | null;
  aerobicRawStart: number | null;
  aerobicRawEnd: number | null;
  specificRawStart: number | null;
  specificRawEnd: number | null;
  directionStart: ReturnType<typeof inferDirection>;
  directionEnd: ReturnType<typeof inferDirection>;
  races: ReviewSession[];
  upcomingRaces: ReviewSession[];
  fixtures: ReviewSession[];
  upcomingPlanned: ReviewSession[];
  seasonRaces: ReviewSession[];
  goals: ReturnType<typeof summarize> | null;
  routeEvidence: "limited" | "emerging" | "clear";
};

function asDay(row: LoadRow): DirectionDay {
  return {
    date: row.date,
    training_load: row.training_load,
    fitness: row.fitness,
    fatigue: row.fatigue,
    form: row.form,
    potential: row.potential,
    aerobic_reserve: row.aerobic_reserve,
    specific_capacity: row.specific_capacity,
    aerobic_raw: row.aerobic_raw,
    specific_raw: row.specific_raw,
  };
}

function nearest(days: DirectionDay[], date: string) {
  return [...days].reverse().find((row) => row.date <= date) ?? days[0] ?? null;
}

function dedupeFixtures(sessions: ReviewSession[]) {
  const seen = new Set<string>();
  return sessions.filter((session) => {
    const key = `${session.weekday}:${session.title.toLowerCase()}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function minutesFromSeconds(value: number | null | undefined) {
  if (!value) {
    return null;
  }
  return Math.round(value / 60);
}

export async function loadReviewPacket(input: {
  athleteId: string;
  timeZone: string;
  periodStart: string;
  periodEnd: string;
  client?: SupabaseClient<Database>;
}) {
  const supabase = input.client ?? createBrowserClient();
  const nextStart = addDaysToKey(input.periodEnd, 1);
  const nextEnd = addDaysToKey(input.periodEnd, 42);
  const seasonEnd = addDaysToKey(input.periodEnd, 400);
  const lookback = addDaysToKey(input.periodStart, -56);
  const loadFrom = addDaysToKey(input.periodStart, -120);

  const [{ data: profile }, { data: loadData }, { data: calendarData }, { data: activityData }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("potential_calibration, onboarding")
        .eq("id", input.athleteId)
        .maybeSingle(),
      supabase
        .from("daily_loads")
        .select(
          "date, training_load, fitness, fatigue, form, potential, aerobic_reserve, specific_capacity, aerobic_raw, specific_raw, status",
        )
        .eq("athlete_id", input.athleteId)
        .gte("date", loadFrom)
        .lte("date", input.periodEnd)
        .order("date"),
      supabase
        .from("calendar_items")
        .select(CALENDAR_EVENT_COLUMNS)
        .eq("athlete_id", input.athleteId)
        .gte("date", lookback)
        .lte("date", seasonEnd)
        .order("date"),
      supabase
        .from("activities")
        .select(
          "id, started_at, sport, subsport, session_type, session_importance, duration_seconds",
        )
        .eq("athlete_id", input.athleteId)
        .eq("status", "ready")
        .gte("started_at", `${lookback}T00:00:00.000Z`)
        .lt("started_at", `${addDaysToKey(nextEnd, 1)}T00:00:00.000Z`),
    ]);

  const calibration = isDirectionCalibration(profile?.potential_calibration)
    ? (profile?.potential_calibration as DirectionCalibration)
    : null;
  const rows = ((loadData ?? []) as LoadRow[]).filter((row) => row.status !== "forecast");
  const days = rows.map(asDay);
  const inPeriod = days.filter(
    (row) => row.date >= input.periodStart && row.date <= input.periodEnd,
  );
  const start = nearest(days, input.periodStart);
  const end = nearest(days, input.periodEnd);
  const routes = await fetchRouteAttempts(supabase, input.periodEnd);
  const route = observeRouteResponse(routes, input.periodEnd);
  const historyStart = days[0]?.date ?? null;

  const events = (calendarData ?? []).map(parseCalendarEvent);
  const raceLinkedIds = new Set(
    events
      .filter((event) => event.intent === "race" && event.linked_activity_id)
      .map((event) => event.linked_activity_id as string),
  );
  const fromCalendar = events.map((event) =>
    classifySession({
      date: event.date,
      title: event.title,
      minutes: minutesFromSeconds(event.planned_seconds),
      intent: event.intent,
      importance: event.importance,
      source: "calendar",
    }),
  );

  type ActivityRow = {
    id: string;
    started_at: string;
    sport: string;
    subsport: string | null;
    session_type: string | null;
    session_importance: string | null;
    duration_seconds: number | null;
  };
  const activities = (activityData ?? []) as ActivityRow[];
  const fromActivities = activities.map((activity) =>
    classifySession({
      date: dateKeyInZone(new Date(activity.started_at), input.timeZone),
      title: activity.subsport || activity.sport,
      minutes: minutesFromSeconds(activity.duration_seconds),
      sessionType: activity.session_type,
      linkedToRace: raceLinkedIds.has(activity.id),
      importance:
        activity.session_importance === "A" ||
        activity.session_importance === "B" ||
        activity.session_importance === "C"
          ? activity.session_importance
          : null,
      source: "activity",
    }),
  );

  const onboarding = profile?.onboarding as OnboardingAnswers | null;
  const fixed = onboarding?.values?.fixed_sessions;
  const routines: ReviewSession[] =
    fixed?.type === "fixed_sessions"
      ? (fixed.sessions ?? []).map((session) => {
          const day = DAYS.find((entry) => entry.id === session.day)?.label ?? "Mon";
          return classifySession({
            date: input.periodEnd,
            weekday: day,
            title: session.title ?? "session",
            minutes: session.minutes ?? null,
            source: "routine",
          });
        })
      : [];

  const all = [...fromCalendar, ...fromActivities, ...routines];
  const inReview = all.filter(
    (row) => row.date >= input.periodStart && row.date <= input.periodEnd,
  );
  const upcoming = all.filter((row) => row.date >= nextStart && row.date <= nextEnd);
  const season = all.filter((row) => row.date >= nextStart && row.date <= seasonEnd);
  const historyWindow = all.filter(
    (row) => row.date >= lookback && row.date <= input.periodEnd,
  );

  return {
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    nextStart,
    nextEnd,
    historyDays: historyDays(historyStart, input.periodEnd),
    trainedDays: inPeriod.filter((row) => (row.training_load ?? 0) > 0).length,
    trainingLoad: inPeriod.reduce((sum, row) => sum + (row.training_load ?? 0), 0),
    fitnessStart: start?.fitness ?? null,
    fitnessEnd: end?.fitness ?? null,
    aerobicRawStart: start?.aerobic_raw ?? start?.aerobic_reserve ?? null,
    aerobicRawEnd: end?.aerobic_raw ?? end?.aerobic_reserve ?? null,
    specificRawStart: start?.specific_raw ?? start?.specific_capacity ?? null,
    specificRawEnd: end?.specific_raw ?? end?.specific_capacity ?? null,
    directionStart: inferDirection(days, input.periodStart, routes, calibration),
    directionEnd: inferDirection(days, input.periodEnd, routes, calibration),
    races: uniqueRaces(inReview),
    upcomingRaces: uniqueRaces(upcoming),
    fixtures: dedupeFixtures([
      ...routines.filter((row) => row.source === "routine"),
      ...recurringFixtures(historyWindow),
    ]),
    upcomingPlanned: upcoming.filter((row) => row.kind !== "race"),
    seasonRaces: uniqueRaces(season),
    goals: onboarding?.values ? summarize(onboarding) : null,
    routeEvidence:
      route.status === "improving" || route.status === "declining"
        ? "emerging"
        : "limited",
  } satisfies ReviewPacket;
}
