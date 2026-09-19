"use client";

import { useAppUser } from "@/components/app/app-shell";
import { addDaysToKey, dateKeyInZone, formatWeekdayDate } from "@/lib/calendar";
import {
  CALENDAR_CHANGED_EVENT,
  CALENDAR_EVENT_COLUMNS,
  parseCalendarEvent,
  type CalendarEvent,
} from "@/lib/calendar-event";
import { createClient } from "@/lib/supabase/client";
import { formatDistance, formatDuration } from "@/lib/units";
import { workoutSportLabel } from "@/lib/workout";
import Link from "next/link";
import { useEffect, useState } from "react";

const LIMIT = 5;

function formatWhen(key: string, today: string) {
  if (key === today) {
    return "Today";
  }
  if (key === addDaysToKey(today, 1)) {
    return "Tomorrow";
  }
  return formatWeekdayDate(key);
}

function kindLabel(event: CalendarEvent) {
  if (event.intent === "race") {
    return event.importance ? `${event.importance} race` : "Race";
  }
  if (event.intent === "rest") {
    return "Rest";
  }
  return workoutSportLabel(event.sport);
}

export function UpcomingSessions() {
  const user = useAppUser();
  const today = dateKeyInZone(new Date(), user.timezone);
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    function load() {
      void supabase
        .from("calendar_items")
        .select(CALENDAR_EVENT_COLUMNS)
        .gte("date", today)
        .is("linked_activity_id", null)
        .order("date", { ascending: true })
        .order("intent", { ascending: true })
        .limit(LIMIT)
        .then(({ data, error }) => {
          if (cancelled) {
            return;
          }
          if (error) {
            console.error("Upcoming sessions failed", error);
            setEvents([]);
            return;
          }
          setEvents((data ?? []).map(parseCalendarEvent));
        });
    }

    load();
    window.addEventListener(CALENDAR_CHANGED_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(CALENDAR_CHANGED_EVENT, load);
    };
  }, [today]);

  if (events == null) {
    return null;
  }

  return (
    <section className="mt-12">
      <div className="flex items-baseline justify-between gap-4">
        <p className="kicker">
          Coming up
        </p>
        <Link href="/app/activities" className="text-[13px] text-ink-soft hover:text-ink">
          Activities
        </Link>
      </div>
      {events.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">
          Nothing planned. Add sessions and races on Activities.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-line overflow-hidden rounded-md border border-line">
          {events.map((event) => {
            const detail =
              formatDuration(event.planned_seconds) ??
              formatDistance(event.planned_distance_m, user.units);
            const race = event.intent === "race";
            const rest = event.intent === "rest";
            return (
              <li key={event.id}>
                <Link
                  href="/app/activities"
                  className="flex items-baseline gap-4 bg-paper-raised px-5 py-4 hover:bg-paper-sunken"
                >
                  <time
                    dateTime={event.date}
                    className="w-[6.5rem] shrink-0 text-sm text-muted"
                  >
                    {formatWhen(event.date, today)}
                  </time>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-[12px] tracking-wide uppercase ${
                        race ? "text-ember" : rest ? "text-rest" : "text-muted"
                      }`}
                    >
                      {kindLabel(event)}
                    </span>
                    <span className="mt-0.5 block truncate text-sm text-ink">
                      {event.title}
                    </span>
                  </span>
                  {detail ? (
                    <span className="mono shrink-0 text-sm text-ink-soft">
                      {detail}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
