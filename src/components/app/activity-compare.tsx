"use client";

import { CompareStreamChart } from "@/components/app/stream-chart";
import { useAppUser } from "@/components/app/app-shell";
import { COMPARE_STROKES, COMPARE_TONES } from "@/lib/activity-compare";
import { dateKeyInZone, formatActivityWhen } from "@/lib/calendar";
import {
  CALENDAR_EVENT_COLUMNS,
  parseCalendarEvent,
  type CalendarEvent,
} from "@/lib/calendar-event";
import type { StreamPoint } from "@/lib/fit/parse";
import { channelSeries, seriesExtent } from "@/lib/fit/stream";
import { createClient } from "@/lib/supabase/client";
import {
  formatDistance,
  formatDuration,
  formatElevation,
  formatHms,
  formatPace,
  formatSpeed,
  formatSwimPace,
  paceSecondsPerUnit,
  type Units,
} from "@/lib/units";
import { workoutSportLabel, type WorkoutSport } from "@/lib/workout";
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useMemo, useState } from "react";

type Metrics = {
  potential_load: number | null;
  intensity: number | null;
};

type Activity = {
  id: string;
  sport: WorkoutSport;
  subsport: string | null;
  started_at: string;
  duration_seconds: number | null;
  distance_m: number | null;
  elevation_m: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  avg_power: number | null;
  normalized_power: number | null;
  avg_cadence: number | null;
  avg_speed_mps: number | null;
  session_type: string | null;
  activity_metrics: Metrics | Metrics[] | null;
};

type Loaded = {
  activity: Activity;
  event: CalendarEvent | null;
  stream: StreamPoint[];
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function titleFor(activity: Activity, event: CalendarEvent | null) {
  if (event?.title) {
    return event.title;
  }
  const sub = activity.subsport?.replaceAll("_", " ");
  if (sub) {
    if (activity.sport === "run" || activity.sport === "ride" || activity.sport === "walk") {
      return `${sub.slice(0, 1).toUpperCase()}${sub.slice(1)} ${activity.sport}`;
    }
    return `${sub.slice(0, 1).toUpperCase()}${sub.slice(1)}`;
  }
  return workoutSportLabel(activity.sport);
}

function avgSpeed(activity: Activity) {
  return (
    activity.avg_speed_mps ??
    (activity.distance_m && activity.duration_seconds
      ? activity.distance_m / activity.duration_seconds
      : null)
  );
}

function paceForSport(mps: number | null | undefined, sport: WorkoutSport, units: Units) {
  if (sport === "swim") {
    return formatSwimPace(mps);
  }
  if (sport === "ride") {
    return formatSpeed(mps, units);
  }
  return formatPace(mps, units);
}

function signed(value: string | null, positive: boolean) {
  if (!value) {
    return null;
  }
  return `${positive ? "+" : "−"}${value}`;
}

function durationDelta(base: number | null, value: number | null) {
  if (base == null || value == null) {
    return null;
  }
  const diff = value - base;
  if (Math.abs(diff) < 1) {
    return "same";
  }
  return signed(formatHms(Math.abs(diff)) ?? formatDuration(Math.abs(diff)), diff > 0);
}

function distanceDelta(base: number | null, value: number | null, units: Units) {
  if (base == null || value == null) {
    return null;
  }
  const diff = value - base;
  if (Math.abs(diff) < 5) {
    return "same";
  }
  return signed(formatDistance(Math.abs(diff), units), diff > 0);
}

function elevationDelta(base: number | null, value: number | null, units: Units) {
  if (base == null || value == null) {
    return null;
  }
  const diff = value - base;
  if (Math.abs(diff) < 1) {
    return "same";
  }
  return signed(formatElevation(Math.abs(diff), units), diff > 0);
}

function numberDelta(base: number | null, value: number | null, suffix = "") {
  if (base == null || value == null) {
    return null;
  }
  const diff = value - base;
  if (Math.abs(diff) < 0.05) {
    return "same";
  }
  const shown = Number.isInteger(base) && Number.isInteger(value)
    ? String(Math.round(Math.abs(diff)))
    : Math.abs(diff).toFixed(1);
  return `${diff > 0 ? "+" : "−"}${shown}${suffix}`;
}

function paceDelta(baseMps: number | null, valueMps: number | null, sport: WorkoutSport, units: Units) {
  if (baseMps == null || valueMps == null) {
    return null;
  }
  if (sport === "ride") {
    const unit = units === "imperial" ? " mph" : " km/h";
    const factor = units === "imperial" ? 3600 / 1609.344 : 3.6;
    return numberDelta(baseMps * factor, valueMps * factor, unit);
  }
  const basePace = sport === "swim" ? 100 / baseMps : paceSecondsPerUnit(baseMps, units);
  const valuePace = sport === "swim" ? 100 / valueMps : paceSecondsPerUnit(valueMps, units);
  if (basePace == null || valuePace == null) {
    return null;
  }
  const diff = valuePace - basePace;
  if (Math.abs(diff) < 1) {
    return "same";
  }
  return `${diff > 0 ? "+" : "−"}${Math.round(Math.abs(diff))}s`;
}

function clipSeries(points: { t: number; y: number }[]) {
  const [low, high] = seriesExtent(points.map((point) => point.y));
  return points.map((point) => ({
    t: point.t,
    y: Math.min(high, Math.max(low, point.y)),
  }));
}

function formatPaceFromSeconds(seconds: number, units: Units) {
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}${units === "imperial" ? "/mi" : "/km"}`;
}

function formatShortWhen(iso: string, timeZone: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return formatActivityWhen(iso, timeZone);
  }
}

function formatCompareDay(iso: string, timeZone: string, withTime = false) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "short",
      day: "numeric",
      month: "short",
      ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
    }).format(new Date(iso));
  } catch {
    return formatShortWhen(iso, timeZone);
  }
}

function compareLabels(rows: Loaded[], timeZone: string) {
  const keys = rows.map((row) => dateKeyInZone(new Date(row.activity.started_at), timeZone));
  const counts = new Map<string, number>();
  for (const key of keys) {
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return rows.map((row, index) =>
    formatCompareDay(row.activity.started_at, timeZone, (counts.get(keys[index]) ?? 0) > 1),
  );
}

export function ActivityCompare({ ids }: { ids: string[] }) {
  const user = useAppUser();
  const [rows, setRows] = useState<Loaded[] | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    setRows(null);
    void (async () => {
      const [{ data: activities }, { data: events }] = await Promise.all([
        supabase
          .from("activities")
          .select(
            "id, sport, subsport, started_at, duration_seconds, distance_m, elevation_m, avg_hr, max_hr, avg_power, normalized_power, avg_cadence, avg_speed_mps, session_type, activity_metrics(potential_load, intensity)",
          )
          .in("id", ids),
        supabase
          .from("calendar_items")
          .select(CALENDAR_EVENT_COLUMNS)
          .in("linked_activity_id", ids),
      ]);
      if (cancelled) {
        return;
      }
      const byId = new Map((activities ?? []).map((row) => [row.id, row as unknown as Activity]));
      const eventByActivity = new Map(
        (events ?? []).map((row) => {
          const event = parseCalendarEvent(row);
          return [event.linked_activity_id ?? event.id, event] as const;
        }),
      );
      const loaded: Loaded[] = ids.flatMap((id) => {
        const activity = byId.get(id);
        if (!activity) {
          return [];
        }
        return [
          {
            activity,
            event: eventByActivity.get(id) ?? null,
            stream: [],
          },
        ];
      });
      setRows(loaded);

      const streams = await Promise.all(
        loaded.map(async (row) => {
          try {
            const response = await fetch(`/api/activities/${row.activity.id}/streams`);
            const body = (await response.json().catch(() => ({}))) as { stream?: StreamPoint[] };
            return { id: row.activity.id, stream: body.stream ?? [] };
          } catch {
            return { id: row.activity.id, stream: [] };
          }
        }),
      );
      if (cancelled) {
        return;
      }
      const streamById = new Map(streams.map((entry) => [entry.id, entry.stream]));
      setRows((current) =>
        current?.map((row) => ({
          ...row,
          stream: streamById.get(row.activity.id) ?? row.stream,
        })) ?? null,
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [ids.join(",")]);

  const labels = useMemo(
    () => (rows ? compareLabels(rows, user.timezone) : []),
    [rows, user.timezone],
  );

  const charts = useMemo(() => {
    if (!rows) {
      return null;
    }
    return rows.map((row, index) => {
      const stream = row.stream;
      const sport = row.activity.sport;
      const hr = clipSeries(channelSeries(stream, (point) => point.hr ?? null));
      const power = clipSeries(channelSeries(stream, (point) => point.power ?? null));
      const elevation = clipSeries(channelSeries(stream, (point) => point.elevation ?? null));
      const pace =
        sport === "ride"
          ? clipSeries(
              channelSeries(stream, (point) =>
                point.speed && point.speed > 0
                  ? user.units === "imperial"
                    ? (point.speed * 3600) / 1609.344
                    : point.speed * 3.6
                  : null,
              ),
            )
          : clipSeries(
              channelSeries(stream, (point) =>
                point.speed ? paceSecondsPerUnit(point.speed, user.units) : null,
              ),
            );
      return {
        id: row.activity.id,
        label: labels[index] ?? formatCompareDay(row.activity.started_at, user.timezone),
        color: COMPARE_STROKES[index] ?? COMPARE_STROKES[0],
        sport,
        hr,
        power,
        elevation,
        pace,
      };
    });
  }, [labels, rows, user.timezone, user.units]);

  if (!rows) {
    return (
      <div>
        <Dialog.Title className="title text-[2rem] text-ink">Compare</Dialog.Title>
        <Dialog.Description className="mt-2 text-sm text-muted">
          Loading these sessions.
        </Dialog.Description>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div>
        <Dialog.Title className="title text-[2rem] text-ink">Compare</Dialog.Title>
        <Dialog.Description className="mt-3 text-sm text-muted">
          Those sessions are not in your library.
        </Dialog.Description>
      </div>
    );
  }

  const baseline = rows[0];
  const baselineSpeed = avgSpeed(baseline.activity);
  const rideCount = rows.filter((row) => row.activity.sport === "ride").length;
  const paceLabel = rideCount === rows.length ? "Speed" : rideCount > 0 ? "Pace / speed" : "Pace";

  const table = [
    {
      key: "time",
      label: "Time",
      values: rows.map((row) => formatHms(row.activity.duration_seconds) ?? formatDuration(row.activity.duration_seconds)),
      deltas: rows.map((row, index) =>
        index === 0 ? null : durationDelta(baseline.activity.duration_seconds, row.activity.duration_seconds),
      ),
    },
    {
      key: "distance",
      label: "Distance",
      values: rows.map((row) => formatDistance(row.activity.distance_m, user.units)),
      deltas: rows.map((row, index) =>
        index === 0 ? null : distanceDelta(baseline.activity.distance_m, row.activity.distance_m, user.units),
      ),
    },
    {
      key: "pace",
      label: paceLabel,
      values: rows.map((row) => paceForSport(avgSpeed(row.activity), row.activity.sport, user.units)),
      deltas: rows.map((row, index) =>
        index === 0 || row.activity.sport !== baseline.activity.sport
          ? null
          : paceDelta(baselineSpeed, avgSpeed(row.activity), row.activity.sport, user.units),
      ),
    },
    {
      key: "elevation",
      label: "Elevation",
      values: rows.map((row) => formatElevation(row.activity.elevation_m, user.units)),
      deltas: rows.map((row, index) =>
        index === 0
          ? null
          : elevationDelta(baseline.activity.elevation_m, row.activity.elevation_m, user.units),
      ),
    },
    {
      key: "hr",
      label: "Avg HR",
      values: rows.map((row) => (row.activity.avg_hr ? `${row.activity.avg_hr} bpm` : null)),
      deltas: rows.map((row, index) =>
        index === 0 ? null : numberDelta(baseline.activity.avg_hr, row.activity.avg_hr, " bpm"),
      ),
    },
    {
      key: "maxhr",
      label: "Max HR",
      values: rows.map((row) => (row.activity.max_hr ? `${row.activity.max_hr} bpm` : null)),
      deltas: rows.map((row, index) =>
        index === 0 ? null : numberDelta(baseline.activity.max_hr, row.activity.max_hr, " bpm"),
      ),
    },
    {
      key: "power",
      label: "Power",
      values: rows.map((row) => (row.activity.avg_power ? `${row.activity.avg_power} W` : null)),
      deltas: rows.map((row, index) =>
        index === 0 ? null : numberDelta(baseline.activity.avg_power, row.activity.avg_power, " W"),
      ),
    },
    {
      key: "np",
      label: "Normalized power",
      values: rows.map((row) =>
        row.activity.normalized_power ? `${row.activity.normalized_power} W` : null,
      ),
      deltas: rows.map((row, index) =>
        index === 0
          ? null
          : numberDelta(baseline.activity.normalized_power, row.activity.normalized_power, " W"),
      ),
    },
    {
      key: "cadence",
      label: "Cadence",
      values: rows.map((row) =>
        row.activity.avg_cadence
          ? `${row.activity.avg_cadence} ${row.activity.sport === "ride" ? "rpm" : "spm"}`
          : null,
      ),
      deltas: rows.map((row, index) =>
        index === 0 ? null : numberDelta(baseline.activity.avg_cadence, row.activity.avg_cadence),
      ),
    },
    {
      key: "load",
      label: "Load",
      values: rows.map((row) => {
        const load = one(row.activity.activity_metrics)?.potential_load;
        return load != null ? String(Math.round(load)) : null;
      }),
      deltas: rows.map((row, index) => {
        const load = one(row.activity.activity_metrics)?.potential_load ?? null;
        const base = one(baseline.activity.activity_metrics)?.potential_load ?? null;
        return index === 0 ? null : numberDelta(base, load);
      }),
    },
    {
      key: "intensity",
      label: "Intensity",
      values: rows.map((row) => {
        const intensity = one(row.activity.activity_metrics)?.intensity;
        return intensity != null ? String(intensity) : null;
      }),
      deltas: rows.map((row, index) => {
        const intensity = one(row.activity.activity_metrics)?.intensity ?? null;
        const base = one(baseline.activity.activity_metrics)?.intensity ?? null;
        return index === 0 ? null : numberDelta(base, intensity);
      }),
    },
  ].filter((row) => row.values.some(Boolean));

  const hrSeries = charts?.filter((entry) => entry.hr.length > 1) ?? [];
  const paceSeries = charts?.filter((entry) => entry.pace.length > 1) ?? [];
  const elevationSeries = charts?.filter((entry) => entry.elevation.length > 1) ?? [];
  const powerSeries = charts?.filter((entry) => entry.power.length > 1) ?? [];
  const ridePace = paceSeries.length > 0 && paceSeries.every((entry) => entry.sport === "ride");

  return (
    <article>
      <p className="kicker">Compare</p>
      <Dialog.Title className="title mt-2 text-[2rem] text-ink">
        {rows.length} sessions
      </Dialog.Title>
      <Dialog.Description className="mt-2 text-[15px] text-ink-soft">
        Differences are against {labels[0] ?? "the first session"}.
      </Dialog.Description>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map((row, index) => {
          const tone = COMPARE_TONES[index] ?? COMPARE_TONES[0];
          return (
            <li key={row.activity.id} className={`rounded-md border bg-paper-raised px-4 py-3 ${tone.ring}`}>
              <p className={`mono text-[10px] font-bold tracking-[0.16em] uppercase ${tone.text}`}>
                {row.activity.sport}
                {row.event?.intent === "race" || row.activity.session_type === "race" ? " · race" : ""}
              </p>
              <p className="mt-1.5 text-[15px] text-ink">{titleFor(row.activity, row.event)}</p>
              <p className="mt-1 text-[13px] text-muted">
                {formatShortWhen(row.activity.started_at, user.timezone)}
              </p>
            </li>
          );
        })}
      </ul>

      <div className="mt-8 overflow-x-auto rounded-md border border-line">
        <table className="min-w-full text-left text-[13px]">
          <thead className="bg-paper text-muted">
            <tr>
              <th className="px-3 py-2 font-medium"> </th>
              {rows.map((row, index) => (
                <th key={row.activity.id} className="whitespace-nowrap px-3 py-2 font-medium text-ink">
                  {labels[index] ?? formatCompareDay(row.activity.started_at, user.timezone)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line bg-paper-raised">
            {table.map((row) => (
              <tr key={row.key}>
                <th className="px-3 py-2.5 font-medium text-muted">{row.label}</th>
                {row.values.map((value, index) => (
                  <td key={`${row.key}-${ids[index]}`} className="px-3 py-2.5 text-ink">
                    <span>{value ?? "—"}</span>
                    {row.deltas[index] && row.deltas[index] !== "same" ? (
                      <span className="ml-2 text-[12px] text-muted">{row.deltas[index]}</span>
                    ) : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8 grid gap-4">
        {hrSeries.length > 0 ? (
          <CompareStreamChart
            title="Heart rate"
            series={hrSeries.map((entry) => ({
              id: entry.id,
              label: entry.label,
              color: entry.color,
              points: entry.hr,
            }))}
            formatY={(value) => `${Math.round(value)}`}
            unitLabel="bpm"
          />
        ) : null}
        {paceSeries.length > 0 ? (
          <CompareStreamChart
            title={ridePace ? "Speed" : "Pace"}
            series={paceSeries.map((entry) => ({
              id: entry.id,
              label: entry.label,
              color: entry.color,
              points: entry.pace,
            }))}
            invert={!ridePace}
            formatY={(value) =>
              ridePace ? value.toFixed(1) : formatPaceFromSeconds(value, user.units)
            }
            unitLabel={
              ridePace ? (user.units === "imperial" ? "mph" : "km/h") : undefined
            }
          />
        ) : null}
        {elevationSeries.length > 0 ? (
          <CompareStreamChart
            title="Elevation"
            series={elevationSeries.map((entry) => ({
              id: entry.id,
              label: entry.label,
              color: entry.color,
              points: entry.elevation,
            }))}
            formatY={(value) =>
              user.units === "imperial"
                ? String(Math.round(value / 0.3048))
                : String(Math.round(value))
            }
            unitLabel={user.units === "imperial" ? "ft" : "m"}
          />
        ) : null}
        {powerSeries.length > 0 ? (
          <CompareStreamChart
            title="Power"
            series={powerSeries.map((entry) => ({
              id: entry.id,
              label: entry.label,
              color: entry.color,
              points: entry.power,
            }))}
            formatY={(value) => `${Math.round(value)}`}
            unitLabel="W"
          />
        ) : null}
      </div>
    </article>
  );
}
