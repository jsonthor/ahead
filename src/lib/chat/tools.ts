import { addDaysToKey, dateKeyInZone } from "@/lib/calendar";
import { CALENDAR_EVENT_COLUMNS, parseCalendarEvent } from "@/lib/calendar-event";
import { parseDiaryMutations, type CalendarProposal } from "@/lib/chat/proposal";
import type { Database } from "@/lib/database.types";
import { presentWellnessFeed } from "@/lib/chat/wellness";
import { routeComparison } from "@/lib/route/compare";
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient<Database>;

export const CHAT_TOOLS = [
  {
    name: "get_calendar",
    description:
      "Read planned events and races on the Potential calendar between two inclusive dates (YYYY-MM-DD).",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        from: { type: "string", description: "Start date YYYY-MM-DD" },
        to: { type: "string", description: "End date YYYY-MM-DD" },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "search_activities",
    description:
      "Search completed intelligence-eligible activities in a date range. Use for past training questions.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        from: { type: "string" },
        to: { type: "string" },
        sport: { type: "string" },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "get_activity",
    description: "Get one completed activity summary by id. Do not invent streams that are not returned.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "get_route_history",
    description:
      "Repeated-route group for one completed activity: attempt count, today vs typical time/speed/HR, similar-HR comparison, and prior attempts. Use when they ask if they are getting faster on the same roads, or why this ride compared to usual. Do not invent a route name.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: { activity_id: { type: "string" } },
      required: ["activity_id"],
    },
  },
  {
    name: "get_load_series",
    description:
      "Daily load, Fitness, Fatigue, Form, and Readiness score (JSON field: potential) between two inclusive dates.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        from: { type: "string" },
        to: { type: "string" },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "get_wellness",
    description:
      "Daily recovery observations (overnight HRV, plausible overnight sleep, resting HR, stress). Missing fields are absent from the stored feed — do not invent them or treat blanks as poor recovery. Sleep under 2 hours is omitted. If coverage is thin, do not steer training from this feed.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        from: { type: "string" },
        to: { type: "string" },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "remember",
    description:
      "Persist a durable fact about this athlete that should survive future conversations (preferences, constraints, what matters). Short. One fact per call.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: { fact: { type: "string" } },
      required: ["fact"],
    },
  },
  {
    name: "propose_calendar_changes",
    description:
      "Draft the diary change in this turn whenever you recommend sessions or a week's shape. Never claim they are saved. The athlete must Apply. Do not wait to be asked to add it. Do not create rest-day events.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        rationale: { type: "string" },
        mutations: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              op: { type: "string", enum: ["create", "update", "delete"] },
              id: { type: "string" },
              date: { type: "string" },
              sport: { type: "string" },
              title: { type: "string" },
              intent: { type: "string", enum: ["training", "race"] },
              importance: { type: "string", enum: ["A", "B", "C"] },
              planned_seconds: { type: "number" },
              planned_distance_m: { type: "number" },
              notes: { type: "string" },
            },
            required: ["op"],
          },
        },
      },
      required: ["mutations"],
    },
  },
] as const;

function str(value: unknown) {
  return typeof value === "string" ? value : "";
}

function activityRange(from: string, to: string) {
  return {
    from: `${addDaysToKey(from, -1)}T00:00:00.000Z`,
    to: `${addDaysToKey(to, 2)}T00:00:00.000Z`,
  };
}

export async function executeChatTool(
  client: Client,
  input: {
    athleteId: string;
    timeZone: string;
    name: string;
    args: Record<string, unknown>;
  },
): Promise<{ result: unknown; proposal?: CalendarProposal }> {
  const { name, args, athleteId, timeZone } = input;
  if (name === "get_calendar") {
    const from = str(args.from);
    const to = str(args.to);
    const { data, error } = await client
      .from("calendar_items")
      .select(CALENDAR_EVENT_COLUMNS)
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: true });
    if (error) {
      return { result: { error: error.message } };
    }
    return { result: (data ?? []).map(parseCalendarEvent) };
  }
  if (name === "search_activities") {
    const from = str(args.from);
    const to = str(args.to);
    const range = activityRange(from, to);
    let query = client
      .from("activities")
      .select(
        "id, sport, started_at, duration_seconds, distance_m, elevation_m, avg_hr, avg_power, session_type, activity_metrics(potential_load, intensity, data_quality)",
      )
      .eq("intelligence_eligible", true)
      .eq("status", "ready")
      .gte("started_at", range.from)
      .lt("started_at", range.to)
      .order("started_at", { ascending: true })
      .limit(80);
    if (str(args.sport)) {
      query = query.eq("sport", str(args.sport));
    }
    const { data, error } = await query;
    if (error) {
      return { result: { error: error.message } };
    }
    const rows = (
      (data as
        | {
            id: string;
            sport: string;
            started_at: string;
            duration_seconds: number | null;
            distance_m: number | null;
            elevation_m: number | null;
            avg_hr: number | null;
            avg_power: number | null;
            session_type: string | null;
            activity_metrics:
              | {
                  potential_load: number | null;
                  intensity: number | null;
                  data_quality: string | null;
                }
              | {
                  potential_load: number | null;
                  intensity: number | null;
                  data_quality: string | null;
                }[]
              | null;
          }[]
        | null) ?? []
    )
      .map((row) => {
        const metrics = Array.isArray(row.activity_metrics)
          ? row.activity_metrics[0]
          : row.activity_metrics;
        return {
          id: row.id,
          date: dateKeyInZone(new Date(row.started_at), timeZone),
          sport: row.sport,
          duration_seconds: row.duration_seconds,
          distance_m: row.distance_m,
          elevation_m: row.elevation_m,
          avg_hr: row.avg_hr,
          avg_power: row.avg_power,
          session_type: row.session_type,
          load: metrics?.potential_load ?? null,
          intensity: metrics?.intensity ?? null,
          data_quality: metrics?.data_quality ?? null,
        };
      })
      .filter((row) => row.date >= from && row.date <= to);
    return { result: rows };
  }
  if (name === "get_activity") {
    const { data, error } = await client
      .from("activities")
      .select(
        "id, sport, subsport, started_at, duration_seconds, distance_m, elevation_m, avg_hr, max_hr, avg_power, session_type, activity_metrics(potential_load, intensity, aerobic_load, specific_load, load_method, data_quality, training_mix)",
      )
      .eq("id", str(args.id))
      .eq("intelligence_eligible", true)
      .maybeSingle();
    if (error) {
      return { result: { error: error.message } };
    }
    if (!data) {
      return { result: { error: "Activity not found or not eligible for Ask Ahead." } };
    }
    return { result: data };
  }
  if (name === "get_route_history") {
    const activityId = str(args.activity_id);
    const { data: mine, error: mineError } = await client
      .from("activity_routes")
      .select("route_cluster_id, route_overlap, route_similarity, direction_match")
      .eq("activity_id", activityId)
      .maybeSingle();
    if (mineError) {
      return { result: { error: mineError.message } };
    }
    if (!mine?.route_cluster_id) {
      return { result: { attempts: 0, note: "No repeated route group for this activity." } };
    }
    const [{ data: cluster }, { data: memberRows }] = await Promise.all([
      client
        .from("route_clusters")
        .select("attempt_count, typical_distance_m, typical_elevation_m, sport")
        .eq("id", mine.route_cluster_id)
        .maybeSingle(),
      client
        .from("activity_routes")
        .select("activity_id, route_overlap")
        .eq("route_cluster_id", mine.route_cluster_id),
    ]);
    const ids = (memberRows ?? []).map((row) => row.activity_id);
    const { data: activityRows } = ids.length
      ? await client
          .from("activities")
          .select(
            "id, started_at, duration_seconds, moving_seconds, elapsed_seconds, distance_m, avg_hr, avg_speed_mps",
          )
          .in("id", ids)
      : { data: [] };
    const byId = new Map((activityRows ?? []).map((row) => [row.id, row]));
    const attempts = (memberRows ?? []).flatMap((row) => {
      const activity = byId.get(row.activity_id);
      if (!activity) {
        return [];
      }
      return [
        {
          activityId: activity.id,
          startedAt: activity.started_at,
          durationSeconds: activity.duration_seconds,
          movingSeconds: activity.moving_seconds,
          elapsedSeconds: activity.elapsed_seconds,
          distanceM: activity.distance_m,
          avgHr: activity.avg_hr,
          avgSpeedMps: activity.avg_speed_mps,
          overlap: row.route_overlap,
        },
      ];
    });
    const current = attempts.find((attempt) => attempt.activityId === activityId);
    if (!current) {
      return { result: { attempts: 0, note: "No repeated route group for this activity." } };
    }
    const comparison = routeComparison({
      current,
      attempts,
      typicalDistanceM: cluster?.typical_distance_m ?? null,
    });
    return {
      result: {
        sport: cluster?.sport ?? null,
        attempt_count: cluster?.attempt_count ?? attempts.length,
        typical_distance_m: cluster?.typical_distance_m ?? null,
        this_activity: {
          date: dateKeyInZone(new Date(current.startedAt), timeZone),
          duration_seconds: current.durationSeconds,
          moving_seconds: current.movingSeconds,
          avg_hr: current.avgHr,
          avg_speed_mps: current.avgSpeedMps,
          overlap: mine.route_overlap,
        },
        comparison,
        history: attempts
          .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
          .map((attempt) => ({
            date: dateKeyInZone(new Date(attempt.startedAt), timeZone),
            duration_seconds: attempt.durationSeconds,
            moving_seconds: attempt.movingSeconds,
            avg_hr: attempt.avgHr,
            avg_speed_mps: attempt.avgSpeedMps,
          })),
      },
    };
  }
  if (name === "get_load_series") {
    const { data, error } = await client
      .from("daily_loads")
      .select(
        "date, training_load, fitness, fatigue, form, potential, aerobic_reserve, specific_capacity, acute_fatigue",
      )
      .gte("date", str(args.from))
      .lte("date", str(args.to))
      .order("date", { ascending: true });
    if (error) {
      return { result: { error: error.message } };
    }
    return { result: data ?? [] };
  }
  if (name === "get_wellness") {
    const { data, error } = await client
      .from("daily_recovery")
      .select("date, resting_hr, sleep_minutes, sleep_hrv_ms, sleep_score, stress_avg, source")
      .gte("date", str(args.from))
      .lte("date", str(args.to))
      .order("date", { ascending: true });
    if (error) {
      return { result: { error: error.message } };
    }
    return { result: presentWellnessFeed(data ?? []) };
  }
  if (name === "remember") {
    const fact = str(args.fact).trim().slice(0, 400);
    if (!fact) {
      return { result: { error: "Empty fact." } };
    }
    const { data: profile, error: readError } = await client
      .from("profiles")
      .select("id")
      .eq("id", athleteId)
      .maybeSingle();
    if (readError) {
      return { result: { error: readError.message } };
    }
    if (!profile) {
      return { result: { error: "No profile." } };
    }
    const { error } = await client.from("athlete_memories").insert({
      athlete_id: athleteId,
      type: "fact",
      content: fact,
      confidence: 0.9,
      importance: 0.6,
    });
    if (error) {
      return { result: { error: error.message } };
    }
    return { result: { remembered: fact } };
  }
  if (name === "propose_calendar_changes") {
    const mutations = parseDiaryMutations(args.mutations);
    if (mutations.length === 0) {
      return { result: { error: "No valid mutations." } };
    }
    const proposal: CalendarProposal = {
      status: "pending",
      rationale: str(args.rationale),
      mutations,
      operations: [],
      snapshot: [],
    };
    return {
      result: {
        status: "awaiting_apply",
        count: mutations.length,
        mutations,
      },
      proposal,
    };
  }
  return { result: { error: `Unknown tool ${name}` } };
}
