"use client";

import { useAppUser } from "@/components/app/app-shell";
import type { CalendarEvent } from "@/lib/calendar-event";
import { askAboutSession } from "@/lib/session-note/ask";
import type { SessionActivityInput } from "@/lib/session-note/packet";
import { ensureSessionNote, setOpenSessionNote } from "@/lib/session-note/store";
import type { SessionNote } from "@/lib/session-note/types";
import { useEffect, useState } from "react";

export function SessionNoteCard({
  activity,
  event,
}: {
  activity: SessionActivityInput;
  event: CalendarEvent | null;
}) {
  const user = useAppUser();
  const [note, setNote] = useState<SessionNote | null>(null);
  const metrics = Array.isArray(activity.activity_metrics)
    ? activity.activity_metrics[0]
    : activity.activity_metrics;
  const load = metrics?.potential_load ?? null;

  useEffect(() => {
    let cancelled = false;
    void ensureSessionNote({
      athleteId: user.id,
      timeZone: user.timezone,
      activity,
      event,
    })
      .then((next) => {
        if (!cancelled) {
          setNote(next);
        }
      })
      .catch((error) => {
        console.error("Session note failed", error);
      });
    return () => {
      cancelled = true;
      setOpenSessionNote(null);
    };
  }, [
    activity,
    event,
    load,
    user.id,
    user.timezone,
  ]);

  if (!note) {
    return null;
  }

  return (
    <section>
      <p className="kicker">This session</p>
      <p className="mt-3 text-[15px] leading-6 text-ink">{note.reading}</p>
      <button
        type="button"
        className="mt-4 inline-flex h-10 items-center text-[0.9375rem] font-medium text-ink underline decoration-line decoration-2 underline-offset-6 hover:decoration-ink"
        onClick={() => askAboutSession()}
      >
        Ask about this session
      </button>
    </section>
  );
}
