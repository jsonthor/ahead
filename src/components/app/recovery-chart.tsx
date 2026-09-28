"use client";

import { CHART_RANGES, type ChartRangeId } from "@/components/app/history-chart";
import { addDaysToKey, formatDayAxis, formatDayTitle } from "@/lib/calendar";
import { recoverySourceLabel } from "@/lib/recovery/priority";
import {
  formatHrv,
  formatRestingHr,
  formatSleepClock,
  formatStress,
  overnightSleepMinutes,
  rangeFavorable,
  recoverySeries,
  type RangeStatus,
  type RecoveryObservation,
} from "@/lib/recovery";
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useMemo, useState, type MouseEvent } from "react";

export type RecoveryChartMetric = "sleep" | "hrv" | "rhr" | "stress";

const WIDTH = 960;
const LEFT = 52;
const RIGHT = 16;
const INNER_W = WIDTH - LEFT - RIGHT;
const HEIGHT = 220;
const PAD = { top: 12, bottom: 28 };
const PLOT = HEIGHT - PAD.top - PAD.bottom;

const METRICS: Record<
  RecoveryChartMetric,
  {
    label: string;
    unit: string;
    better: "higher" | "lower";
    minSpan: number;
    read: (row: RecoveryObservation) => number | null;
    source: (row?: RecoveryObservation) => string | null | undefined;
    format: (value: number) => string;
    axis: (value: number) => string;
  }
> = {
  sleep: {
    label: "Sleep",
    unit: "",
    better: "higher",
    minSpan: 30,
    read: (row) => overnightSleepMinutes(row.sleep_minutes),
    source: (row) => row?.sleep_source,
    format: (value) => formatSleepClock(value) ?? "—",
    axis: (value) => {
      const hours = value / 60;
      return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
    },
  },
  hrv: {
    label: "HRV",
    unit: "ms",
    better: "higher",
    minSpan: 6,
    read: (row) => row.sleep_hrv_ms,
    source: (row) => row?.hrv_source,
    format: (value) => formatHrv(value) ?? "—",
    axis: (value) => String(Math.round(value)),
  },
  rhr: {
    label: "Resting HR",
    unit: "bpm",
    better: "lower",
    minSpan: 3,
    read: (row) => row.resting_hr,
    source: (row) => row?.resting_hr_source,
    format: (value) => formatRestingHr(value) ?? "—",
    axis: (value) => String(Math.round(value)),
  },
  stress: {
    label: "Stress",
    unit: "",
    better: "lower",
    minSpan: 8,
    read: (row) => row.stress_avg,
    source: () => null,
    format: (value) => formatStress(value) ?? "—",
    axis: (value) => String(Math.round(value)),
  },
};

function niceStep(span: number, count: number) {
  const raw = span / Math.max(1, count);
  const exponent = Math.floor(Math.log10(Math.max(raw, 0.1)));
  const base = 10 ** exponent;
  const error = raw / base;
  const nice = error >= 7.5 ? 10 : error >= 3 ? 5 : error >= 1.5 ? 2 : 1;
  return nice * base;
}

function niceScale(min: number, max: number, count = 5) {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max, lo + 1);
  const step = niceStep(hi - lo, count - 1);
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let value = start; value <= end + step / 2; value += step) {
    ticks.push(Math.round(value * 10) / 10);
  }
  return { min: start, max: end === start ? start + step : end, ticks };
}

function xAt(index: number, total: number) {
  return LEFT + (total <= 1 ? INNER_W / 2 : (index / (total - 1)) * INNER_W);
}

function yAt(value: number, scale: { min: number; max: number }) {
  return PAD.top + ((scale.max - value) / (scale.max - scale.min || 1)) * PLOT;
}

function indexFromSvg(event: MouseEvent<SVGSVGElement>, total: number) {
  const svg = event.currentTarget;
  const ctm = svg.getScreenCTM();
  if (!ctm) {
    return null;
  }
  const cursor = svg.createSVGPoint();
  cursor.x = event.clientX;
  cursor.y = event.clientY;
  const local = cursor.matrixTransform(ctm.inverse());
  const ratio = (local.x - LEFT) / INNER_W;
  return Math.min(total - 1, Math.max(0, Math.round(ratio * (total - 1))));
}

function rangeLabel(status: RangeStatus | null, metric: RecoveryChartMetric) {
  if (!status) {
    return "Building range";
  }
  if (metric === "stress") {
    return status === "in" ? "In range" : status === "below" ? "Relaxed" : "Elevated";
  }
  return status === "in" ? "In range" : status === "below" ? "Below range" : "Above range";
}

export function RecoveryChartDialog({
  metric,
  rows,
  today,
  open,
  onOpenChange,
}: {
  metric: RecoveryChartMetric;
  rows: RecoveryObservation[];
  today: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const spec = METRICS[metric];
  const [range, setRange] = useState<ChartRangeId>("3m");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  useEffect(() => {
    setHoverIndex(null);
  }, [metric, range]);

  const series = useMemo(() => {
    const all = recoverySeries(rows, spec.read, spec.minSpan);
    const selected = CHART_RANGES.find((option) => option.id === range);
    if (!selected?.days) {
      return all;
    }
    const from = addDaysToKey(today, -(selected.days - 1));
    return all.filter((point) => point.date >= from);
  }, [range, rows, spec, today]);

  const layout = useMemo(() => {
    const total = series.length;
    const values = series.map((point) => point.value);
    const lows = series.map((point) => point.range?.low).filter((value): value is number => value != null);
    const highs = series.map((point) => point.range?.high).filter((value): value is number => value != null);
    const scale = niceScale(
      Math.min(...values, ...lows, values[0] ?? 0),
      Math.max(...values, ...highs, values[0] ?? 1),
      5,
    );
    const y = (value: number) => yAt(value, scale);
    const line = series
      .map((point, index) => `${index === 0 ? "M" : "L"}${xAt(index, total)} ${y(point.value)}`)
      .join(" ");
    const ranged = series.flatMap((point, index) =>
      point.range ? [{ index, low: point.range.low, high: point.range.high }] : [],
    );
    const band =
      ranged.length >= 2
        ? [
            ...ranged.map(
              (point, order) =>
                `${order === 0 ? "M" : "L"}${xAt(point.index, total)} ${y(point.high)}`,
            ),
            ...[...ranged]
              .reverse()
              .map((point) => `L${xAt(point.index, total)} ${y(point.low)}`),
            "Z",
          ].join(" ")
        : null;
    const ticks: number[] = [];
    if (total > 1) {
      const count = total > 90 ? 6 : 5;
      for (let index = 0; index < count; index += 1) {
        ticks.push(Math.round((index * (total - 1)) / (count - 1)));
      }
    }
    return { total, scale, y, line, band, ticks: [...new Set(ticks)] };
  }, [series]);

  const lastIndex = Math.max(0, series.length - 1);
  const activeIndex = hoverIndex ?? lastIndex;
  const active = series[activeIndex] ?? null;
  const first = series[0];
  const last = series[series.length - 1];
  const rowByDate = useMemo(() => new Map(rows.map((row) => [row.date, row])), [rows]);
  const source = active ? spec.source(rowByDate.get(active.date)) : null;
  const favorable = active?.range
    ? rangeFavorable(active.range.status, spec.better)
    : true;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[min(48rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-line bg-paper-raised p-5 outline-none sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Dialog.Title className="title text-[2rem] text-ink">{spec.label}</Dialog.Title>
              <Dialog.Description className="mt-2 text-sm text-ink-soft">
                {active ? (
                  <>
                    <span className="text-ink">{formatDayTitle(active.date)}</span>
                    {" · "}
                    {spec.format(active.value)}
                    {spec.unit ? ` ${spec.unit}` : ""}
                    {source ? ` · ${recoverySourceLabel(source)}` : ""}
                    {" · "}
                    <span className={favorable ? "text-forest" : "text-ember"}>
                      {rangeLabel(active.range?.status ?? null, metric)}
                    </span>
                  </>
                ) : (
                  "No overnight values yet."
                )}
              </Dialog.Description>
              {first && last ? (
                <p className="mt-1 text-[12px] text-muted">
                  {formatDayTitle(first.date)} – {formatDayTitle(last.date)}
                  {" · "}shaded band is typical range (prior 28 nights)
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {CHART_RANGES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setRange(option.id)}
                  className={`rounded-full border px-3 py-1 text-[13px] transition-colors ${
                    range === option.id
                      ? "border-ink bg-ink text-paper"
                      : "border-line text-ink-soft hover:border-ink/40 hover:text-ink"
                  }`}
                  aria-pressed={range === option.id}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {series.length < 2 ? (
            <p className="mt-8 text-sm text-ink-soft">
              Need a few more nights before a history chart is useful.
            </p>
          ) : (
            <svg
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              className="mt-5 block h-52 w-full cursor-crosshair sm:h-56"
              role="img"
              aria-label={`${spec.label} history`}
              onMouseMove={(event) => {
                const index = indexFromSvg(event, layout.total);
                if (index != null) {
                  setHoverIndex(index);
                }
              }}
              onMouseLeave={() => setHoverIndex(null)}
            >
              {layout.scale.ticks.map((tick) => (
                <g key={tick}>
                  <line
                    x1={LEFT}
                    x2={LEFT + INNER_W}
                    y1={layout.y(tick)}
                    y2={layout.y(tick)}
                    stroke="var(--line)"
                    strokeDasharray="2 6"
                    strokeWidth="1"
                  />
                  <text
                    x={LEFT - 8}
                    y={layout.y(tick) + 4}
                    textAnchor="end"
                    className="fill-muted text-[11px]"
                  >
                    {spec.axis(tick)}
                  </text>
                </g>
              ))}
              {layout.band ? (
                <path d={layout.band} fill="var(--forest)" fillOpacity="0.12" />
              ) : null}
              <path
                d={layout.line}
                fill="none"
                stroke="var(--forest)"
                strokeWidth="1.7"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {active ? (
                <>
                  <line
                    x1={xAt(activeIndex, layout.total)}
                    x2={xAt(activeIndex, layout.total)}
                    y1={PAD.top}
                    y2={PAD.top + PLOT}
                    stroke="var(--ink)"
                    strokeOpacity="0.2"
                  />
                  <circle
                    cx={xAt(activeIndex, layout.total)}
                    cy={layout.y(active.value)}
                    r="4"
                    fill="var(--paper-raised)"
                    stroke="var(--forest)"
                    strokeWidth="1.6"
                  />
                </>
              ) : null}
              {layout.ticks.map((index) => {
                const point = series[index];
                if (!point) {
                  return null;
                }
                return (
                  <text
                    key={point.date}
                    x={xAt(index, layout.total)}
                    y={HEIGHT - 8}
                    textAnchor="middle"
                    className="fill-muted text-[11px]"
                  >
                    {formatDayAxis(point.date)}
                  </text>
                );
              })}
            </svg>
          )}

          <div className="mt-5 flex justify-end">
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


