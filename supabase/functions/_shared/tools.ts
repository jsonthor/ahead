import type { UserClient } from "./client.ts";
import { inferPerformance } from "./performance.ts";
import {
  parseOperations,
  referencedSessionIds,
  SNAPSHOT_COLUMNS,
  type CalendarOperation,
  type ItemSnapshot,
} from "./operations.ts";

const TOOLS = [
  {
    type: "function",
    name: "get_current_training_state",
    description:
      "The dashboard summary: Performance (integer score, 7-day delta, and Building / Maintaining / Declining / Unknown) plus Fitness, Fatigue, Form from daily_loads. Performance is the one verdict. Fitness rising is stimulus, not proof of gain. Already rounded to match the UI. JSON field for the daily Performance score is `potential`. Never recompute these numbers. Does not include calendar — use get_calendar and get_upcoming_races.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: { date: { type: "string", description: "YYYY-MM-DD, defaults to today" } },
      required: [],
    },
    strict: false,
  },
  {
    type: "function",
    name: "get_training_summary",
    description:
      "This-week-style summary for an inclusive date range: sessions, formatted duration, load, easy/specific mix, plus dashboard-rounded Performance/Fitness at start and end from daily_loads. Use this instead of summing activities. JSON field for Performance is `potential`. Never treat start/end Performance as something to recalculate.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        start: { type: "string" },
        end: { type: "string" },
      },
      required: ["start", "end"],
    },
    strict: true,
  },
  {
    type: "function",
    name: "compare_training_periods",
    description:
      "Compare two inclusive date ranges using the same summaries as get_training_summary. Backend does the maths; you interpret. Headline Performance/Fitness/Fatigue/Form are dashboard-rounded daily_loads values (Performance JSON field: `potential`).",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        periodA: {
          type: "object",
          additionalProperties: false,
          properties: { start: { type: "string" }, end: { type: "string" } },
          required: ["start", "end"],
        },
        periodB: {
          type: "object",
          additionalProperties: false,
          properties: { start: { type: "string" }, end: { type: "string" } },
          required: ["start", "end"],
        },
      },
      required: ["periodA", "periodB"],
    },
    strict: true,
  },
  {
    type: "function",
    name: "get_activities",
    description: "List intelligence-eligible completed activities in a date range.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        start: { type: "string" },
        end: { type: "string" },
        sport: { type: "string" },
      },
      required: ["start", "end"],
    },
    strict: false,
  },
  {
    type: "function",
    name: "get_activity",
    description: "One completed activity summary by id. Do not invent streams.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: { id: { type: "string" } },
      required: ["id"],
    },
    strict: true,
  },
  {
    type: "function",
    name: "get_route_history",
    description:
      "Repeated-route group for one completed activity: attempt count, today vs typical time/speed/HR, similar-heart-rate comparison, and prior attempts. Use when they ask if they are getting faster on the same roads, or why this ride compared to usual. Pass the open activity id from uiContext when present. Do not invent a route name.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: { activity_id: { type: "string" } },
      required: ["activity_id"],
    },
    strict: true,
  },
  {
    type: "function",
    name: "get_calendar",
    description:
      "Planned training, rest, and races between two inclusive dates. Cite events by citeAs / title, never by id. For a week recommendation, fetch today through Sunday.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        start: { type: "string" },
        end: { type: "string" },
      },
      required: ["start", "end"],
    },
    strict: true,
  },
  {
    type: "function",
    name: "get_races",
    description: "Races on the Potential calendar in an explicit date range. Cite by citeAs / title, never by id.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        start: { type: "string" },
        end: { type: "string" },
      },
      required: ["start", "end"],
    },
    strict: true,
  },
  {
    type: "function",
    name: "get_upcoming_races",
    description:
      "Upcoming races on the Potential calendar. Defaults to today through the next 3 weeks. Call this before recommending. Cite by citeAs / title, never by id.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        start: { type: "string", description: "YYYY-MM-DD, defaults to today" },
        end: { type: "string", description: "YYYY-MM-DD, defaults to 20 days after start" },
      },
      required: [],
    },
    strict: false,
  },
  {
    type: "function",
    name: "get_wellness",
    description:
      "Daily recovery observations: overnight HRV, plausible overnight sleep, resting HR, and stress. Missing fields are absent from the stored feed — do not invent them or treat blanks as poor recovery. Sleep under 2 hours is omitted. If coverage is thin, do not steer training from this feed. Never treat a blank resting HR as bad recovery.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        start: { type: "string" },
        end: { type: "string" },
      },
      required: ["start", "end"],
    },
    strict: true,
  },
  {
    type: "function",
    name: "search_athlete_memory",
    description: "Relevant durable memories (facts, preferences, constraints, decisions). Not the whole store.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string" },
        limit: { type: "number" },
      },
      required: ["query"],
    },
    strict: false,
  },
  {
    type: "function",
    name: "save_athlete_memory",
    description:
      "Store one durable fact, preference, constraint, or decision. Not transient sleep/soreness.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        type: { type: "string", enum: ["fact", "preference", "constraint", "decision"] },
        content: { type: "string" },
        importance: { type: "number" },
      },
      required: ["type", "content"],
    },
    strict: false,
  },
  {
    type: "function",
    name: "propose_calendar_changes",
    description:
      "Draft the diary change in this turn whenever you recommend sessions or a week's shape. Does not write the calendar — the athlete must Apply. Do not wait to be asked to add it. Put the why in your chat message, not in rationale. For each create_session include title, sport, durationMinutes, expectedLoad, purpose, intensity, and structure (named blocks: Warm-up / Main / Finish / Cool-down with the prescribed work). Do not invent UUIDs — use session ids from calendar tools when moving or editing. Do not create rest-day events.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        rationale: { type: "string" },
        operations: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
      },
      required: ["operations"],
    },
    strict: false,
  },
] as const;

export const OPENAI_TOOLS = TOOLS;

function str(value: unknown) {
  return typeof value === "string" ? value : "";
}

function localDate(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function padRange(start: string, end: string) {
  const from = new Date(`${start}T00:00:00.000Z`);
  from.setUTCDate(from.getUTCDate() - 1);
  const to = new Date(`${end}T00:00:00.000Z`);
  to.setUTCDate(to.getUTCDate() + 2);
  return { from: from.toISOString(), to: to.toISOString() };
}

function addDaysToKey(key: string, days: number) {
  const date = new Date(`${key}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function todayKey(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function citeAs(row: Record<string, unknown>) {
  const title = typeof row.title === "string" ? row.title.trim() : "";
  if (title) {
    return title;
  }
  if (row.intent === "race") {
    return "race";
  }
  const sport = typeof row.sport === "string" ? row.sport.trim() : "";
  return sport || "session";
}

function presentCalendarItem(row: Record<string, unknown>) {
  return {
    date: row.date ?? null,
    sport: row.sport ?? null,
    title: typeof row.title === "string" && row.title.trim() ? row.title.trim() : null,
    intent: row.intent ?? null,
    importance: row.importance ?? null,
    planned_seconds: row.planned_seconds ?? null,
    planned_distance_m: row.planned_distance_m ?? null,
    planned_load: row.planned_load ?? null,
    purpose: row.purpose ?? null,
    notes: row.notes ?? null,
    workout: row.workout ?? null,
    citeAs: citeAs(row),
    id: row.id ?? null,
  };
}

async function fetchRaces(client: UserClient, start: string, end: string) {
  const { data, error } = await client
    .from("calendar_items")
    .select("id, date, sport, title, importance, planned_seconds, notes, intent")
    .eq("intent", "race")
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: true });
  if (error) {
    return { error: error.message };
  }
  return (data ?? []).map((row) => presentCalendarItem(row as Record<string, unknown>));
}

export type ToolExecution = {
  result: unknown;
  proposal?: {
    id: string;
    status: "pending";
    operations: CalendarOperation[];
    snapshot: ItemSnapshot[];
  };
};

export async function executeTool(
  client: UserClient,
  input: {
    athleteId: string;
    timeZone: string;
    conversationId: string | null;
    name: string;
    args: Record<string, unknown>;
  },
): Promise<ToolExecution> {
  const { name, args, athleteId, timeZone, conversationId } = input;

  if (name === "get_current_training_state") {
    const asOf = str(args.date) || todayKey(timeZone);
    const [{ data, error }, series] = await Promise.all([
      client.rpc("ai_current_training_state", {
        p_date: str(args.date) || undefined,
      }),
      client
        .from("daily_loads")
        .select("date, potential, aerobic_reserve, specific_capacity")
        .lte("date", asOf)
        .order("date", { ascending: false })
        .limit(90),
    ]);
    if (error) {
      return { result: { error: error.message } };
    }
    const performance = inferPerformance([...(series.data ?? [])].reverse(), asOf);
    return {
      result: {
        ...(data && typeof data === "object" ? data : { data }),
        performance: {
          score: performance.score,
          delta: performance.delta,
          state: performance.state,
          label: performance.label,
          recentLabel: performance.recentLabel,
          summary: performance.summary,
          trend: performance.trend,
          guarded: performance.guarded,
        },
      },
    };
  }

  if (name === "get_training_summary") {
    const { data, error } = await client.rpc("ai_training_summary", {
      p_start: str(args.start),
      p_end: str(args.end),
    });
    return { result: error ? { error: error.message } : data };
  }

  if (name === "compare_training_periods") {
    const a = (args.periodA ?? {}) as Record<string, unknown>;
    const b = (args.periodB ?? {}) as Record<string, unknown>;
    const { data, error } = await client.rpc("ai_compare_training_periods", {
      a_start: str(a.start),
      a_end: str(a.end),
      b_start: str(b.start),
      b_end: str(b.end),
    });
    return { result: error ? { error: error.message } : data };
  }

  if (name === "get_calendar") {
    const { data, error } = await client
      .from("calendar_items")
      .select(
        "id, date, sport, title, intent, importance, planned_seconds, planned_distance_m, planned_load, purpose, notes, workout",
      )
      .gte("date", str(args.start))
      .lte("date", str(args.end))
      .order("date", { ascending: true });
    if (error) {
      return { result: { error: error.message } };
    }
    return {
      result: (data ?? []).map((row) => presentCalendarItem(row as Record<string, unknown>)),
    };
  }

  if (name === "get_races") {
    const result = await fetchRaces(client, str(args.start), str(args.end));
    return { result };
  }

  if (name === "get_upcoming_races") {
    const start = str(args.start) || todayKey(timeZone);
    const end = str(args.end) || addDaysToKey(start, 20);
    const result = await fetchRaces(client, start, end);
    return { result };
  }

  if (name === "get_wellness") {
    const { data, error } = await client
      .from("daily_recovery")
      .select("date, resting_hr, sleep_minutes, sleep_hrv_ms, sleep_score, stress_avg, source")
      .gte("date", str(args.start))
      .lte("date", str(args.end))
      .order("date", { ascending: true });
    if (error) {
      return { result: { error: error.message } };
    }
    const days = (data ?? []).map((row) => {
      const sleep =
        row.sleep_minutes != null && row.sleep_minutes >= 120 && row.sleep_minutes <= 16 * 60
          ? row.sleep_minutes
          : null;
      return {
        date: row.date,
        restingHr: row.resting_hr,
        sleepHrvMs: row.sleep_hrv_ms,
        sleepMinutes: sleep,
        sleepScore: row.sleep_score,
        stressAvg: row.stress_avg,
        source: row.source,
      };
    });
    const hrv = days.filter((day) => day.sleepHrvMs != null).length;
    const restingHr = days.filter((day) => day.restingHr != null).length;
    const stress = days.filter((day) => day.stressAvg != null).length;
    const sleep = days.filter((day) => day.sleepMinutes != null).length;
    const thin = days.length > 0 && hrv === 0 && restingHr === 0 && stress === 0;
    return {
      result: {
        days,
        coverage: { days: days.length, sleep, hrv, restingHr, stress },
        ...(thin
          ? {
              note: "Recovery fields are missing from stored days. Do not invent sleep, HRV, resting HR, or stress. Lean on completed load and how the athlete feels.",
            }
          : {}),
      },
    };
  }

  if (name === "get_activities") {
    const start = str(args.start);
    const end = str(args.end);
    const range = padRange(start, end);
    let query = client
      .from("activities")
      .select(
        "id, sport, started_at, duration_seconds, distance_m, avg_hr, avg_power, session_type, activity_metrics(potential_load, intensity, data_quality, training_mix)",
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
    const rows = ((data as Record<string, unknown>[] | null) ?? [])
      .map((row) => {
        const metricsRaw = row.activity_metrics;
        const metrics = Array.isArray(metricsRaw) ? metricsRaw[0] : metricsRaw;
        const m = (metrics ?? {}) as Record<string, unknown>;
        const date = localDate(String(row.started_at), timeZone);
        const sport = typeof row.sport === "string" ? row.sport : "session";
        return {
          date,
          sport: row.sport,
          duration_seconds: row.duration_seconds,
          distance_m: row.distance_m,
          avg_hr: row.avg_hr,
          avg_power: row.avg_power,
          session_type: row.session_type,
          load: m.potential_load ?? null,
          intensity: m.intensity ?? null,
          data_quality: m.data_quality ?? null,
          citeAs: `${sport} on ${date}`,
          id: row.id,
        };
      })
      .filter((row) => row.date >= start && row.date <= end);
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
      .select("route_cluster_id, route_overlap")
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
        .select("attempt_count, typical_distance_m, sport")
        .eq("id", mine.route_cluster_id)
        .maybeSingle(),
      client
        .from("activity_routes")
        .select("activity_id, route_overlap")
        .eq("route_cluster_id", mine.route_cluster_id),
    ]);
    const ids = ((memberRows as { activity_id: string; route_overlap: number | null }[] | null) ?? []).map(
      (row) => row.activity_id,
    );
    const { data: activityRows } = ids.length
      ? await client
          .from("activities")
          .select("id, started_at, duration_seconds, moving_seconds, avg_hr, avg_speed_mps")
          .in("id", ids)
      : { data: [] };
    const byId = new Map(
      ((activityRows as Record<string, unknown>[] | null) ?? []).map((row) => [String(row.id), row]),
    );
    const history = (
      (memberRows as { activity_id: string; route_overlap: number | null }[] | null) ?? []
    ).flatMap((row) => {
      const activity = byId.get(row.activity_id);
      if (!activity?.id || !activity.started_at) {
        return [];
      }
      return [
        {
          id: String(activity.id),
          date: localDate(String(activity.started_at), timeZone),
          duration_seconds: typeof activity.duration_seconds === "number" ? activity.duration_seconds : null,
          moving_seconds: typeof activity.moving_seconds === "number" ? activity.moving_seconds : null,
          avg_hr: typeof activity.avg_hr === "number" ? activity.avg_hr : null,
          avg_speed_mps: typeof activity.avg_speed_mps === "number" ? activity.avg_speed_mps : null,
        },
      ];
    });
    const current = history.find((row) => row.id === activityId);
    const others = history.filter((row) => row.id !== activityId);
    const times = others
      .map((row) => row.moving_seconds ?? row.duration_seconds)
      .filter((value): value is number => typeof value === "number" && value > 0)
      .sort((a, b) => a - b);
    const hrs = others
      .map((row) => row.avg_hr)
      .filter((value): value is number => typeof value === "number")
      .sort((a, b) => a - b);
    const speeds = others
      .map((row) => row.avg_speed_mps)
      .filter((value): value is number => typeof value === "number" && value > 0)
      .sort((a, b) => a - b);
    const mid = (values: number[]) =>
      values.length === 0
        ? null
        : values.length % 2 === 0
          ? ((values[values.length / 2 - 1] ?? 0) + (values[values.length / 2] ?? 0)) / 2
          : (values[Math.floor(values.length / 2)] ?? null);
    const typicalTime = mid(times);
    const typicalHr = mid(hrs);
    const typicalSpeed = mid(speeds);
    const currentTime = current ? current.moving_seconds ?? current.duration_seconds : null;
    const similar = others.filter(
      (row) =>
        current?.avg_hr != null &&
        row.avg_hr != null &&
        Math.abs(row.avg_hr - current.avg_hr) <= 5,
    );
    const similarSpeeds = similar
      .map((row) => row.avg_speed_mps)
      .filter((value): value is number => typeof value === "number" && value > 0)
      .sort((a, b) => a - b);
    const similarMedian = mid(similarSpeeds);
    const fasterPct =
      current?.avg_speed_mps && similarMedian
        ? Math.round(((current.avg_speed_mps - similarMedian) / similarMedian) * 1000) / 10
        : null;
    return {
      result: {
        sport: cluster?.sport ?? null,
        attempt_count: cluster?.attempt_count ?? history.length,
        typical_distance_m: cluster?.typical_distance_m ?? null,
        this_activity: current
          ? {
              date: current.date,
              duration_seconds: current.duration_seconds,
              moving_seconds: current.moving_seconds,
              avg_hr: current.avg_hr,
              avg_speed_mps: current.avg_speed_mps,
              overlap: mine.route_overlap,
            }
          : null,
        typical: {
          duration_seconds: typicalTime,
          avg_hr: typicalHr != null ? Math.round(typicalHr) : null,
          avg_speed_mps: typicalSpeed,
        },
        vs_typical: {
          seconds_faster:
            typicalTime != null && currentTime != null ? Math.round(typicalTime - currentTime) : null,
          hr_delta:
            typicalHr != null && current?.avg_hr != null
              ? current.avg_hr - Math.round(typicalHr)
              : null,
        },
        similar_hr:
          similar.length >= 3 && fasterPct != null
            ? { count: similar.length, faster_pct: fasterPct }
            : null,
        history: history
          .sort((a, b) => a.date.localeCompare(b.date))
          .map(({ id: _id, ...row }) => row),
      },
    };
  }

  if (name === "search_athlete_memory") {
    const { data, error } = await client.rpc("search_athlete_memory", {
      p_query: str(args.query),
      p_limit: typeof args.limit === "number" ? args.limit : 8,
    });
    return { result: error ? { error: error.message } : data ?? [] };
  }

  if (name === "save_athlete_memory") {
    const type = str(args.type);
    const content = str(args.content).trim().slice(0, 800);
    if (!["fact", "preference", "constraint", "decision"].includes(type) || !content) {
      return { result: { error: "Need type and content." } };
    }
    const { data: existing } = await client
      .from("athlete_memories")
      .select("id")
      .eq("athlete_id", athleteId)
      .is("superseded_at", null)
      .ilike("content", content)
      .maybeSingle();
    if (existing) {
      return { result: { remembered: content, duplicate: true } };
    }
    const importance =
      typeof args.importance === "number" && args.importance >= 0 && args.importance <= 1
        ? args.importance
        : 0.6;
    const { error } = await client.from("athlete_memories").insert({
      athlete_id: athleteId,
      type,
      content,
      importance,
      confidence: 0.9,
      source_conversation_id: conversationId,
    });
    return { result: error ? { error: error.message } : { remembered: content } };
  }

  if (name === "propose_calendar_changes") {
    const operations = parseOperations(args.operations);
    if (operations.length === 0) {
      return { result: { error: "No valid operations." } };
    }
    const ids = referencedSessionIds(operations);
    let snapshot: ItemSnapshot[] = [];
    if (ids.length > 0) {
      const { data, error } = await client
        .from("calendar_items")
        .select(SNAPSHOT_COLUMNS)
        .in("id", ids);
      if (error) {
        return { result: { error: error.message } };
      }
      snapshot = (data ?? []) as ItemSnapshot[];
    }
    const { data, error } = await client
      .from("calendar_proposals")
      .insert({
        athlete_id: athleteId,
        conversation_id: conversationId,
        operations,
        snapshot,
        rationale: str(args.rationale),
        status: "pending",
      })
      .select("id")
      .single();
    if (error || !data) {
      return { result: { error: error?.message ?? "Could not store proposal." } };
    }
    const proposal = {
      id: data.id as string,
      status: "pending" as const,
      operations,
      snapshot,
    };
    return {
      result: { status: "awaiting_apply", proposalId: data.id, count: operations.length },
      proposal,
    };
  }

  return { result: { error: `Unknown tool ${name}` } };
}
