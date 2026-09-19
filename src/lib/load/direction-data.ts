import { addDaysToKey } from "@/lib/calendar";
import type { Database } from "@/lib/database.types";
import {
  DIRECTION_WINDOW_DAYS,
  attemptsFromActivityRoutes,
  observeRouteResponse,
  type DirectionResponse,
  type RouteResponseAttempt,
} from "@/lib/load/direction";
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = {
  from: SupabaseClient<Database>["from"];
};

export async function fetchRouteAttempts(
  client: Client,
  today: string,
  lookbackDays = 400,
): Promise<RouteResponseAttempt[]> {
  const from = addDaysToKey(today, -lookbackDays);
  const to = addDaysToKey(today, 1);
  const { data: activities, error: activityError } = await client
    .from("activities")
    .select("id, started_at, duration_seconds, moving_seconds, avg_hr, avg_speed_mps")
    .eq("status", "ready")
    .gte("started_at", `${from}T00:00:00.000Z`)
    .lt("started_at", `${to}T00:00:00.000Z`);
  if (activityError) {
    console.error("Direction route activities failed", activityError);
    return [];
  }
  const ids = (activities ?? []).map((row) => row.id);
  if (ids.length === 0) {
    return [];
  }
  const routes: Array<{ activity_id: string; route_cluster_id: string | null }> = [];
  for (let index = 0; index < ids.length; index += 100) {
    const chunk = ids.slice(index, index + 100);
    const { data, error } = await client
      .from("activity_routes")
      .select("activity_id, route_cluster_id")
      .in("activity_id", chunk)
      .not("route_cluster_id", "is", null);
    if (error) {
      console.error("Direction route clusters failed", error);
      return [];
    }
    routes.push(...(data ?? []));
  }
  return attemptsFromActivityRoutes(activities ?? [], routes);
}

export async function fetchDirectionResponse(
  client: Client,
  today: string,
): Promise<DirectionResponse> {
  const attempts = await fetchRouteAttempts(client, today, DIRECTION_WINDOW_DAYS);
  return observeRouteResponse(attempts, today);
}
