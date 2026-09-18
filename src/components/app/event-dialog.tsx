"use client";

import { Field, inputClassName } from "@/components/auth/field";
import { useAppUser } from "@/components/app/app-shell";
import { dateKeyInZone, formatTimeInZone } from "@/lib/calendar";
import {
  CALENDAR_EVENT_COLUMNS,
  CALENDAR_SPORTS,
  defaultEventTitle,
  parseCalendarEvent,
  pickMatchingActivity,
  setEventActivityLink,
  utcRangeForLocalDate,
  type CalendarEvent,
  type CalendarImportance,
  type CalendarIntent,
} from "@/lib/calendar-event";
import { createClient } from "@/lib/supabase/client";
import {
  formatDistance,
  formatDuration,
  metersFromUserDistance,
  userDistanceFromMeters,
} from "@/lib/units";
import { workoutSportLabel, type WorkoutSport } from "@/lib/workout";
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useMemo, useState, type FormEvent } from "react";

type ActivityOption = {
  id: string;
  sport: string;
  started_at: string;
  duration_seconds: number | null;
  distance_m: number | null;
};

type Draft = {
  date: string;
  event: CalendarEvent | null;
};

export function EventDialog({
  draft,
  onClose,
  onSaved,
}: {
  draft: Draft | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const user = useAppUser();
  const event = draft?.event ?? null;
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [sport, setSport] = useState<WorkoutSport>("run");
  const [intent, setIntent] = useState<CalendarIntent>("training");
  const [importance, setImportance] = useState<CalendarImportance | "">("");
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [distance, setDistance] = useState("");
  const [notes, setNotes] = useState("");
  const [linkChoice, setLinkChoice] = useState<string | "auto">("auto");
  const [activities, setActivities] = useState<ActivityOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!draft) {
      return;
    }
    const next = draft.event;
    setTitle(next?.title ?? "");
    setDate(draft.date);
    setSport(next?.sport ?? "run");
    setIntent(next?.intent ?? "training");
    setImportance(next?.importance ?? "");
    const seconds = next?.planned_seconds ?? 0;
    setHours(seconds >= 3600 ? String(Math.floor(seconds / 3600)) : "");
    setMinutes(seconds ? String(Math.floor((seconds % 3600) / 60) || "") : "");
    setDistance(
      next?.planned_distance_m
        ? String(userDistanceFromMeters(next.planned_distance_m, user.units))
        : "",
    );
    setNotes(next?.notes ?? "");
    setLinkChoice(next?.linked_activity_id ?? "auto");
    setError(null);
  }, [draft, user.units]);

  useEffect(() => {
    if (!draft || !date) {
      setActivities([]);
      return;
    }
    const supabase = createClient();
    const range = utcRangeForLocalDate(date);
    let cancelled = false;
    void supabase
      .from("activities")
      .select("id, sport, started_at, duration_seconds, distance_m")
      .eq("status", "ready")
      .gte("started_at", range.from)
      .lt("started_at", range.to)
      .order("started_at", { ascending: true })
      .then(({ data }) => {
        if (cancelled) {
          return;
        }
        const rows = ((data as ActivityOption[] | null) ?? []).filter(
          (row) => dateKeyInZone(new Date(row.started_at), user.timezone) === date,
        );
        setActivities(rows);
      });
    return () => {
      cancelled = true;
    };
  }, [date, draft, user.timezone]);

  const autoMatch = useMemo(() => {
    if (activities.length === 0) {
      return "";
    }
    return (
      pickMatchingActivity(
        activities,
        { sport, planned_seconds: plannedSeconds(hours, minutes) },
        new Set(),
      ) ?? ""
    );
  }, [activities, hours, minutes, sport]);

  const selectedLink = linkChoice === "auto" ? autoMatch : linkChoice;

  async function handleSubmit(form: FormEvent<HTMLFormElement>) {
    form.preventDefault();
    if (!draft) {
      return;
    }
    const nextTitle = title.trim() || defaultEventTitle(intent, sport);
    const nextSeconds = plannedSeconds(hours, minutes);
    const distanceValue = Number(distance);
    const nextDistance =
      distance && Number.isFinite(distanceValue) && distanceValue > 0
        ? metersFromUserDistance(distanceValue, user.units)
        : null;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const payload = {
      athlete_id: user.id,
      date,
      sport,
      title: nextTitle,
      intent,
      importance: intent === "race" && importance ? importance : null,
      planned_seconds: nextSeconds,
      planned_distance_m: nextDistance,
      notes: notes.trim() || null,
    };
    try {
      let eventId = event?.id;
      if (eventId) {
        const { error: updateError } = await supabase
          .from("calendar_items")
          .update(payload)
          .eq("id", eventId);
        if (updateError) {
          throw updateError;
        }
      } else {
        const { data, error: insertError } = await supabase
          .from("calendar_items")
          .insert(payload)
          .select(CALENDAR_EVENT_COLUMNS)
          .single();
        if (insertError || !data) {
          throw insertError ?? new Error("Could not save the event.");
        }
        eventId = parseCalendarEvent(data).id;
      }
      await setEventActivityLink(supabase, eventId, selectedLink || null);
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the event.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!event) {
      return;
    }
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("calendar_items")
      .delete()
      .eq("id", event.id);
    setSaving(false);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    onSaved();
  }

  return (
    <Dialog.Root
      open={Boolean(draft)}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-line bg-paper-raised p-6 outline-none">
          <Dialog.Title className="text-2xl font-medium tracking-tight text-ink">
            {event ? "Edit event" : "Add event"}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-ink-soft">
            Plan training or a race. After you complete it, match the session so
            the calendar knows that was it.
          </Dialog.Description>
          <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
            {error ? (
              <p className="rounded-sm border border-danger/40 bg-paper-raised px-3 py-2 text-sm text-danger" role="alert">
                {error}
              </p>
            ) : null}
            <Field label="Title" htmlFor="event-title">
              <input
                id="event-title"
                className={inputClassName}
                value={title}
                onChange={(change) => setTitle(change.target.value)}
                placeholder={intent === "race" ? "County 10" : "Sunday long ride"}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date" htmlFor="event-date">
                <input
                  id="event-date"
                  type="date"
                  className={inputClassName}
                  value={date}
                  onChange={(change) => setDate(change.target.value)}
                  required
                />
              </Field>
              <Field label="Sport" htmlFor="event-sport">
                <select
                  id="event-sport"
                  className={inputClassName}
                  value={sport}
                  onChange={(change) => setSport(change.target.value as WorkoutSport)}
                >
                  {CALENDAR_SPORTS.map((item) => (
                    <option key={item} value={item}>
                      {workoutSportLabel(item)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <fieldset className="grid gap-1.5">
              <legend className="text-sm font-medium text-ink">What is it?</legend>
              <div className="grid grid-cols-2 gap-2">
                <Choice
                  selected={intent === "training"}
                  onClick={() => setIntent("training")}
                >
                  Training
                </Choice>
                <Choice
                  selected={intent === "race"}
                  onClick={() => setIntent("race")}
                >
                  Race
                </Choice>
              </div>
            </fieldset>
            {intent === "race" ? (
              <fieldset className="grid gap-1.5">
                <legend className="text-sm font-medium text-ink">Importance</legend>
                <div className="grid grid-cols-4 gap-2">
                  {(["", "A", "B", "C"] as const).map((value) => (
                    <Choice
                      key={value || "none"}
                      selected={importance === value}
                      onClick={() => setImportance(value)}
                    >
                      {value || "None"}
                    </Choice>
                  ))}
                </div>
              </fieldset>
            ) : null}
            <div className="grid grid-cols-3 gap-3">
              <Field label="Hours" htmlFor="event-hours">
                <input
                  id="event-hours"
                  inputMode="numeric"
                  className={inputClassName}
                  value={hours}
                  onChange={(change) => setHours(change.target.value)}
                  placeholder="0"
                />
              </Field>
              <Field label="Minutes" htmlFor="event-minutes">
                <input
                  id="event-minutes"
                  inputMode="numeric"
                  className={inputClassName}
                  value={minutes}
                  onChange={(change) => setMinutes(change.target.value)}
                  placeholder="0"
                />
              </Field>
              <Field
                label={user.units === "imperial" ? "Miles" : "Kilometres"}
                htmlFor="event-distance"
              >
                <input
                  id="event-distance"
                  inputMode="decimal"
                  className={inputClassName}
                  value={distance}
                  onChange={(change) => setDistance(change.target.value)}
                  placeholder="0"
                />
              </Field>
            </div>
            {event?.workout ? (
              <div className="rounded-sm border border-line bg-paper-raised px-3 py-3">
                <p className="text-[11px] font-medium tracking-[0.14em] text-muted uppercase">
                  Session
                </p>
                {event.created_by === "potential_ai" ? (
                  <p className="mt-1 text-[12px] text-muted">Added by Potential</p>
                ) : null}
                {event.planned_load != null ? (
                  <p className="mt-1 text-sm text-ink">Expected load {Math.round(event.planned_load)}</p>
                ) : null}
                {event.purpose ? (
                  <p className="mt-1 text-[13px] text-ink-soft">{event.purpose}</p>
                ) : null}
                <dl className="mt-3 grid gap-3">
                  {event.workout.blocks.map((block) => (
                    <div key={`${block.name}-${block.detail}`}>
                      <dt className="text-[13px] font-medium text-ink">{block.name}</dt>
                      <dd className="mt-0.5 whitespace-pre-wrap text-sm leading-5 text-ink-soft">
                        {block.detail}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : event?.planned_load != null ? (
              <p className="text-sm text-ink-soft">
                Expected load {Math.round(event.planned_load)}
              </p>
            ) : null}
            {activities.length > 0 ? (
              <Field
                label="Completed session"
                htmlFor="event-link"
                hint="When you have done this, match it so the calendar knows it happened."
              >
                <select
                  id="event-link"
                  className={inputClassName}
                  value={selectedLink}
                  onChange={(change) => setLinkChoice(change.target.value)}
                >
                  <option value="">Not yet</option>
                  {activities.map((activity) => (
                    <option key={activity.id} value={activity.id}>
                      {activityLabel(activity, user.timezone, user.units)}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <p className="text-[13px] text-muted">
                After you train or race, this will match the completed session
                on the same day and sport.
              </p>
            )}
            <Field label="Notes" htmlFor="event-notes">
              <textarea
                id="event-notes"
                className="min-h-20 w-full rounded-sm border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted"
                value={notes}
                onChange={(change) => setNotes(change.target.value)}
              />
            </Field>
            <div className="flex flex-wrap items-center justify-between gap-3">
              {event ? (
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  className="inline-flex h-9 items-center rounded-sm px-3 text-sm text-danger hover:bg-paper-sunken"
                  disabled={saving}
                >
                  Delete
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="inline-flex h-9 items-center rounded-sm px-3 text-sm text-ink-soft hover:bg-paper-sunken hover:text-ink"
                  >
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  type="submit"
                  className="home-cta home-cta-sm"
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Choice({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 items-center justify-center rounded-sm border text-sm ${
        selected
          ? "border-ink bg-ink text-paper"
          : "border-line bg-paper text-ink hover:bg-paper-sunken"
      }`}
    >
      {children}
    </button>
  );
}

function plannedSeconds(hours: string, minutes: string) {
  const hrs = Number(hours);
  const mins = Number(minutes);
  const total =
    (Number.isFinite(hrs) && hrs > 0 ? hrs * 3600 : 0) +
    (Number.isFinite(mins) && mins > 0 ? mins * 60 : 0);
  return total > 0 ? Math.round(total) : null;
}

function activityLabel(
  activity: ActivityOption,
  timeZone: string,
  units: "metric" | "imperial",
) {
  const parts = [
    activity.sport,
    formatDuration(activity.duration_seconds),
    formatDistance(activity.distance_m, units),
    formatTimeInZone(activity.started_at, timeZone),
  ].filter(Boolean);
  return parts.join(" · ");
}
