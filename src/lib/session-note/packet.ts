import { addDaysToKey, dateKeyInZone, mondayKeyInZone } from "@/lib/calendar";
import { CALENDAR_EVENT_COLUMNS, parseCalendarEvent, type CalendarEvent } from "@/lib/calendar-event";
import { looksLikeRace } from "@/lib/coach-review/recognize";
import { hydrateCoachReviews, latestCoachReview } from "@/lib/coach-review/store";
import {
  formatSignedDuration,
  formatSignedHr,
  routeComparison,
  type RouteAttempt,
} from "@/lib/route/compare";
import { createClient } from "@/lib/supabase/client";
import { workoutSportLabel } from "@/lib/workout";
import type { SessionMix, SessionRole } from "@/lib/session-note/types";

export type SessionActivityInput = {
  id: string;
  sport: string;
  subsport: string | null;
  started_at: string;
  duration_seconds: number | null;
  moving_seconds?: number | null;
  elapsed_seconds?: number | null;
  distance_m?: number | null;
  avg_hr: number | null;
  avg_speed_mps: number | null;
  session_type: string | null;
  activity_metrics:
    | {
        potential_load: number | null;
        intensity: number | null;
        training_mix: unknown;
        intensity_classification?: string | null;
      }
    | {
        potential_load: number | null;
        intensity: number | null;
        training_mix: unknown;
        intensity_classification?: string | null;
      }[]
    | null;
};

export type WeekSibling = {
  id: string;
  date: string;
  title: string;
  load: number | null;
  minutes: number | null;
  race: boolean;
};

export type SessionPacket = {
  activityId: string;
  title: string;
  sport: string;
  date: string;
  weekday: string;
  durationSeconds: number | null;
  load: number | null;
  intensity: number | null;
  mix: SessionMix;
  race: boolean;
  opener: boolean;
  planned: {
    title: string | null;
    purpose: string | null;
    minutes: number | null;
    load: number | null;
  } | null;
  week: {
    start: string;
    end: string;
    sessions: WeekSibling[];
  };
  route: {
    attemptCount: number;
    versusTypical: string | null;
  } | null;
  intensityStatus: "trusted" | "uncertain" | "unavailable";
  nextRace: {
    date: string;
    title: string;
  } | null;
  review: {
    reviewId: string;
    immediatePriority: string | null;
    nextObjective: string | null;
    nextKeep: string[];
    nextChange: string[];
  } | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function asMix(value: unknown): SessionMix {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "unknown";
  }
  const row = value as Record<string, unknown>;
  const easy = Number(row.easy_seconds) || 0;
  const specific = Number(row.specific_seconds) || 0;
  const high = Number(row.high_seconds) || 0;
  const total = easy + specific + high;
  if (total <= 0) {
    return "unknown";
  }
  if (easy / total >= 0.6) {
    return "easy";
  }
  if ((specific + high) / total >= 0.55) {
    return "specific";
  }
  return "mixed";
}

function titleFor(activity: SessionActivityInput, event: CalendarEvent | null) {
  if (event?.title) {
    return event.title;
  }
  const sub = activity.subsport?.replaceAll("_", " ");
  if (sub) {
    return sub.charAt(0).toUpperCase() + sub.slice(1);
  }
  return workoutSportLabel(activity.sport);
}

const OPENER_RE = /\bopeners?\b/i;

export function pickNextRace(
  date: string,
  races: { date: string; title: string }[],
) {
  return (
    [...races]
      .filter((race) => race.date >= date)
      .sort((left, right) => left.date.localeCompare(right.date))[0] ?? null
  );
}

export function sessionRole(packet: SessionPacket): SessionRole {
  if (packet.race) {
    return "race";
  }
  if (packet.opener) {
    return "opener";
  }
  const loads = packet.week.sessions
    .map((row) => row.load)
    .filter((value): value is number => value != null && value > 0);
  const peak = loads.length ? Math.max(...loads) : null;
  const mine = packet.load;
  if (peak != null && mine != null && mine === peak && packet.week.sessions.length > 1) {
    return "main-stress";
  }
  if (
    peak != null &&
    mine != null &&
    peak >= 20 &&
    mine <= peak * 0.45 &&
    packet.mix !== "specific"
  ) {
    return "easy-contrast";
  }
  if (packet.mix === "specific") {
    return "quality";
  }
  if (packet.mix === "easy") {
    return "aerobic";
  }
  if (peak != null && mine != null && mine === peak) {
    return "main-stress";
  }
  return "other";
}

async function loadRouteBrief(activity: SessionActivityInput) {
  const supabase = createClient();
  const { data: mine } = await supabase
    .from("activity_routes")
    .select("route_cluster_id, route_overlap")
    .eq("activity_id", activity.id)
    .maybeSingle();
  if (!mine?.route_cluster_id) {
    return null;
  }
  const [{ data: cluster }, { data: memberRows }] = await Promise.all([
    supabase
      .from("route_clusters")
      .select("typical_distance_m")
      .eq("id", mine.route_cluster_id)
      .maybeSingle(),
    supabase
      .from("activity_routes")
      .select("activity_id, route_overlap")
      .eq("route_cluster_id", mine.route_cluster_id),
  ]);
  const ids = (memberRows ?? []).map((row) => row.activity_id);
  const { data: activityRows } = ids.length
    ? await supabase
        .from("activities")
        .select(
          "id, started_at, duration_seconds, moving_seconds, elapsed_seconds, distance_m, avg_hr, avg_speed_mps",
        )
        .in("id", ids)
    : { data: [] };
  const overlap = new Map(
    (memberRows ?? []).map((row) => [row.activity_id, row.route_overlap]),
  );
  const attempts: RouteAttempt[] = (activityRows ?? []).map((row) => ({
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
  const current = attempts.find((row) => row.activityId === activity.id) ?? {
    activityId: activity.id,
    startedAt: activity.started_at,
    durationSeconds: activity.duration_seconds,
    movingSeconds: activity.moving_seconds ?? null,
    elapsedSeconds: activity.elapsed_seconds ?? null,
    distanceM: activity.distance_m ?? null,
    avgHr: activity.avg_hr,
    avgSpeedMps: activity.avg_speed_mps,
    overlap: mine.route_overlap,
  };
  const compared = routeComparison({
    current,
    attempts,
    typicalDistanceM: cluster?.typical_distance_m ?? null,
  });
  if (!compared) {
    return null;
  }
  let versusTypical: string | null = null;
  if (compared.similarHr) {
    const faster = compared.similarHr.fasterPct;
    versusTypical =
      faster > 1
        ? `${faster.toFixed(1)}% quicker than similar-heart-rate efforts`
        : faster < -1
          ? `${Math.abs(faster).toFixed(1)}% slower than similar-heart-rate efforts`
          : "about the same speed as similar-heart-rate efforts";
  } else if (compared.timeDeltaSeconds != null && !compared.comparability.caution) {
    versusTypical = formatSignedDuration(compared.timeDeltaSeconds);
    if (compared.hrDelta != null) {
      versusTypical = `${versusTypical}, ${formatSignedHr(compared.hrDelta)}`;
    }
  }
  return {
    attemptCount: compared.attemptCount,
    versusTypical,
  };
}

export async function loadSessionPacket(input: {
  athleteId: string;
  timeZone: string;
  activity: SessionActivityInput;
  event: CalendarEvent | null;
}): Promise<SessionPacket> {
  const supabase = createClient();
  const date = dateKeyInZone(new Date(input.activity.started_at), input.timeZone);
  const weekStart = mondayKeyInZone(new Date(input.activity.started_at), input.timeZone);
  const weekEnd = addDaysToKey(weekStart, 6);
  const metrics = one(input.activity.activity_metrics);
  const title = titleFor(input.activity, input.event);
  const race = looksLikeRace({
    intent: input.event?.intent,
    sessionType: input.activity.session_type,
    linkedToRace: input.event?.intent === "race",
  });
  const opener = !race && OPENER_RE.test(`${title} ${input.event?.purpose ?? ""}`);

  const [{ data: weekRows }, { data: raceRows }, route] = await Promise.all([
    supabase
      .from("activities")
      .select(
        "id, sport, subsport, started_at, duration_seconds, session_type, activity_metrics(potential_load)",
      )
      .eq("athlete_id", input.athleteId)
      .gte("started_at", `${addDaysToKey(weekStart, -1)}T00:00:00.000Z`)
      .lt("started_at", `${addDaysToKey(weekEnd, 2)}T00:00:00.000Z`)
      .order("started_at", { ascending: true }),
    supabase
      .from("calendar_items")
      .select(CALENDAR_EVENT_COLUMNS)
      .eq("athlete_id", input.athleteId)
      .eq("intent", "race")
      .gte("date", date)
      .lte("date", addDaysToKey(date, 10))
      .order("date"),
    loadRouteBrief(input.activity),
    hydrateCoachReviews(input.athleteId).catch(() => null),
  ]);

  const sessions: WeekSibling[] = (weekRows ?? [])
    .map((row) => {
      const day = dateKeyInZone(new Date(row.started_at), input.timeZone);
      if (day < weekStart || day > weekEnd) {
        return null;
      }
      const load = one(row.activity_metrics as { potential_load: number | null }[] | null)
        ?.potential_load ?? null;
      return {
        id: row.id,
        date: day,
        title: row.subsport?.replaceAll("_", " ") || workoutSportLabel(row.sport),
        load,
        minutes: row.duration_seconds != null ? Math.round(row.duration_seconds / 60) : null,
        race: looksLikeRace({ sessionType: row.session_type }),
      };
    })
    .filter((row): row is WeekSibling => Boolean(row));

  const calendarRaces = (raceRows ?? [])
    .map(parseCalendarEvent)
    .filter((event) => event.intent === "race")
    .map((event) => ({ date: event.date, title: event.title }));
  const activityRaces = sessions
    .filter((row) => row.race)
    .map((row) => ({ date: row.date, title: row.title }));
  const nextRace = pickNextRace(date, [...calendarRaces, ...activityRaces]);

  const review = latestCoachReview(input.athleteId);

  return {
    activityId: input.activity.id,
    title,
    sport: input.activity.sport,
    date,
    weekday: new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      timeZone: "UTC",
    }).format(new Date(`${date}T12:00:00.000Z`)),
    durationSeconds: input.activity.duration_seconds,
    load: metrics?.potential_load ?? null,
    intensity: metrics?.intensity ?? null,
    race,
    opener,
    planned: input.event
      ? {
          title: input.event.title,
          purpose: input.event.purpose,
          minutes:
            input.event.planned_seconds != null
              ? Math.round(input.event.planned_seconds / 60)
              : null,
          load: input.event.planned_load,
        }
      : null,
    week: {
      start: weekStart,
      end: weekEnd,
      sessions,
    },
    route,
    intensityStatus:
      metrics?.intensity_classification === "trusted" ||
      metrics?.intensity_classification === "uncertain" ||
      metrics?.intensity_classification === "unavailable"
        ? metrics.intensity_classification
        : "unavailable",
    nextRace,
    mix:
      metrics?.intensity_classification === "trusted"
        ? asMix(metrics?.training_mix ?? null)
        : "unknown",
    review: review
      ? {
          reviewId: review.id,
          immediatePriority: review.immediatePriority ?? null,
          nextObjective: review.nextObjective || null,
          nextKeep: review.nextKeep,
          nextChange: review.nextChange,
        }
      : null,
  };
}
