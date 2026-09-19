import { createClient } from "@/lib/supabase/client";
import {
  RACE_FACTORS,
  RACE_FEELS,
  RACE_STATUSES,
  type RaceFactor,
  type RaceFeel,
  type RaceResult,
  type RaceResultInput,
  type RaceStatus,
} from "@/lib/race-result/types";

let openResult: RaceResult | null = null;

export function setOpenRaceResult(result: RaceResult | null) {
  openResult = result;
}

export function getOpenRaceResult() {
  return openResult;
}

type Row = {
  id: string;
  athlete_id: string;
  calendar_item_id: string | null;
  activity_id: string | null;
  place: number | null;
  field_size: number | null;
  category: string | null;
  gap: string | null;
  feel: string | null;
  factor: string | null;
  status: string;
};

function asFeel(value: string | null): RaceFeel | null {
  return RACE_FEELS.includes(value as RaceFeel) ? (value as RaceFeel) : null;
}

function asFactor(value: string | null): RaceFactor | null {
  return RACE_FACTORS.includes(value as RaceFactor) ? (value as RaceFactor) : null;
}

function asStatus(value: string | null): RaceStatus {
  return RACE_STATUSES.includes(value as RaceStatus) ? (value as RaceStatus) : "completed";
}

function parseRow(row: Row): RaceResult {
  return {
    id: row.id,
    athleteId: row.athlete_id,
    calendarItemId: row.calendar_item_id,
    activityId: row.activity_id,
    place: row.place,
    fieldSize: row.field_size,
    category: row.category,
    gap: row.gap,
    feel: asFeel(row.feel),
    factor: asFactor(row.factor),
    status: asStatus(row.status),
  };
}

export async function loadRaceResult(input: {
  activityId?: string | null;
  calendarItemId?: string | null;
}) {
  const supabase = createClient();
  if (input.activityId) {
    const { data, error } = await supabase
      .from("race_results")
      .select(
        "id, athlete_id, calendar_item_id, activity_id, place, field_size, category, gap, feel, factor, status",
      )
      .eq("activity_id", input.activityId)
      .maybeSingle();
    if (!error && data) {
      return parseRow(data);
    }
  }
  if (input.calendarItemId) {
    const { data, error } = await supabase
      .from("race_results")
      .select(
        "id, athlete_id, calendar_item_id, activity_id, place, field_size, category, gap, feel, factor, status",
      )
      .eq("calendar_item_id", input.calendarItemId)
      .maybeSingle();
    if (!error && data) {
      return parseRow(data);
    }
  }
  return null;
}

export async function loadRaceResultsForAthlete(
  athleteId: string,
  from: string,
  to: string,
) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("race_results")
    .select(
      "id, athlete_id, calendar_item_id, activity_id, place, field_size, category, gap, feel, factor, status, calendar_items(date, title)",
    )
    .eq("athlete_id", athleteId)
    .order("created_at", { ascending: true });
  if (error || !data) {
    if (error) {
      console.error("Load race results failed", error);
    }
    return [];
  }
  return data
    .map((row) => {
      const event = row.calendar_items;
      return {
        ...parseRow(row),
        date: event && "date" in event ? event.date : null,
        title: event && "title" in event ? event.title : null,
      };
    })
    .filter((row) => {
      if (!row.date) {
        return true;
      }
      return row.date >= from && row.date <= to;
    });
}

export async function saveRaceResult(athleteId: string, input: RaceResultInput) {
  const supabase = createClient();
  const existing = await loadRaceResult({
    activityId: input.activityId,
    calendarItemId: input.calendarItemId,
  });
  const row = {
    athlete_id: athleteId,
    calendar_item_id: input.calendarItemId ?? null,
    activity_id: input.activityId ?? null,
    place: input.place,
    field_size: input.fieldSize,
    category: input.category,
    gap: input.gap,
    feel: input.feel,
    factor: input.factor,
    status: input.status,
  };
  const { data, error } = existing
    ? await supabase
        .from("race_results")
        .update(row)
        .eq("id", existing.id)
        .select(
          "id, athlete_id, calendar_item_id, activity_id, place, field_size, category, gap, feel, factor, status",
        )
        .single()
    : await supabase
        .from("race_results")
        .insert(row)
        .select(
          "id, athlete_id, calendar_item_id, activity_id, place, field_size, category, gap, feel, factor, status",
        )
        .single();
  if (error || !data) {
    throw new Error(error?.message || "Could not save the race result.");
  }
  return parseRow(data);
}
