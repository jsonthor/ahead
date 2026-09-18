import { addDaysToKey, dateKeyInZone } from "@/lib/calendar";
import type { Database } from "@/lib/database.types";
import {
  parseSessionWorkout,
  WORKOUT_SPORTS,
  workoutSportLabel,
  type SessionWorkout,
  type WorkoutSport,
} from "@/lib/workout";
import type { SupabaseClient } from "@supabase/supabase-js";

export const CALENDAR_SPORTS: WorkoutSport[] = WORKOUT_SPORTS.map(
  (sport) => sport.id,
);

export type CalendarIntent = "training" | "race";
export type CalendarImportance = "A" | "B" | "C";

export type CalendarEvent = {
  id: string;
  athlete_id: string;
  date: string;
  sport: WorkoutSport;
  title: string;
  intent: CalendarIntent;
  importance: CalendarImportance | null;
  planned_seconds: number | null;
  planned_distance_m: number | null;
  planned_load: number | null;
  purpose: string | null;
  created_by: "athlete" | "potential_ai";
  workout: SessionWorkout | null;
  notes: string | null;
  linked_activity_id: string | null;
};

export const CALENDAR_EVENT_COLUMNS =
  "id, athlete_id, date, sport, title, intent, importance, planned_seconds, planned_distance_m, planned_load, purpose, created_by, workout, notes, linked_activity_id";

export const CALENDAR_CHANGED_EVENT = "potential:calendar";
export const CALENDAR_PREVIEW_EVENT = "potential:calendar-preview";

export function notifyCalendarChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CALENDAR_CHANGED_EVENT));
  }
}

export type CalendarPreview = {
  operations: {
    type: string;
    date?: string;
    to?: string;
    from?: string;
    sessionId?: string;
    title?: string;
    durationMinutes?: number | null;
    session?: {
      title?: string;
      durationMinutes?: number | null;
      expectedLoad?: number | null;
    };
  }[];
  snapshot: {
    id: string;
    date?: string;
    title?: string;
    planned_seconds?: number | null;
    planned_load?: number | null;
  }[];
} | null;

export function notifyCalendarPreview(preview: CalendarPreview) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<CalendarPreview>(CALENDAR_PREVIEW_EVENT, { detail: preview }));
  }
}

type CalendarClient = SupabaseClient<Database>;

export function asCalendarIntent(value: string | null | undefined): CalendarIntent {
  return value === "race" ? "race" : "training";
}

export function asCalendarImportance(
  value: string | null | undefined,
): CalendarImportance | null {
  return value === "A" || value === "B" || value === "C" ? value : null;
}

export function asCalendarSport(value: string | null | undefined): WorkoutSport {
  return CALENDAR_SPORTS.includes(value as WorkoutSport)
    ? (value as WorkoutSport)
    : "other";
}

export function parseCalendarEvent(row: {
  id: string;
  athlete_id: string;
  date: string;
  sport: string;
  title: string;
  intent: string;
  importance: string | null;
  planned_seconds: number | null;
  planned_distance_m: number | null;
  planned_load?: number | null;
  purpose?: string | null;
  created_by?: string | null;
  workout?: unknown;
  notes: string | null;
  linked_activity_id: string | null;
}): CalendarEvent {
  return {
    id: row.id,
    athlete_id: row.athlete_id,
    date: row.date,
    sport: asCalendarSport(row.sport),
    title: row.title,
    intent: asCalendarIntent(row.intent),
    importance: asCalendarImportance(row.importance),
    planned_seconds: row.planned_seconds,
    planned_distance_m: row.planned_distance_m,
    planned_load: row.planned_load ?? null,
    purpose: row.purpose ?? null,
    created_by: row.created_by === "potential_ai" ? "potential_ai" : "athlete",
    workout: parseSessionWorkout(row.workout),
    notes: row.notes,
    linked_activity_id: row.linked_activity_id,
  };
}

export function defaultEventTitle(intent: CalendarIntent, sport: WorkoutSport) {
  if (intent === "race") {
    return "Race";
  }
  return workoutSportLabel(sport);
}

export function utcRangeForLocalDate(dateKey: string) {
  return {
    from: `${addDaysToKey(dateKey, -1)}T00:00:00.000Z`,
    to: `${addDaysToKey(dateKey, 2)}T00:00:00.000Z`,
  };
}

export function pickMatchingActivity(
  activities: {
    id: string;
    sport: string;
    duration_seconds: number | null;
  }[],
  event: {
    sport: string;
    planned_seconds: number | null;
  },
  taken: Set<string>,
): string | null {
  const free = activities.filter(
    (activity) => activity.sport === event.sport && !taken.has(activity.id),
  );
  if (free.length === 0) {
    return null;
  }
  if (free.length === 1 || event.planned_seconds == null) {
    return free[0]?.id ?? null;
  }
  const target = event.planned_seconds;
  return (
    [...free].sort(
      (left, right) =>
        Math.abs((left.duration_seconds ?? 0) - target) -
        Math.abs((right.duration_seconds ?? 0) - target),
    )[0]?.id ?? null
  );
}

export async function setEventActivityLink(
  client: CalendarClient,
  eventId: string,
  activityId: string | null,
) {
  if (activityId) {
    await client
      .from("calendar_items")
      .update({ linked_activity_id: null })
      .eq("linked_activity_id", activityId)
      .neq("id", eventId);
  }
  const { error } = await client
    .from("calendar_items")
    .update({ linked_activity_id: activityId })
    .eq("id", eventId);
  if (error) {
    throw error;
  }
}

export async function linkActivitiesToCalendarItems(
  client: CalendarClient,
  input: {
    athleteId: string;
    timeZone: string;
    activities: {
      id: string;
      startedAt: string;
      sport: string;
      durationSeconds?: number | null;
    }[];
  },
) {
  if (input.activities.length === 0) {
    return;
  }
  const dated = input.activities.map((activity) => ({
    id: activity.id,
    sport: activity.sport,
    duration_seconds: activity.durationSeconds ?? null,
    date: dateKeyInZone(new Date(activity.startedAt), input.timeZone),
  }));
  const minDate = dated.reduce((min, row) => (row.date < min ? row.date : min), dated[0]!.date);
  const maxDate = dated.reduce((max, row) => (row.date > max ? row.date : max), dated[0]!.date);
  const { data, error } = await client
    .from("calendar_items")
    .select("id, date, sport, intent, planned_seconds, linked_activity_id")
    .eq("athlete_id", input.athleteId)
    .gte("date", minDate)
    .lte("date", maxDate);
  if (error) {
    throw error;
  }
  const events = (data ?? []).map((row) => ({
    id: row.id,
    date: row.date,
    sport: row.sport,
    intent: asCalendarIntent(row.intent),
    planned_seconds: row.planned_seconds,
    linked_activity_id: row.linked_activity_id,
  }));
  const taken = new Set(
    events
      .map((event) => event.linked_activity_id)
      .filter((id): id is string => Boolean(id)),
  );
  const open = events
    .filter((event) => !event.linked_activity_id)
    .sort((left, right) => {
      if (left.intent !== right.intent) {
        return left.intent === "race" ? -1 : 1;
      }
      return left.date.localeCompare(right.date);
    });
  for (const event of open) {
    const sameDay = dated.filter((activity) => activity.date === event.date);
    const match = pickMatchingActivity(sameDay, event, taken);
    if (!match) {
      continue;
    }
    await setEventActivityLink(client, event.id, match);
    taken.add(match);
  }
}
