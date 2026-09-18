"use client";

import {
  CHART_RANGES,
  HistoryChart,
  type ChartRangeId,
  type HistoryDay,
} from "@/components/app/history-chart";
import { useAppUser } from "@/components/app/app-shell";
import { ThisWeekSummary } from "@/components/app/this-week-summary";
import { UpcomingSessions } from "@/components/app/upcoming-sessions";
import { addDaysToKey, dateKeyInZone, formatDayShort } from "@/lib/calendar";
import {
  displayPotential,
  isPotentialCalibration,
  unmapFromHundred,
  type PotentialCalibration,
} from "@/lib/load/potential";
import {
  displayTrainingState,
  formatTrainingMetric,
  historyDays,
  isEstablishing,
} from "@/lib/load/training-state";
import {
  formatHrv,
  formatRestingHr,
  formatSleepClock,
  formatStress,
  hasRecoverySignal,
  overnightSleepMinutes,
  rangeFavorable,
  recoveryRange,
  type RecoveryObservation,
} from "@/lib/recovery";
import { createClient } from "@/lib/supabase/client";
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useMemo, useState } from "react";

type LoadRow = {
  date: string;
  training_load: number | null;
  fitness: number | null;
  fatigue: number | null;
  form: number | null;
  potential: number | null;
  aerobic_reserve: number | null;
  specific_capacity: number | null;
  acute_fatigue: number | null;
  status: string | null;
};

function toDay(row: LoadRow, calibration: PotentialCalibration | null): HistoryDay | null {
  if (row.fitness == null || row.fatigue == null || row.form == null || row.potential == null) {
    return null;
  }
  const aerobic = row.aerobic_reserve ?? 0;
  const specific = row.specific_capacity ?? 0;
  const suppression = row.acute_fatigue ?? 0;
  const strain = Math.max(suppression / 50, 0.01);
  return {
    date: row.date,
    load: row.training_load ?? 0,
    fitness: row.fitness,
    fatigue: row.fatigue,
    form: row.form,
    potential: row.potential,
    aerobic_reserve: aerobic,
    specific_capacity: specific,
    acute_fatigue: suppression,
    aerobic_raw: calibration
      ? unmapFromHundred(aerobic, calibration.aerobic_low, calibration.aerobic_high)
      : 0,
    specific_raw: calibration
      ? unmapFromHundred(specific, calibration.specific_low, calibration.specific_high)
      : 0,
    acute_load: strain * 20,
    acc_load: 20,
  };
}

export function DashboardMetrics() {
  const user = useAppUser();
  const today = dateKeyInZone(new Date(), user.timezone);
  const [headline, setHeadline] = useState<LoadRow | null | undefined>(undefined);
  const [rows, setRows] = useState<LoadRow[] | null>(null);
  const [recovery, setRecovery] = useState<RecoveryObservation[] | null>(null);
  const [calibration, setCalibration] = useState<PotentialCalibration | null>(null);
  const [historyStart, setHistoryStart] = useState<string | null>(null);
  const [range, setRange] = useState<ChartRangeId>("3m");

  useEffect(() => {
    const supabase = createClient();
    const columns =
      "date, training_load, fitness, fatigue, form, potential, aerobic_reserve, specific_capacity, acute_fatigue, status";
    void supabase
      .from("daily_loads")
      .select(columns)
      .lte("date", today)
      .not("status", "eq", "forecast")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error("Dashboard headline failed", error);
          setHeadline(null);
          return;
        }
        setHeadline((data as LoadRow | null) ?? null);
      });
    void supabase
      .from("daily_loads")
      .select(columns)
      .lte("date", today)
      .order("date", { ascending: false })
      .limit(1000)
      .then(({ data, error }) => {
        if (error) {
          console.error("Dashboard metrics failed", error);
          setRows([]);
          return;
        }
        setRows([...(data ?? [])].reverse());
      });
    void supabase
      .from("profiles")
      .select("potential_calibration")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const stored = data?.potential_calibration;
        setCalibration(isPotentialCalibration(stored) ? stored : null);
      });
    void supabase
      .from("daily_loads")
      .select("date")
      .lte("date", today)
      .order("date", { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setHistoryStart(data?.date ?? null);
      });
    void supabase
      .from("daily_recovery")
      .select("date, resting_hr, sleep_hrv_ms, sleep_minutes, sleep_score, stress_avg")
      .lte("date", today)
      .order("date", { ascending: true })
      .limit(400)
      .then(({ data, error }) => {
        if (error) {
          console.error("Dashboard recovery failed", error);
          setRecovery([]);
          return;
        }
        setRecovery((data as RecoveryObservation[] | null) ?? []);
      });
  }, [today, user.id]);

  const actual = useMemo(
    () =>
      (rows ?? [])
        .filter((row) => row.status !== "forecast")
        .map((row) => toDay(row, calibration))
        .filter((row): row is HistoryDay => row != null),
    [calibration, rows],
  );
  const chartPoints = useMemo(() => {
    const selected = CHART_RANGES.find((option) => option.id === range);
    if (!selected?.days) {
      return actual;
    }
    const from = addDaysToKey(today, -(selected.days - 1));
    return actual.filter((row) => row.date >= from);
  }, [actual, range, today]);

  if (rows == null || headline === undefined) {
    return (
      <>
        <section className="mt-10">
          <p className="text-sm text-muted">Loading today…</p>
        </section>
        <ThisWeekSummary />
        <UpcomingSessions />
      </>
    );
  }

  const current =
    (headline ? toDay(headline, calibration) : null) ??
    [...actual].reverse().find((row) => row.date <= today) ??
    null;
  if (!current) {
    return (
      <>
        <RecoveryTonight rows={recovery ?? []} today={today} />
        <ThisWeekSummary />
        <UpcomingSessions />
      </>
    );
  }

  const shown = displayTrainingState(current);
  const potential = displayPotential(current.potential);
  const establishing = isEstablishing(historyStart, today);
  const days = historyDays(historyStart, today);
  const cards = [
    {
      id: "potential",
      label: "Readiness",
      value: String(potential),
      body: "Expressible capacity",
    },
    {
      id: "fitness",
      label: "Fitness",
      value: formatTrainingMetric(shown.fitness),
      body: "Long-term load",
    },
    {
      id: "fatigue",
      label: "Fatigue",
      value: formatTrainingMetric(shown.fatigue),
      body: "Recent load",
    },
    {
      id: "form",
      label: "Form",
      value: formatTrainingMetric(shown.form),
      body: "Fitness − Fatigue",
    },
  ];

  return (
    <>
      <section className="mt-10">
        <p className="text-[13px] font-medium tracking-[0.14em] text-muted uppercase">
          Today
        </p>
        <dl className="mt-3 grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-4">
          {cards.map((card) => (
            <div key={card.id} className="bg-paper-raised px-5 py-5">
              <dt className="text-[13px] tracking-wide text-muted uppercase">{card.label}</dt>
              <dd className="mt-2">
                {card.id === "potential" ? (
                  <PotentialWhy
                    potential={potential}
                    aerobic={displayPotential(current.aerobic_reserve)}
                    specific={displayPotential(current.specific_capacity)}
                    suppression={displayPotential(current.acute_fatigue)}
                  />
                ) : (
                  <span className="font-mono text-3xl tracking-tight text-ink">{card.value}</span>
                )}
              </dd>
              <p className="mt-3 text-sm text-ink-soft">{card.body}</p>
            </div>
          ))}
        </dl>
        {establishing ? (
          <p className="mt-3 text-sm text-ink-soft">
            <span className="font-medium text-ink">Building baseline</span>
            <span className="text-muted">
              {" "}
              {days} day{days === 1 ? "" : "s"} of training history available.
            </span>
          </p>
        ) : null}
      </section>
      <RecoveryTonight rows={recovery ?? []} today={today} />
      <ThisWeekSummary />
      <UpcomingSessions />
      <HistoryChart
        points={chartPoints}
        range={range}
        onRangeChange={setRange}
        calibration={calibration}
      />
    </>
  );
}

function RecoveryTonight({
  rows,
  today,
}: {
  rows: RecoveryObservation[];
  today: string;
}) {
  const latest = [...rows].reverse().find((row) => row.date <= today && hasRecoverySignal(row));
  if (!latest) {
    return null;
  }
  const night = latest.date === today ? "Last night" : formatDayShort(latest.date);
  const sleepMinutes = overnightSleepMinutes(latest.sleep_minutes);
  const cards = [
    {
      id: "sleep",
      label: "Sleep",
      value: formatSleepClock(sleepMinutes) ?? "—",
      note: sleepMinutes == null ? "No overnight" : latest.sleep_score != null ? `Score ${latest.sleep_score}` : null,
      better: "higher" as const,
      range: recoveryRange(rows, latest.date, (row) => overnightSleepMinutes(row.sleep_minutes), sleepMinutes, 30),
    },
    {
      id: "hrv",
      label: "HRV",
      value: formatHrv(latest.sleep_hrv_ms) ?? "—",
      note: null,
      better: "higher" as const,
      range: recoveryRange(rows, latest.date, (row) => row.sleep_hrv_ms, latest.sleep_hrv_ms, 6),
    },
    {
      id: "rhr",
      label: "Resting HR",
      value: formatRestingHr(latest.resting_hr) ?? "—",
      note: null,
      better: "lower" as const,
      range: recoveryRange(rows, latest.date, (row) => row.resting_hr, latest.resting_hr, 3),
    },
    {
      id: "stress",
      label: "Stress",
      value: formatStress(latest.stress_avg) ?? "—",
      note: null,
      better: "lower" as const,
      range: recoveryRange(rows, latest.date, (row) => row.stress_avg, latest.stress_avg, 8),
    },
  ];

  return (
    <section className="mt-12">
      <p className="text-[13px] font-medium tracking-[0.14em] text-muted uppercase">
        {night}
      </p>
      <dl className="mt-3 grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-4">
        {cards.map((card) => (
          <div key={card.id} className="bg-paper-raised px-5 py-5">
            <dt className="text-[13px] tracking-wide text-muted uppercase">{card.label}</dt>
            <dd className="mt-2 font-mono text-3xl tracking-tight text-ink">{card.value}</dd>
            {card.range || card.note ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <RangePill
                  status={card.range?.status ?? null}
                  better={card.better}
                  metric={card.id}
                />
                {card.note ? <p className="text-sm text-ink-soft">{card.note}</p> : null}
              </div>
            ) : null}
          </div>
        ))}
      </dl>
    </section>
  );
}

function RangePill({
  status,
  better,
  metric,
}: {
  status: RangeStatus | null;
  better: "higher" | "lower";
  metric: string;
}) {
  if (!status) {
    return null;
  }
  const favorable = rangeFavorable(status, better);
  const label =
    metric === "stress"
      ? status === "in"
        ? "In range"
        : status === "below"
          ? "Relaxed"
          : "Elevated"
      : status === "in"
        ? "In range"
        : status === "below"
          ? "Below range"
          : "Above range";
  const tone = favorable
    ? "border-forest/35 bg-forest/10 text-forest"
    : "border-ember/40 bg-ember/10 text-ember";
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-[3px] text-[12px] tracking-wide ${tone}`}>
      {label}
    </span>
  );
}

function PotentialWhy({
  potential,
  aerobic,
  specific,
  suppression,
}: {
  potential: number;
  aerobic: number;
  specific: number;
  suppression: number;
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="font-mono text-3xl tracking-tight text-ink underline decoration-line decoration-2 underline-offset-6 transition-colors hover:decoration-ink"
        >
          {potential}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 border border-line bg-paper-raised p-6 outline-none">
          <Dialog.Title className="text-2xl font-medium tracking-tight text-ink">
            Why {potential}?
          </Dialog.Title>
          <div className="mt-5 space-y-3 text-sm">
            <p className="flex items-baseline justify-between gap-4">
              <span className="text-ink-soft">Aerobic Reserve</span>
              <span className="font-mono text-ink">{aerobic}</span>
            </p>
            <p className="flex items-baseline justify-between gap-4">
              <span className="text-ink-soft">Specific Capacity</span>
              <span className="font-mono text-ink">{specific}</span>
            </p>
            <p className="flex items-baseline justify-between gap-4">
              <span className="text-ink-soft">Fatigue Suppression</span>
              <span className="font-mono text-ink">{suppression}</span>
            </p>
          </div>
          <Dialog.Description className="mt-5 text-sm leading-6 text-ink-soft">
            Readiness combines your aerobic and specific capacity, then accounts
            for current fatigue and compares the result with your own history.
          </Dialog.Description>
          <div className="mt-6 flex justify-end">
            <Dialog.Close asChild>
              <button
                type="button"
                className="inline-flex h-9 items-center rounded-sm px-3 text-sm text-ink-soft hover:bg-paper-sunken hover:text-ink"
              >
                Close
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
