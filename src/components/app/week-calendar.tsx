"use client";

import { useAppUser } from "@/components/app/app-shell";
import { EventDialog } from "@/components/app/event-dialog";
import {
  addDaysToKey,
  addMonthsToKey,
  dateKeyInZone,
  formatDayNumber,
  formatDayTitle,
  formatMonthTitle,
  formatTimeInZone,
  isSameMonth,
  isoWeekNumber,
  monthGridKeys,
  monthKeyInZone,
  monthQueryRange,
} from "@/lib/calendar";
import {
  CALENDAR_CHANGED_EVENT,
  CALENDAR_EVENT_COLUMNS,
  CALENDAR_PREVIEW_EVENT,
  parseCalendarEvent,
  type CalendarEvent,
  type CalendarPreview,
} from "@/lib/calendar-event";
import { durationLabel, proposedChanges } from "@/lib/chat/proposal-view";
import { workoutSportLabel } from "@/lib/workout";
import { createClient } from "@/lib/supabase/client";
import { displayTrainingState, formatTrainingMetric } from "@/lib/load/training-state";
import {
  formatHrv,
  formatRestingHr,
  formatSleepClock,
  formatStress,
  overnightSleepMinutes,
  rangeFavorable,
  recoveryRange,
  type RecoveryObservation,
} from "@/lib/recovery";
import { formatDistance, formatDuration, formatElevation, type Units } from "@/lib/units";
import { ACTIVITY_PARAM } from "@/lib/activity-modal";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Metrics = { potential_load: number | null } | { potential_load: number | null }[] | null;

type ActivityRow = {
  id: string;
  source: string;
  sport: string;
  started_at: string;
  duration_seconds: number | null;
  distance_m: number | null;
  elevation_m: number | null;
  avg_hr: number | null;
  activity_metrics: Metrics;
};

type DailyLoad = {
  date: string;
  training_load: number | null;
  fitness: number | null;
  fatigue: number | null;
  form: number | null;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const sportTone: Record<string, string> = {
  run: "text-run",
  ride: "text-ride",
  swim: "text-steel",
  triathlon: "text-run",
  strength: "text-strength",
  walk: "text-sage",
  row: "text-steel",
  ski: "text-sage",
  other: "text-rest",
};

const VISIBLE = 3;
const WELLNESS_KEY = "ahead-calendar-wellness";

function navButtonClass(active = false) {
  return `inline-flex h-9 items-center px-3 text-sm ${
    active
      ? "bg-ink text-paper"
      : "text-ink hover:bg-paper-sunken"
  }`;
}

export function WeekCalendar() {
  const user = useAppUser();
  const [month, setMonth] = useState(() =>
    monthKeyInZone(new Date(), user.timezone),
  );
  const [rows, setRows] = useState<ActivityRow[] | null>(null);
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [loads, setLoads] = useState<DailyLoad[]>([]);
  const [recovery, setRecovery] = useState<RecoveryObservation[]>([]);
  const [showWellness, setShowWellness] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [preview, setPreview] = useState<CalendarPreview>(null);
  const [draft, setDraft] = useState<{ date: string; event: CalendarEvent | null } | null>(
    null,
  );
  const todayKey = dateKeyInZone(new Date(), user.timezone);
  const thisMonth = monthKeyInZone(new Date(), user.timezone);

  useEffect(() => {
    if (window.localStorage.getItem(WELLNESS_KEY) === "off") {
      setShowWellness(false);
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const range = monthQueryRange(month);
    const keys = monthGridKeys(month);
    setRows(null);
    setEvents(null);
    void supabase
      .from("activities")
      .select(
        "id, source, sport, started_at, duration_seconds, distance_m, elevation_m, avg_hr, activity_metrics(potential_load)",
      )
      .eq("status", "ready")
      .gte("started_at", range.from)
      .lt("started_at", range.to)
      .order("started_at", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error("Calendar activities failed", error);
          setRows([]);
          return;
        }
        setRows((data as ActivityRow[] | null) ?? []);
      });
    void supabase
      .from("calendar_items")
      .select(CALENDAR_EVENT_COLUMNS)
      .gte("date", keys[0] ?? `${month}-01`)
      .lte("date", keys[keys.length - 1] ?? `${month}-28`)
      .order("date", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error("Calendar events failed", error);
          setEvents([]);
          return;
        }
        setEvents((data ?? []).map(parseCalendarEvent));
      });
    void supabase
      .from("daily_loads")
      .select("date, training_load, fitness, fatigue, form")
      .gte("date", addDaysToKey(keys[0] ?? `${month}-01`, -8))
      .lte("date", keys[keys.length - 1] ?? `${month}-28`)
      .order("date", { ascending: true })
      .then(({ data }) => {
        setLoads((data as DailyLoad[] | null) ?? []);
      });
    void supabase
      .from("daily_recovery")
      .select("date, resting_hr, sleep_hrv_ms, sleep_minutes, sleep_score, stress_avg")
      .gte("date", addDaysToKey(keys[0] ?? `${month}-01`, -28))
      .lte("date", keys[keys.length - 1] ?? `${month}-28`)
      .order("date", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error("Calendar recovery failed", error);
          setRecovery([]);
          return;
        }
        setRecovery((data as RecoveryObservation[] | null) ?? []);
      });
  }, [month, refresh]);

  useEffect(() => {
    function onChange() {
      setRefresh((value) => value + 1);
    }
    function onPreview(event: Event) {
      const detail = (event as CustomEvent<CalendarPreview>).detail ?? null;
      setPreview(detail);
    }
    window.addEventListener(CALENDAR_CHANGED_EVENT, onChange);
    window.addEventListener(CALENDAR_PREVIEW_EVENT, onPreview);
    return () => {
      window.removeEventListener(CALENDAR_CHANGED_EVENT, onChange);
      window.removeEventListener(CALENDAR_PREVIEW_EVENT, onPreview);
    };
  }, []);

  const days = useMemo(() => {
    const keys = monthGridKeys(month);
    const activitiesByDay = new Map<string, ActivityRow[]>();
    const eventsByDay = new Map<string, CalendarEvent[]>();
    for (const key of keys) {
      activitiesByDay.set(key, []);
      eventsByDay.set(key, []);
    }
    for (const row of rows ?? []) {
      const key = dateKeyInZone(new Date(row.started_at), user.timezone);
      activitiesByDay.get(key)?.push(row);
    }
    for (const event of events ?? []) {
      eventsByDay.get(event.date)?.push(event);
    }
    return keys.map((key) => ({
      key,
      inMonth: isSameMonth(key, month),
      items: activitiesByDay.get(key) ?? [],
      chips: dayChips(
        activitiesByDay.get(key) ?? [],
        eventsByDay.get(key) ?? [],
        previewForDay(key, preview),
      ),
    }));
  }, [events, month, preview, rows, user.timezone]);

  const loadByDate = useMemo(() => {
    const map = new Map<string, DailyLoad>();
    for (const row of loads) {
      map.set(row.date, row);
    }
    return map;
  }, [loads]);

  const weeks = useMemo(() => {
    const chunks: (typeof days)[] = [];
    for (let index = 0; index < days.length; index += 7) {
      chunks.push(days.slice(index, index + 7));
    }
    return chunks;
  }, [days]);

  const eventCount = days.reduce(
    (sum, day) => sum + (day.inMonth ? day.chips.length : 0),
    0,
  );

  return (
    <section>
      <div className="grid items-end gap-4 sm:grid-cols-[1fr_auto_1fr]">
        <div>
          <p className="kicker">
            {month === thisMonth ? "This month" : "Month"}
          </p>
          <h1 className="title mt-2 text-ink">
            {formatMonthTitle(month)}
          </h1>
        </div>
        <WellnessSwitch
          on={showWellness}
          onChange={(next) => {
            setShowWellness(next);
            window.localStorage.setItem(WELLNESS_KEY, next ? "on" : "off");
          }}
        />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex overflow-hidden rounded-sm border border-line">
            <button
              type="button"
              onClick={() => setMonth((value) => addMonthsToKey(value, -1))}
              className={`${navButtonClass()} border-r border-line`}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setMonth((value) => addMonthsToKey(value, 1))}
              className={navButtonClass()}
            >
              Next
            </button>
          </div>
          <button
            type="button"
            onClick={() => setMonth(thisMonth)}
            disabled={month === thisMonth}
            className={`inline-flex h-9 items-center rounded-sm border border-line px-3 text-sm ${
              month === thisMonth
                ? "cursor-default text-muted"
                : "text-ink hover:bg-paper-sunken"
            }`}
          >
            Today
          </button>
        </div>
      </div>

      {rows && events && eventCount === 0 ? (
        <p className="mt-4 text-sm text-muted">
          Nothing planned or completed in this month.
        </p>
      ) : null}

      <div className="mt-8 overflow-x-auto">
        <div className="min-w-[72rem] overflow-hidden rounded-md border border-line">
          <div className="grid grid-cols-[repeat(7,minmax(0,1fr))_8.5rem] divide-x divide-line border-b border-line bg-paper">
            {WEEKDAYS.map((label) => (
              <div
                key={label}
                className="kicker px-2 py-2"
              >
                {label}
              </div>
            ))}
            <div className="kicker px-2 py-2">Week</div>
          </div>
          <div className="divide-y divide-line">
            {weeks.map((week) => (
              <div
                key={week[0]?.key}
                className="grid min-w-0 grid-cols-[repeat(7,minmax(0,1fr))_8.5rem] divide-x divide-line"
              >
                {week.map((day) => (
                  <MonthDay
                    key={day.key}
                    day={day}
                    todayKey={todayKey}
                    timezone={user.timezone}
                    units={user.units}
                    recovery={recovery}
                    showWellness={showWellness}
                    onAdd={(date) => setDraft({ date, event: null })}
                    onEdit={(event) => setDraft({ date: event.date, event })}
                  />
                ))}
                <WeekSummary
                  days={week}
                  loads={loadByDate}
                  units={user.units}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
      <EventDialog
        draft={draft}
        onClose={() => setDraft(null)}
        onSaved={() => {
          setDraft(null);
          setRefresh((value) => value + 1);
        }}
      />
    </section>
  );
}

type DayChip =
  | { kind: "done"; id: string; activity: ActivityRow; event: CalendarEvent | null }
  | { kind: "planned"; id: string; event: CalendarEvent; removing?: boolean }
  | {
      kind: "ghost";
      id: string;
      title: string;
      durationMinutes: number | null;
      expectedLoad: number | null;
    };

function previewForDay(date: string, preview: CalendarPreview) {
  if (!preview) {
    return { departing: new Set<string>(), ghosts: [] as Extract<DayChip, { kind: "ghost" }>[] };
  }
  const departing = new Set<string>();
  for (const op of preview.operations) {
    if (
      (op.type === "delete_session" ||
        op.type === "move_session" ||
        op.type === "update_session") &&
      op.sessionId
    ) {
      departing.add(op.sessionId);
    }
  }
  const ghosts = proposedChanges(preview.operations, preview.snapshot).flatMap((change, index) => {
    const ghostDate = change.kind === "move" ? change.toDate : change.date;
    if (ghostDate !== date || change.kind === "delete") {
      return [];
    }
    return [
      {
        kind: "ghost" as const,
        id: `ghost-${date}-${index}`,
        title: change.title,
        durationMinutes: "durationMinutes" in change ? change.durationMinutes : null,
        expectedLoad: "expectedLoad" in change ? change.expectedLoad : null,
      },
    ];
  });
  return { departing, ghosts };
}

function dayChips(
  activities: ActivityRow[],
  events: CalendarEvent[],
  preview: { departing: Set<string>; ghosts: Extract<DayChip, { kind: "ghost" }>[] },
): DayChip[] {
  const byActivity = new Map<string, CalendarEvent>();
  const planned: CalendarEvent[] = [];
  for (const event of events) {
    if (event.linked_activity_id) {
      byActivity.set(event.linked_activity_id, event);
    } else {
      planned.push(event);
    }
  }
  return [
    ...preview.ghosts,
    ...activities.map((activity) => ({
      kind: "done" as const,
      id: activity.id,
      activity,
      event: byActivity.get(activity.id) ?? null,
    })),
    ...planned.map((event) => ({
      kind: "planned" as const,
      id: event.id,
      event,
      removing: preview.departing.has(event.id),
    })),
  ];
}

function WellnessSwitch({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2.5 justify-self-start sm:justify-self-center">
      <span className="relative h-5 w-9 shrink-0">
        <input
          type="checkbox"
          checked={on}
          onChange={(event) => onChange(event.target.checked)}
          className="peer absolute inset-0 z-10 cursor-pointer opacity-0"
        />
        <span
          className={`pointer-events-none absolute inset-0 rounded-full border transition-colors ${
            on ? "border-forest/50 bg-forest/20" : "border-line bg-paper-sunken"
          }`}
        />
        <span
          className={`pointer-events-none absolute top-0.5 left-0.5 h-4 w-4 rounded-full transition-transform ${
            on ? "translate-x-4 bg-forest" : "bg-muted"
          }`}
        />
      </span>
      <span className="text-sm text-ink">Wellness</span>
    </label>
  );
}

function MonthDay({
  day,
  todayKey,
  timezone,
  units,
  recovery,
  showWellness,
  onAdd,
  onEdit,
}: {
  day: { key: string; inMonth: boolean; items: ActivityRow[]; chips: DayChip[] };
  todayKey: string;
  timezone: string;
  units: Units;
  recovery: RecoveryObservation[];
  showWellness: boolean;
  onAdd: (date: string) => void;
  onEdit: (event: CalendarEvent) => void;
}) {
  const isToday = day.key === todayKey;
  const extra = Math.max(0, day.chips.length - VISIBLE);
  const visible = day.chips.slice(0, VISIBLE);

  return (
    <div
      className={`relative h-full min-w-0 overflow-hidden ${
        showWellness ? "min-h-48" : "min-h-36"
      } ${day.inMonth ? "bg-paper-raised" : "bg-paper"}`}
    >
      <button
        type="button"
        className="absolute inset-0 z-0 cursor-pointer hover:bg-paper-sunken"
        aria-label={`Add event on ${formatDayTitle(day.key)}`}
        onClick={() => onAdd(day.key)}
      />
      <div className="relative z-10 flex h-full min-w-0 flex-col p-2 pointer-events-none">
        <div className="flex justify-end">
          <span
            className={
              isToday
                ? "flex h-6 w-6 items-center justify-center rounded-full bg-ink text-[11px] font-medium text-paper"
                : `text-[13px] ${day.inMonth ? "text-ink-soft" : "text-muted"}`
            }
          >
            {formatDayNumber(day.key)}
          </span>
        </div>
        <ul className="mt-1.5 grid min-w-0 gap-1.5 pointer-events-auto">
          {visible.map((chip) => (
            <li key={`${chip.kind}-${chip.id}`} className="min-w-0">
              {chip.kind === "done" ? (
                <DoneChip
                  activity={chip.activity}
                  event={chip.event}
                  timezone={timezone}
                  units={units}
                />
              ) : chip.kind === "ghost" ? (
                <GhostChip
                  title={chip.title}
                  durationMinutes={chip.durationMinutes}
                  expectedLoad={chip.expectedLoad}
                />
              ) : (
                <PlannedChip
                  event={chip.event}
                  removing={chip.removing}
                  units={units}
                  onEdit={onEdit}
                />
              )}
            </li>
          ))}
          {extra > 0 ? (
            <li className="px-1.5 text-[11px] text-muted">+{extra} more</li>
          ) : null}
        </ul>
        {showWellness ? <DayWellness date={day.key} rows={recovery} /> : null}
      </div>
    </div>
  );
}

function joinStats(parts: (string | null | undefined)[]) {
  return parts.filter((part): part is string => Boolean(part)).join(" · ");
}

function loadLabel(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return `${Math.round(value)} load`;
}

function DoneChip({
  activity,
  event,
  timezone,
  units,
}: {
  activity: ActivityRow;
  event: CalendarEvent | null;
  timezone: string;
  units: Units;
}) {
  const race = event?.intent === "race";
  const title = event?.title?.trim() || null;
  const stats = joinStats([
    formatDuration(activity.duration_seconds),
    formatDistance(activity.distance_m, units),
    loadLabel(metricsLoad(activity.activity_metrics)),
  ]);
  const fallback = formatTimeInZone(activity.started_at, timezone);
  return (
    <Link
      href={`?${ACTIVITY_PARAM}=${activity.id}`}
      scroll={false}
      className="block min-w-0 max-w-full overflow-hidden rounded-sm border border-line bg-paper px-2 py-1.5 hover:border-ink/25 hover:bg-paper-sunken"
    >
      <p
        className={`mono text-[9px] font-bold tracking-[0.14em] uppercase ${
          race ? "text-ember" : sportTone[activity.sport] ?? "text-rest"
        }`}
      >
        {race ? (event?.importance ? `${event.importance} race` : "Race") : activity.sport}
      </p>
      {title ? <p className="truncate text-[12px] text-ink">{title}</p> : null}
      <p className="truncate text-[12px] text-ink">{stats || fallback}</p>
    </Link>
  );
}

function PlannedChip({
  event,
  removing,
  units,
  onEdit,
}: {
  event: CalendarEvent;
  removing?: boolean;
  units: Units;
  onEdit: (event: CalendarEvent) => void;
}) {
  const race = event.intent === "race";
  const stats = joinStats([
    formatDuration(event.planned_seconds),
    formatDistance(event.planned_distance_m, units),
    loadLabel(event.planned_load),
  ]);
  return (
    <button
      type="button"
      onClick={() => onEdit(event)}
      className={`block w-full min-w-0 max-w-full overflow-hidden rounded-sm border border-dashed px-2 py-1.5 text-left ${
        removing
          ? "border-line bg-paper opacity-50"
          : "border-forest bg-paper hover:border-forest-hover hover:bg-paper-sunken"
      }`}
    >
      <p
        className={`mono text-[9px] font-bold tracking-[0.14em] uppercase ${
          race ? "text-ember" : sportTone[event.sport] ?? "text-rest"
        }`}
      >
        {race ? (event.importance ? `${event.importance} race` : "Race") : workoutSportLabel(event.sport)}
      </p>
      <p className={`truncate text-[12px] text-ink ${removing ? "line-through" : ""}`}>
        {event.title}
      </p>
      {stats ? (
        <p className={`truncate text-[12px] text-ink ${removing ? "line-through" : ""}`}>
          {stats}
        </p>
      ) : null}
    </button>
  );
}

function GhostChip({
  title,
  durationMinutes,
  expectedLoad,
}: {
  title: string;
  durationMinutes: number | null;
  expectedLoad: number | null;
}) {
  const stats = joinStats([durationLabel(durationMinutes), loadLabel(expectedLoad)]);
  return (
    <div className="block w-full min-w-0 max-w-full overflow-hidden rounded-sm border border-dashed border-forest/70 bg-forest/10 px-2 py-1.5 text-left">
      <p className="mono text-[9px] font-bold tracking-[0.14em] text-forest uppercase">
        Proposed
      </p>
      <p className="truncate text-[12px] text-ink">{title}</p>
      {stats ? <p className="truncate text-[12px] text-ink">{stats}</p> : null}
    </div>
  );
}

function DayWellness({ date, rows }: { date: string; rows: RecoveryObservation[] }) {
  const day = rows.find((row) => row.date === date);
  if (!day) {
    return null;
  }
  const sleep = overnightSleepMinutes(day.sleep_minutes);
  const items = [
    {
      key: "sleep",
      name: "Sleep",
      label: formatSleepClock(sleep),
      better: "higher" as const,
      range: recoveryRange(rows, date, (row) => overnightSleepMinutes(row.sleep_minutes), sleep, 30),
    },
    {
      key: "hrv",
      name: "HRV",
      label: formatHrv(day.sleep_hrv_ms),
      better: "higher" as const,
      range: recoveryRange(rows, date, (row) => row.sleep_hrv_ms, day.sleep_hrv_ms, 6),
    },
    {
      key: "rhr",
      name: "RHR",
      label: formatRestingHr(day.resting_hr),
      better: "lower" as const,
      range: recoveryRange(rows, date, (row) => row.resting_hr, day.resting_hr, 3),
    },
    {
      key: "stress",
      name: "Stress",
      label: formatStress(day.stress_avg),
      better: "lower" as const,
      range: recoveryRange(rows, date, (row) => row.stress_avg, day.stress_avg, 8),
    },
  ].filter((item) => item.label);
  if (items.length === 0) {
    return null;
  }
  return (
    <dl
      className="mt-auto grid grid-cols-2 gap-x-2 gap-y-0.5 border-t border-line pt-1.5 text-[11px] leading-4"
      aria-label={items.map((item) => `${item.name} ${item.label}`).join(", ")}
    >
      {items.map((item) => {
        const watch = item.range != null && !rangeFavorable(item.range.status, item.better);
        return (
          <div key={item.key} className="flex min-w-0 items-baseline justify-between gap-1">
            <dt className="text-muted">{item.name}</dt>
            <dd className={`truncate tabular-nums ${watch ? "text-ember" : "text-ink"}`}>
              {item.label}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function metricsLoad(value: Metrics): number {
  if (!value) {
    return 0;
  }
  const row = Array.isArray(value) ? value[0] : value;
  return row?.potential_load ?? 0;
}

function WeekSummary({
  days,
  loads,
  units,
}: {
  days: { key: string; inMonth: boolean; items: ActivityRow[] }[];
  loads: Map<string, DailyLoad>;
  units: Units;
}) {
  const items = days.flatMap((day) => day.items);
  const duration = items.reduce((sum, item) => sum + (item.duration_seconds ?? 0), 0);
  const distance = items.reduce((sum, item) => sum + (item.distance_m ?? 0), 0);
  const elevation = items.reduce((sum, item) => sum + (item.elevation_m ?? 0), 0);
  const load = items.reduce((sum, item) => sum + metricsLoad(item.activity_metrics), 0);
  const endKey = days[days.length - 1]?.key;
  const startKey = days[0]?.key;
  const latest = [...days]
    .reverse()
    .map((day) => loads.get(day.key))
    .find((row) => row);
  const previous =
    endKey != null ? loads.get(addDaysToKey(endKey, -7)) : undefined;
  const ramp =
    latest?.fitness != null && previous?.fitness != null
      ? Math.round((latest.fitness - previous.fitness) * 10) / 10
      : null;

  if (items.length === 0 && latest == null) {
    return <div className="bg-paper px-2 py-2" />;
  }

  const durationLabel = formatDuration(duration);
  const loadLabel = load > 0 ? String(Math.round(load)) : null;
  const distanceLabel = formatDistance(distance, units);
  const elevationLabel = elevation ? formatElevation(elevation, units) : null;
  const weekNo = startKey ? isoWeekNumber(startKey) : null;
  const shown =
    latest?.fitness != null && latest.fatigue != null
      ? displayTrainingState({ fitness: latest.fitness, fatigue: latest.fatigue })
      : null;

  return (
    <div className="bg-paper px-2 py-2 text-[11px] leading-4 text-ink-soft">
      {weekNo ? (
        <p className="kicker">Week {weekNo}</p>
      ) : null}
      <dl className="mt-1.5 grid gap-0.5">
        {durationLabel ? (
          <div className="flex justify-between gap-2">
            <dt className="text-muted">Time</dt>
            <dd className="text-ink">{durationLabel}</dd>
          </div>
        ) : null}
        {loadLabel ? (
          <div className="flex justify-between gap-2">
            <dt className="text-muted">Load</dt>
            <dd className="text-ink">{loadLabel}</dd>
          </div>
        ) : null}
        {distanceLabel ? (
          <div className="flex justify-between gap-2">
            <dt className="text-muted">Dist</dt>
            <dd className="text-ink">{distanceLabel}</dd>
          </div>
        ) : null}
        {elevationLabel ? (
          <div className="flex justify-between gap-2">
            <dt className="text-muted">Elev</dt>
            <dd className="text-ink">{elevationLabel}</dd>
          </div>
        ) : null}
        {shown ? (
          <>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Fit</dt>
              <dd className="text-ink">{formatTrainingMetric(shown.fitness)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Fatigue</dt>
              <dd className="text-ink">{formatTrainingMetric(shown.fatigue)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Form</dt>
              <dd className="text-ink">{formatTrainingMetric(shown.form)}</dd>
            </div>
          </>
        ) : null}
        {ramp != null ? (
          <div className="flex justify-between gap-2">
            <dt className="text-muted">Ramp</dt>
            <dd className="text-ink">
              {ramp > 0 ? "+" : ""}
              {ramp}
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
