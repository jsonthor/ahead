import { historyDays } from "@/lib/load/training-state";
import { createClient } from "@/lib/supabase/client";

export async function loadTrainingHistoryDays(athleteId: string, today: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("daily_loads")
    .select("date")
    .eq("athlete_id", athleteId)
    .neq("status", "forecast")
    .order("date", { ascending: true })
    .limit(1)
    .maybeSingle();
  return historyDays(data?.date ?? null, today);
}
