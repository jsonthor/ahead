"use client";

import { useAppUser } from "@/components/app/app-shell";
import {
  addDaysToKey,
  dateKeyInZone,
  mondayKeyInZone,
} from "@/lib/calendar";
import { createClient } from "@/lib/supabase/client";
import { formatDuration } from "@/lib/units";
import { useEffect, useState } from "react";

type Mix = {
  easy_seconds?: number;
  specific_seconds?: number;
  high_seconds?: number;
};

type WeekRow = {
  started_at: string;
  duration_seconds: number | null;
  activity_metrics:
    | { potential_load: number | null; training_mix: Mix | null }
    | { potential_load: number | null; training_mix: Mix | null }[]
    | null;
};

function metricsOf(row: WeekRow) {
  const value = row.activity_metrics;
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value;
}

export function ThisWeekSummary() {
  const user = useAppUser();
  const today = dateKeyInZone(new Date(), user.timezone);
  const monday = mondayKeyInZone(new Date(), user.timezone);
  const [rows, setRows] = useState<WeekRow[] | null>(null);

  useEffect(() => {
    const supabase = createClient();
    void supabase
      .from("activities")
      .select("started_at, duration_seconds, activity_metrics(potential_load, training_mix)")
      .eq("intelligence_eligible", true)
      .eq("status", "ready")
      .gte("started_at", `${addDaysToKey(monday, -1)}T00:00:00.000Z`)
      .lt("started_at", `${addDaysToKey(today, 2)}T00:00:00.000Z`)
      .then(({ data, error }) => {
        if (error) {
          console.error("This week failed", error);
          setRows([]);
          return;
        }
        setRows((data as WeekRow[] | null) ?? []);
      });
  }, [monday, today, user.timezone]);

  if (rows == null) {
    return null;
  }

  const week = rows.filter((row) => {
    const key = dateKeyInZone(new Date(row.started_at), user.timezone);
    return key >= monday && key <= today;
  });

  let hours = 0;
  let load = 0;
  let easy = 0;
  let specific = 0;
  for (const row of week) {
    hours += row.duration_seconds ?? 0;
    const metrics = metricsOf(row);
    load += metrics?.potential_load ?? 0;
    easy += metrics?.training_mix?.easy_seconds ?? 0;
    specific +=
      (metrics?.training_mix?.specific_seconds ?? 0) +
      (metrics?.training_mix?.high_seconds ?? 0);
  }

  const stats = [
    { label: "Hours", value: formatDuration(hours) ?? "0m" },
    { label: "Load", value: String(Math.round(load)) },
    { label: "Easy", value: formatDuration(easy) ?? "0m" },
    { label: "Specific", value: formatDuration(specific) ?? "0m" },
    { label: "Sessions", value: String(week.length) },
  ];

  return (
    <section className="mt-12">
      <p className="text-[13px] font-medium tracking-[0.14em] text-muted uppercase">
        Training This Week
      </p>
      {week.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">No completed sessions yet this week.</p>
      ) : (
        <dl className="mt-3 grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-5">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-paper-raised px-5 py-4">
              <dt className="text-[12px] tracking-wide text-muted uppercase">{stat.label}</dt>
              <dd className="mt-2 font-mono text-xl tracking-tight text-ink">{stat.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
