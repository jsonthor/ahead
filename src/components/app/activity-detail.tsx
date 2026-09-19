"use client";

import { ActivityMap } from "@/components/app/activity-map";
import { RouteHistory } from "@/components/app/route-history";
import { useAppUser } from "@/components/app/app-shell";
import { StreamChart } from "@/components/app/stream-chart";
import { formatActivityWhen } from "@/lib/calendar";
import {
  dataQualityLabel,
  loadMethodLabel,
  type DataQuality,
  type LoadMethod,
} from "@/lib/activity";
import type { Json } from "@/lib/database.types";
import type { StreamPoint } from "@/lib/fit/parse";
import {
  channelSeries,
  gpsTrack,
  seriesExtent,
} from "@/lib/fit/stream";
import {
  CALENDAR_EVENT_COLUMNS,
  parseCalendarEvent,
  type CalendarEvent,
} from "@/lib/calendar-event";
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
  aerobic_load: number | null;
  specific_load: number | null;
  hr_zone_seconds: Json | null;
  training_mix: Json | null;
  load_method: LoadMethod | null;
  data_quality: DataQuality | null;
};

type Lap = {
  id: string;
  source_index: number;
  duration_seconds: number | null;
  distance_m: number | null;
  avg_hr: number | null;
  avg_power: number | null;
};

type Activity = {
  id: string;
  source: string;
  sport: WorkoutSport;
  subsport: string | null;
  started_at: string;
  duration_seconds: number | null;
  elapsed_seconds: number | null;
  moving_seconds: number | null;
  distance_m: number | null;
  elevation_m: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  avg_power: number | null;
  max_power: number | null;
  normalized_power: number | null;
  avg_cadence: number | null;
  avg_speed_mps: number | null;
  session_type: string | null;
  activity_metrics: Metrics | Metrics[] | null;
  activity_laps: Lap[] | null;
};

type Zones = { z1: number; z2: number; z3: number; z4: number; z5: number };
type Mix = { easy_seconds: number; specific_seconds: number; high_seconds: number };

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

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function asZones(value: Json | null): Zones | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const row = value as Record<string, unknown>;
  const zones = {
    z1: Number(row.z1) || 0,
    z2: Number(row.z2) || 0,
    z3: Number(row.z3) || 0,
    z4: Number(row.z4) || 0,
    z5: Number(row.z5) || 0,
  };
  return zones.z1 + zones.z2 + zones.z3 + zones.z4 + zones.z5 > 0 ? zones : null;
}

function asMix(value: Json | null): Mix | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const row = value as Record<string, unknown>;
  const mix = {
    easy_seconds: Number(row.easy_seconds) || 0,
    specific_seconds: Number(row.specific_seconds) || 0,
    high_seconds: Number(row.high_seconds) || 0,
  };
  return mix.easy_seconds + mix.specific_seconds + mix.high_seconds > 0 ? mix : null;
}

function titleFor(activity: Activity, event: CalendarEvent | null) {
  if (event?.title) {
    return event.title;
  }
  const sport = activity.sport;
  const sub = activity.subsport?.replaceAll("_", " ");
  if (sub) {
    if (sport === "run" || sport === "ride" || sport === "walk") {
      return `${capitalize(sub)} ${sport}`;
    }
    return capitalize(sub);
  }
  return workoutSportLabel(sport);
}

function capitalize(value: string) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function paceForSport(
  mps: number | null | undefined,
  sport: WorkoutSport,
  units: Units,
) {
  if (sport === "swim") {
    return formatSwimPace(mps);
  }
  if (sport === "ride") {
    return formatSpeed(mps, units);
  }
  return formatPace(mps, units);
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | null | undefined;
  hint?: string | null;
}) {
  if (!value) {
    return null;
  }
  return (
    <div className="rounded-md border border-line bg-paper-raised px-4 py-3">
      <p className="kicker">{label}</p>
      <p className="metric mt-1 text-[1.65rem] text-ink">{value}</p>
      {hint ? <p className="mt-1 text-[12px] text-muted">{hint}</p> : null}
    </div>
  );
}

function MixBar({ mix }: { mix: Mix }) {
  const total = mix.easy_seconds + mix.specific_seconds + mix.high_seconds;
  if (total <= 0) {
    return null;
  }
  const parts = [
    { key: "Easy", seconds: mix.easy_seconds, className: "bg-sage" },
    { key: "Specific", seconds: mix.specific_seconds, className: "bg-steel" },
    { key: "High", seconds: mix.high_seconds, className: "bg-ember" },
  ].filter((part) => part.seconds > 0);
  return (
    <div className="rounded-md border border-line bg-paper-raised p-4">
      <p className="kicker">Training mix</p>
      <div className="mt-3 flex h-3 overflow-hidden rounded-sm">
        {parts.map((part) => (
          <div
            key={part.key}
            className={part.className}
            style={{ width: `${(part.seconds / total) * 100}%` }}
            title={`${part.key} ${formatDuration(part.seconds)}`}
          />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-soft">
        {parts.map((part) => (
          <li key={part.key}>
            {part.key} {formatDuration(part.seconds)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ZoneBar({ zones }: { zones: Zones }) {
  const total = zones.z1 + zones.z2 + zones.z3 + zones.z4 + zones.z5;
  if (total <= 0) {
    return null;
  }
  const parts = [
    { key: "Z1", seconds: zones.z1, className: "bg-sage/50" },
    { key: "Z2", seconds: zones.z2, className: "bg-sage" },
    { key: "Z3", seconds: zones.z3, className: "bg-steel" },
    { key: "Z4", seconds: zones.z4, className: "bg-ember/70" },
    { key: "Z5", seconds: zones.z5, className: "bg-ember" },
  ];
  return (
    <div className="rounded-md border border-line bg-paper-raised p-4">
      <p className="kicker">Heart rate zones</p>
      <div className="mt-3 flex h-3 overflow-hidden rounded-sm">
        {parts.map((part) =>
          part.seconds > 0 ? (
            <div
              key={part.key}
              className={part.className}
              style={{ width: `${(part.seconds / total) * 100}%` }}
            />
          ) : null,
        )}
      </div>
      <ul className="mt-3 grid grid-cols-5 gap-2 text-center text-[12px] text-ink-soft">
        {parts.map((part) => (
          <li key={part.key}>
            <span className="block text-muted">{part.key}</span>
            {formatDuration(part.seconds) ?? "—"}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ActivityDetail({ id }: { id: string }) {
  const user = useAppUser();
  const [activity, setActivity] = useState<Activity | null | undefined>(undefined);
  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [stream, setStream] = useState<StreamPoint[]>([]);
  const [streamError, setStreamError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    setActivity(undefined);
    setEvent(null);
    void supabase
      .from("activities")
      .select(
        "id, source, sport, subsport, started_at, duration_seconds, elapsed_seconds, moving_seconds, distance_m, elevation_m, avg_hr, max_hr, avg_power, max_power, normalized_power, avg_cadence, avg_speed_mps, session_type, activity_metrics(potential_load, intensity, aerobic_load, specific_load, hr_zone_seconds, training_mix, load_method, data_quality), activity_laps(id, source_index, duration_seconds, distance_m, avg_hr, avg_power)",
      )
      .eq("id", id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) {
          return;
        }
        if (error || !data) {
          if (error) {
            console.error("Activity load failed", error);
          }
          setActivity(null);
          return;
        }
        setActivity(data as unknown as Activity);
      });
    void supabase
      .from("calendar_items")
      .select(CALENDAR_EVENT_COLUMNS)
      .eq("linked_activity_id", id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) {
          return;
        }
        setEvent(data ? parseCalendarEvent(data) : null);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    setStream([]);
    setStreamError(null);
    void fetch(`/api/activities/${id}/streams`)
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as {
          stream?: StreamPoint[];
          unauthorized?: boolean;
        };
        if (cancelled) {
          return;
        }
        setStream(body.stream ?? []);
        if (body.unauthorized) {
          setStreamError("COROS needs permission again to load the original file.");
        }
        if (!response.ok && !body.stream) {
          return;
        }
        const { data } = await supabase
          .from("activities")
          .select(
            "id, source, sport, subsport, started_at, duration_seconds, elapsed_seconds, moving_seconds, distance_m, elevation_m, avg_hr, max_hr, avg_power, max_power, normalized_power, avg_cadence, avg_speed_mps, session_type, activity_metrics(potential_load, intensity, aerobic_load, specific_load, hr_zone_seconds, training_mix, load_method, data_quality), activity_laps(id, source_index, duration_seconds, distance_m, avg_hr, avg_power)",
          )
          .eq("id", id)
          .maybeSingle();
        if (!cancelled && data) {
          setActivity(data as unknown as Activity);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStream([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const metrics = one(activity?.activity_metrics);
  const laps = useMemo(() => {
    const rows = activity?.activity_laps ?? [];
    return [...rows].sort((a, b) => a.source_index - b.source_index);
  }, [activity]);
  const zones = asZones(metrics?.hr_zone_seconds ?? null);
  const mix = asMix(metrics?.training_mix ?? null);
  const charts = useMemo(() => {
    if (!stream || stream.length === 0) {
      return null;
    }
    const hr = channelSeries(stream, (point) => point.hr ?? null);
    const power = channelSeries(stream, (point) => point.power ?? null);
    const elevation = channelSeries(stream, (point) => point.elevation ?? null);
    const cadence = channelSeries(stream, (point) => point.cadence ?? null);
    const sport = activity?.sport ?? "run";
    const pace =
      sport === "ride"
        ? channelSeries(stream, (point) =>
            point.speed && point.speed > 0
              ? user.units === "imperial"
                ? (point.speed * 3600) / 1609.344
                : point.speed * 3.6
              : null,
          )
        : channelSeries(stream, (point) =>
            point.speed ? paceSecondsPerUnit(point.speed, user.units) : null,
          );
    return { hr, power, elevation, cadence, pace, gps: gpsTrack(stream) };
  }, [activity?.sport, stream, user.units]);

  if (activity === undefined) {
    return (
      <div>
        <Dialog.Title className="title text-[2rem] text-ink">
          Session
        </Dialog.Title>
        <Dialog.Description className="mt-2 text-sm text-muted">
          Loading this session.
        </Dialog.Description>
      </div>
    );
  }
  if (!activity) {
    return (
      <div>
        <Dialog.Title className="title text-[2rem] text-ink">
          Session
        </Dialog.Title>
        <Dialog.Description className="mt-3 text-sm text-muted">
          This session is not in your library.
        </Dialog.Description>
      </div>
    );
  }

  const avgSpeed =
    activity.avg_speed_mps ??
    (activity.distance_m && activity.duration_seconds
      ? activity.distance_m / activity.duration_seconds
      : null);

  return (
    <article>
      <p
        className={`mono text-[10px] font-bold tracking-[0.16em] uppercase ${
          event?.intent === "race" ? "text-ember" : sportTone[activity.sport] ?? "text-rest"
        }`}
      >
        {activity.sport}
        {event?.intent === "race" || activity.session_type === "race" ? " · race" : ""}
        {event?.importance ? ` · ${event.importance}` : ""}
      </p>
      <Dialog.Title className="title mt-2 text-[2rem] text-ink">
        {titleFor(activity, event)}
      </Dialog.Title>
      <Dialog.Description className="mt-2 text-[15px] text-ink-soft">
        {formatActivityWhen(activity.started_at, user.timezone)}
      </Dialog.Description>

      {charts?.gps && charts.gps.length > 1 ? (
        <div className="mt-6">
          <ActivityMap points={charts.gps} />
          <RouteHistory activityId={activity.id} sport={activity.sport} />
        </div>
      ) : (
        <RouteHistory activityId={activity.id} sport={activity.sport} />
      )}

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Time" value={formatHms(activity.duration_seconds) ?? formatDuration(activity.duration_seconds)} />
        <Stat label="Distance" value={formatDistance(activity.distance_m, user.units)} />
        <Stat
          label={activity.sport === "ride" ? "Speed" : "Pace"}
          value={paceForSport(avgSpeed, activity.sport, user.units)}
        />
        <Stat label="Elevation" value={formatElevation(activity.elevation_m, user.units)} />
        <Stat label="Avg HR" value={activity.avg_hr ? `${activity.avg_hr} bpm` : null} />
        <Stat label="Max HR" value={activity.max_hr ? `${activity.max_hr} bpm` : null} />
        <Stat label="Power" value={activity.avg_power ? `${activity.avg_power} W` : null} />
        <Stat
          label="Load"
          value={
            metrics?.potential_load != null ? String(Math.round(metrics.potential_load)) : null
          }
          hint={[
            loadMethodLabel(metrics?.load_method),
            dataQualityLabel(metrics?.data_quality),
          ]
            .filter(Boolean)
            .join(" · ")}
        />
        <Stat
          label="Cadence"
          value={
            activity.avg_cadence
              ? `${activity.avg_cadence} ${activity.sport === "ride" ? "rpm" : "spm"}`
              : null
          }
        />
        <Stat
          label="Intensity"
          value={metrics?.intensity != null ? String(metrics.intensity) : null}
        />
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {mix ? <MixBar mix={mix} /> : null}
        {zones ? <ZoneBar zones={zones} /> : null}
      </div>

      <div className="mt-8 grid gap-4">
        {streamError ? <p className="text-sm text-muted">{streamError}</p> : null}
        {charts?.hr && charts.hr.length > 1 ? (
          <StreamChart
            title="Heart rate"
            points={clipSeries(charts.hr)}
            color="var(--ember)"
            formatY={(value) => `${Math.round(value)}`}
            unitLabel="bpm"
          />
        ) : null}
        {charts?.pace && charts.pace.length > 1 ? (
          <StreamChart
            title={activity.sport === "ride" ? "Speed" : "Pace"}
            points={clipSeries(charts.pace)}
            color={activity.sport === "ride" ? "var(--ride)" : "var(--run)"}
            invert={activity.sport !== "ride"}
            formatY={(value) =>
              activity.sport === "ride"
                ? value.toFixed(1)
                : formatPaceFromSeconds(value, user.units)
            }
            unitLabel={
              activity.sport === "ride"
                ? user.units === "imperial"
                  ? "mph"
                  : "km/h"
                : undefined
            }
          />
        ) : null}
        {charts?.elevation && charts.elevation.length > 1 ? (
          <StreamChart
            title="Elevation"
            points={clipSeries(charts.elevation)}
            color="var(--sage)"
            formatY={(value) =>
              user.units === "imperial"
                ? String(Math.round(value / 0.3048))
                : String(Math.round(value))
            }
            unitLabel={user.units === "imperial" ? "ft" : "m"}
          />
        ) : null}
        {charts?.power && charts.power.length > 1 ? (
          <StreamChart
            title="Power"
            points={clipSeries(charts.power)}
            color="var(--forest)"
            formatY={(value) => `${Math.round(value)}`}
            unitLabel="W"
          />
        ) : null}
        {charts?.cadence && charts.cadence.length > 1 ? (
          <StreamChart
            title="Cadence"
            points={clipSeries(charts.cadence)}
            color="var(--steel)"
            formatY={(value) => `${Math.round(value)}`}
            unitLabel={activity.sport === "ride" ? "rpm" : "spm"}
          />
        ) : null}
      </div>

      {laps.length > 0 ? (
        <section className="mt-10">
          <h2 className="title text-[1.85rem] text-ink">Laps</h2>
          <div className="mt-4 overflow-x-auto rounded-md border border-line">
            <table className="min-w-full text-left text-[13px]">
              <thead className="bg-paper text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Lap</th>
                  <th className="px-3 py-2 font-medium">Time</th>
                  <th className="px-3 py-2 font-medium">Distance</th>
                  <th className="px-3 py-2 font-medium">
                    {activity.sport === "ride" ? "Speed" : "Pace"}
                  </th>
                  <th className="px-3 py-2 font-medium">HR</th>
                  {laps.some((lap) => lap.avg_power) ? (
                    <th className="px-3 py-2 font-medium">Power</th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-paper-raised">
                {laps.map((lap, index) => {
                  const speed =
                    lap.distance_m && lap.duration_seconds
                      ? lap.distance_m / lap.duration_seconds
                      : null;
                  return (
                    <tr key={lap.id}>
                      <td className="px-3 py-2 text-ink">{index + 1}</td>
                      <td className="px-3 py-2 text-ink">
                        {formatHms(lap.duration_seconds) ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-ink">
                        {formatDistance(lap.distance_m, user.units) ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-ink">
                        {paceForSport(speed, activity.sport, user.units) ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-ink">
                        {lap.avg_hr ? `${lap.avg_hr}` : "—"}
                      </td>
                      {laps.some((item) => item.avg_power) ? (
                        <td className="px-3 py-2 text-ink">
                          {lap.avg_power ? `${lap.avg_power} W` : "—"}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </article>
  );
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