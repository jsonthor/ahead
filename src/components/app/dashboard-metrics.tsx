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
import { CALENDAR_CHANGED_EVENT } from "@/lib/calendar-event";
import {
  displayPotential,
  isPotentialCalibration,
  unmapFromHundred,
  type PotentialCalibration,
} from "@/lib/load/potential";
import {
  componentWord,
  inferPerformance,
  performanceTone,
  performanceWhyLine,
  strainWord,
} from "@/lib/load/performance";
import * as Dialog from "@radix-ui/react-dialog";
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
  type RangeStatus,
  type RecoveryObservation,
} from "@/lib/recovery";
import { createClient } from "@/lib/supabase/client";
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
  aerobic_raw: number | null;
  specific_raw: number | null;
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
    aerobic_raw:
      row.aerobic_raw ??
      (calibration
        ? unmapFromHundred(aerobic, calibration.aerobic_low, calibration.aerobic_high)
        : 0),
    specific_raw:
      row.specific_raw ??
      (calibration
        ? unmapFromHundred(specific, calibration.specific_low, calibration.specific_high)
        : 0),
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
  const [reload, setReload] = useState(0);

  useEffect(() => {
    function onChange() {
      setReload((value) => value + 1);
    }
    window.addEventListener(CALENDAR_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(CALENDAR_CHANGED_EVENT, onChange);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const columns =
      "date, training_load, fitness, fatigue, form, potential, aerobic_reserve, specific_capacity, aerobic_raw, specific_raw, acute_fatigue, status";
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
  }, [reload, today, user.id]);

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
  const performanceDays = useMemo(
    () =>
      (rows ?? [])
        .filter((row) => row.status !== "forecast")
        .map((row) => ({
          date: row.date,
          potential: row.potential,
          aerobic_reserve: row.aerobic_reserve,
          specific_capacity: row.specific_capacity,
        })),
    [rows],
  );
  const performance = useMemo(
    () => inferPerformance(performanceDays, today),
    [performanceDays, today],
  );

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
  const score = performance.score ?? displayPotential(current.potential);
  const establishing = isEstablishing(historyStart, today);
  const days = historyDays(historyStart, today);
  const lookback = addDaysToKey(current.date, -28);
  const baseline = [...actual].reverse().find((row) => row.date <= lookback);
  const why = [
    {
      id: "aerobic",
      label: "Aerobic capacity",
      value: displayPotential(current.aerobic_reserve),
      body: componentWord(
        baseline ? current.aerobic_reserve - baseline.aerobic_reserve : null,
        displayPotential(current.aerobic_reserve),
      ),
    },
    {
      id: "specific",
      label: "Specific capacity",
      value: displayPotential(current.specific_capacity),
      body: componentWord(
        baseline ? current.specific_capacity - baseline.specific_capacity : null,
        displayPotential(current.specific_capacity),
      ),
    },
    {
      id: "strain",
      label: "Strain",
      value: displayPotential(current.acute_fatigue),
      body: strainWord(current.acute_fatigue),
    },
  ];
  const loadCards = [
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
      <section className="mt-10 border border-line bg-paper-raised px-5 py-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="kicker">Performance</p>
            <div className="mt-1.5 flex flex-wrap items-end gap-3">
              <p className="metric text-[2.6rem] leading-none text-ink">{score}</p>
              {performance.delta != null && performance.delta !== 0 ? (
                <p
                  className={`mb-0.5 text-sm ${
                    performance.delta < 0 ? "text-ember" : "text-forest"
                  }`}
                >
                  {performance.delta > 0 ? "↑" : "↓"} {Math.abs(performance.delta)}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() =>
                document.getElementById("performance-history")?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                })
              }
              className={`mt-2 text-[15px] underline decoration-line decoration-2 underline-offset-4 hover:decoration-ink ${performanceTone(performance.state)}`}
            >
              {performance.label}
            </button>
          </div>
          {why.map((card) => (
            <div key={card.id}>
              <p className="kicker">{card.label}</p>
              <p className="metric mt-1.5 text-[2.6rem] leading-none text-ink">{card.value}</p>
              {card.body === "At top of range" || card.body === "At bottom of range" ? (
                <RangeNote label={card.label} body={card.body} />
              ) : (
                <p className="mt-2 text-[15px] text-ink-soft">{card.body ?? "—"}</p>
              )}
            </div>
          ))}
        </div>
        <p className="mt-5 max-w-3xl text-sm leading-6 text-ink-soft">
          {performanceWhyLine({
            aerobic: why[0]?.body ?? null,
            specific: why[1]?.body ?? null,
            strain: why[2]?.body ?? null,
          })}
        </p>
      </section>
      <section className="mt-8">
        <p className="kicker">Training load</p>
        <dl className="mt-3 grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-3">
          {loadCards.map((card) => (
            <div key={card.id} className="bg-paper-raised px-5 py-5">
              <dt className="kicker">{card.label}</dt>
              <dd className="mt-2">
                <span className="metric text-[2rem] text-ink">{card.value}</span>
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
      <p className="kicker">{night}</p>
      <dl className="mt-3 grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-4">
        {cards.map((card) => (
          <div key={card.id} className="bg-paper-raised px-5 py-5">
            <dt className="kicker">{card.label}</dt>
            <dd className="metric mt-2 text-[2rem] text-ink">{card.value}</dd>
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

function RangeNote({ label, body }: { label: string; body: string }) {
  const top = body === "At top of range";
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="mt-2 text-left text-[15px] text-ink-soft underline decoration-line decoration-2 underline-offset-4 hover:text-ink hover:decoration-ink"
        >
          {body}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 border border-line bg-paper-raised p-6 outline-none">
          <Dialog.Title className="title text-[2rem] text-ink">{body}</Dialog.Title>
          <Dialog.Description className="mt-4 text-sm leading-6 text-ink-soft">
            {top
              ? `${label} is at the top of this athlete's own historical 0–100 scale. The underlying work can still be rising; the displayed ruler is full.`
              : `${label} is at the bottom of this athlete's own historical 0–100 scale. The underlying work can still be easing; the displayed ruler is empty.`}
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

