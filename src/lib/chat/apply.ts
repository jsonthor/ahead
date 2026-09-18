import { asCalendarSport } from "@/lib/calendar-event";
import type { DiaryMutation } from "@/lib/chat/proposal";
import { createClient } from "@/lib/supabase/client";

export async function applyDiaryMutations(mutations: DiaryMutation[]) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not signed in.");
  }
  const athleteId = user.id;
  for (const mutation of mutations) {
    if (mutation.op === "create") {
      const { error } = await supabase.from("calendar_items").insert({
        athlete_id: athleteId,
        date: mutation.date,
        sport: asCalendarSport(mutation.sport),
        title: mutation.title,
        intent: mutation.intent,
        importance: mutation.importance,
        planned_seconds: mutation.planned_seconds,
        planned_distance_m: mutation.planned_distance_m,
        notes: mutation.notes,
      });
      if (error) {
        throw error;
      }
    } else if (mutation.op === "update") {
      const { error } = await supabase
        .from("calendar_items")
        .update({
          ...(mutation.date ? { date: mutation.date } : {}),
          ...(mutation.sport ? { sport: asCalendarSport(mutation.sport) } : {}),
          ...(mutation.title ? { title: mutation.title } : {}),
          ...(mutation.intent ? { intent: mutation.intent } : {}),
          ...(mutation.importance !== undefined ? { importance: mutation.importance } : {}),
          ...(mutation.planned_seconds !== undefined
            ? { planned_seconds: mutation.planned_seconds }
            : {}),
          ...(mutation.planned_distance_m !== undefined
            ? { planned_distance_m: mutation.planned_distance_m }
            : {}),
          ...(mutation.notes !== undefined ? { notes: mutation.notes } : {}),
        })
        .eq("id", mutation.id);
      if (error) {
        throw error;
      }
    } else {
      const { error } = await supabase.from("calendar_items").delete().eq("id", mutation.id);
      if (error) {
        throw error;
      }
    }
  }
}
