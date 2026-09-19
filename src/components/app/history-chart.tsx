"use client";

import { addDaysToKey, formatDayAxis, formatDayTitle } from "@/lib/calendar";
import {
  displayPotential,
  forecastPotential,
  type DailyPotential,
  type PotentialCalibration,
} from "@/lib/load/potential";
import {
  displayTrainingState,
  forecastTrainingState,
  formatTrainingMetric,
} from "@/lib/load/training-state";
import { useId, useMemo, useState, type MouseEvent } from "react";

export const CHART_RANGES = [
  { id: "3m", days: 92, label: "3 months" },
  { id: "1y", days: 365, label: "1 year" },
  { id: "full", days: null, label: "All time" },
] as const;

export type ChartRangeId = (typeof CHART_RANGES)[number]["id"];

export type HistoryDay = {
  date: string;
  load: number;
  fitness: number;
  fatigue: number;
  form: number;
  potential: number;
  aerobic_reserve: number;
  specific_capacity: number;
  acute_fatigue: number;
  aerobic_raw: number;
  specific_raw: number;
  acute_load: number;
  acc_load: number;
};

const FORECAST_DAYS = 7;
const WIDTH = 960;
const LEFT = 44;
const RIGHT = 16;
const INNER_W = WIDTH - LEFT - RIGHT;
const POTENTIAL_H = 168;
const LOAD_H = 220;
const FORM_H = 128;
const POTENTIAL_PAD = { top: 10, bottom: 10 };
const LOAD_PAD = { top: 10, bottom: 10 };
const FORM_PAD = { top: 10, bottom: 28 };

const POTENTIAL = "var(--forest)";
const FITNESS = "var(--ink)";
const FATIGUE = "var(--ember)";
const FORM = "var(--sage)";

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

function tickIndexes(length: number, count: number) {
  if (length <= 1) {
    return [0];
  }
  const ticks: number[] = [];
  for (let index = 0; index < count; index += 1) {
    ticks.push(Math.round((index * (length - 1)) / (count - 1)));
  }
  return [...new Set(ticks)];
}

function xAt(index: number, total: number) {
  return LEFT + (total <= 1 ? INNER_W / 2 : (index / (total - 1)) * INNER_W);
}

function yAt(value: number, scale: { min: number; max: number }, top: number, height: number) {
  return top + ((scale.max - value) / (scale.max - scale.min || 1)) * height;
}

function formatAxis(value: number) {
  return Number.isInteger(value) ? String(value) : formatTrainingMetric(value);
}

function rangePillClass(active: boolean) {
  return `rounded-full border px-3 py-1 text-[13px] transition-colors ${
    active
      ? "border-ink bg-ink text-paper"
      : "border-line text-ink-soft hover:border-ink/40 hover:text-ink"
  }`;
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

function pathFor(
  points: HistoryDay[],
  key: keyof Pick<HistoryDay, "potential" | "fitness" | "fatigue" | "form">,
  total: number,
  y: (value: number) => number,
  offset = 0,
) {
  return points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${xAt(offset + index, total)} ${y(point[key])}`,
    )
    .join(" ");
}

function formArea(
  points: HistoryDay[],
  total: number,
  y: (value: number) => number,
  zero: number,
) {
  if (points.length === 0) {
    return "";
  }
  const last = points.length - 1;
  const line = points.map((point, index) => `L${xAt(index, total)} ${y(point.form)}`).join(" ");
  return `M${xAt(0, total)} ${zero} ${line} L${xAt(last, total)} ${zero} Z`;
}

function potentialArea(
  points: HistoryDay[],
  total: number,
  y: (value: number) => number,
) {
  if (points.length === 0) {
    return "";
  }
  const last = points.length - 1;
  const line = points
    .map((point, index) => `L${xAt(index, total)} ${y(point.potential)}`)
    .join(" ");
  return `M${xAt(0, total)} ${y(0)} ${line} L${xAt(last, total)} ${y(0)} Z`;
}

function toPotentialState(day: HistoryDay): DailyPotential {
  return {
    date: day.date,
    aerobic_raw: day.aerobic_raw,
    specific_raw: day.specific_raw,
    acute_load: day.acute_load,
    acc_load: day.acc_load,
    aerobic_reserve: day.aerobic_reserve,
    specific_capacity: day.specific_capacity,
    acute_fatigue: day.acute_fatigue,
    capacity: 0.65 * (day.aerobic_reserve / 100) + 0.35 * (day.specific_capacity / 100),
    potential: day.potential,
  };
}

export function HistoryChart({
  points,
  range,
  onRangeChange,
  calibration,
}: {
  points: HistoryDay[];
  range: ChartRangeId;
  onRangeChange: (range: ChartRangeId) => void;
  calibration?: PotentialCalibration | null;
}) {
  const formFillId = useId().replaceAll(":", "");
  const potentialFillId = useId().replaceAll(":", "");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const forecast = useMemo(() => {
    const last = points[points.length - 1];
    if (!last) {
      return [] as HistoryDay[];
    }
    const rest = Array.from({ length: FORECAST_DAYS }, (_, index) => ({
      date: addDaysToKey(last.date, index + 1),
      load: 0,
    }));
    const loadForecast = forecastTrainingState(last, rest);
    const potentialForecast = forecastPotential(
      toPotentialState(last),
      rest.map((day) => day.date),
      calibration,
    );
    return loadForecast.map((day, index) => {
      const next = potentialForecast[index];
      return {
        date: day.date,
        load: day.load,
        fitness: day.fitness,
        fatigue: day.fatigue,
        form: day.form,
        potential: next?.potential ?? last.potential,
        aerobic_reserve: next?.aerobic_reserve ?? last.aerobic_reserve,
        specific_capacity: next?.specific_capacity ?? last.specific_capacity,
        acute_fatigue: next?.acute_fatigue ?? last.acute_fatigue,
        aerobic_raw: next?.aerobic_raw ?? 0,
        specific_raw: next?.specific_raw ?? 0,
        acute_load: next?.acute_load ?? 0,
        acc_load: next?.acc_load ?? 0,
      };
    });
  }, [calibration, points]);

  const layout = useMemo(() => {
    const series = [...points, ...forecast];
    const total = series.length;
    const todayIndex = points.length - 1;
    const loadValues = series.flatMap((point) => [point.fitness, point.fatigue]);
    const formValues = series.map((point) => point.form);
    const formPeak = Math.max(1, ...formValues.map((value) => Math.abs(value)));
    const loadScale = niceScale(0, Math.max(1, ...loadValues), 5);
    const formScale = niceScale(-formPeak, formPeak, 5);
    const potentialScale = { min: 0, max: 100, ticks: [0, 50, 100] };
    const potentialPlot = POTENTIAL_H - POTENTIAL_PAD.top - POTENTIAL_PAD.bottom;
    const loadPlot = LOAD_H - LOAD_PAD.top - LOAD_PAD.bottom;
    const formPlot = FORM_H - FORM_PAD.top - FORM_PAD.bottom;
    const potentialY = (value: number) =>
      yAt(value, potentialScale, POTENTIAL_PAD.top, potentialPlot);
    const loadY = (value: number) => yAt(value, loadScale, LOAD_PAD.top, loadPlot);
    const formY = (value: number) => yAt(value, formScale, FORM_PAD.top, formPlot);
    const forecastStart = points.length > 0 ? [points[todayIndex], ...forecast] : forecast;
    return {
      total,
      todayIndex,
      potentialScale,
      loadScale,
      formScale,
      potentialY,
      loadY,
      formY,
      formZero: formY(0),
      potentialBottom: POTENTIAL_PAD.top + potentialPlot,
      loadBottom: LOAD_PAD.top + loadPlot,
      formBottom: FORM_PAD.top + formPlot,
      xTicks: tickIndexes(Math.max(points.length, 2), points.length > 240 ? 6 : 5),
      potential: pathFor(points, "potential", total, potentialY),
      potentialArea: potentialArea(points, total, potentialY),
      potentialDash: pathFor(forecastStart, "potential", total, potentialY, todayIndex),
      fitness: pathFor(points, "fitness", total, loadY),
      fatigue: pathFor(points, "fatigue", total, loadY),
      fitnessDash: pathFor(forecastStart, "fitness", total, loadY, todayIndex),
      fatigueDash: pathFor(forecastStart, "fatigue", total, loadY, todayIndex),
      form: pathFor(points, "form", total, formY),
      formArea: formArea(points, total, formY, formY(0)),
      formDash: pathFor(forecastStart, "form", total, formY, todayIndex),
    };
  }, [forecast, points]);

  if (points.length < 2) {
    return null;
  }

  const series = [...points, ...forecast];
  const activeIndex = hoverIndex ?? layout.todayIndex;
  const activePoint = series[activeIndex] ?? points[layout.todayIndex];
  const shown = displayTrainingState(activePoint);
  const first = points[0];
  const last = points[points.length - 1];
  const cursor = xAt(activeIndex, layout.total);
  const todayX = xAt(layout.todayIndex, layout.total);

  function onMove(event: MouseEvent<SVGSVGElement>) {
    const index = indexFromSvg(event, layout.total);
    if (index != null) {
      setHoverIndex(index);
    }
  }

  return (
    <section id="performance-history" className="mt-12 scroll-mt-24">
      <figure className="rounded-2xl border border-line bg-paper-raised px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="kicker">
              History
            </p>
            <p className="mt-2 text-sm text-ink-soft">
              <span className="text-ink">{formatDayTitle(activePoint.date)}</span>
              {" · "}Performance {displayPotential(activePoint.potential)}
              {" · "}Fitness {formatTrainingMetric(shown.fitness)}
              {" · "}Fatigue {formatTrainingMetric(shown.fatigue)}
              {" · "}Form {formatTrainingMetric(shown.form)}
            </p>
            <p className="mt-1 text-[12px] text-muted">
              {formatDayTitle(first.date)} – {formatDayTitle(last.date)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {CHART_RANGES.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onRangeChange(option.id)}
                className={rangePillClass(range === option.id)}
                aria-pressed={range === option.id}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-5 text-[13px] font-medium text-ink">Performance</p>
        <svg
          viewBox={`0 0 ${WIDTH} ${POTENTIAL_H}`}
          className="mt-1 block h-36 w-full cursor-crosshair sm:h-40"
          role="img"
          aria-label="Performance"
          onMouseMove={onMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id={potentialFillId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--forest)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--forest)" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {layout.potentialScale.ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={LEFT}
                x2={LEFT + INNER_W}
                y1={layout.potentialY(tick)}
                y2={layout.potentialY(tick)}
                stroke="var(--line)"
                strokeDasharray="2 6"
                strokeWidth="1"
              />
              <text
                x={LEFT - 8}
                y={layout.potentialY(tick) + 4}
                textAnchor="end"
                className="fill-muted text-[11px]"
              >
                {tick}
              </text>
            </g>
          ))}
          <path d={layout.potentialArea} fill={`url(#${potentialFillId})`} />
          <line
            x1={todayX}
            x2={todayX}
            y1={POTENTIAL_PAD.top}
            y2={layout.potentialBottom}
            stroke="var(--ink)"
            strokeOpacity="0.2"
            strokeDasharray="2 5"
          />
          <line
            x1={cursor}
            x2={cursor}
            y1={POTENTIAL_PAD.top}
            y2={layout.potentialBottom}
            stroke="var(--ink)"
            strokeOpacity={activeIndex === layout.todayIndex ? 0 : 0.2}
          />
          <path
            d={layout.potential}
            fill="none"
            stroke={POTENTIAL}
            strokeWidth="1.7"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            d={layout.potentialDash}
            fill="none"
            stroke={POTENTIAL}
            strokeWidth="1.5"
            strokeDasharray="5 6"
            strokeOpacity="0.7"
          />
          <circle
            cx={todayX}
            cy={layout.potentialY(points[layout.todayIndex].potential)}
            r="4"
            fill="var(--paper-raised)"
            stroke={POTENTIAL}
            strokeWidth="1.6"
          />
          {activeIndex !== layout.todayIndex ? (
            <circle cx={cursor} cy={layout.potentialY(activePoint.potential)} r="3.25" fill={POTENTIAL} />
          ) : null}
        </svg>

        <div className="mt-4 flex items-baseline justify-between gap-3">
          <p className="text-[13px] font-medium text-ink">Fitness & Fatigue</p>
          <p className="flex gap-4 text-[12px] text-ink-soft">
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 bg-ink" /> Fitness
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 bg-ember" /> Fatigue
            </span>
          </p>
        </div>
        <svg
          viewBox={`0 0 ${WIDTH} ${LOAD_H}`}
          className="mt-1 block h-48 w-full cursor-crosshair sm:h-52"
          role="img"
          aria-label="Fitness and Fatigue"
          onMouseMove={onMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          {layout.loadScale.ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={LEFT}
                x2={LEFT + INNER_W}
                y1={layout.loadY(tick)}
                y2={layout.loadY(tick)}
                stroke="var(--line)"
                strokeDasharray="2 6"
                strokeWidth="1"
              />
              <text
                x={LEFT - 8}
                y={layout.loadY(tick) + 4}
                textAnchor="end"
                className="fill-muted text-[11px]"
              >
                {formatAxis(tick)}
              </text>
            </g>
          ))}
          <line
            x1={todayX}
            x2={todayX}
            y1={LOAD_PAD.top}
            y2={layout.loadBottom}
            stroke="var(--ink)"
            strokeOpacity="0.2"
            strokeDasharray="2 5"
          />
          <line
            x1={cursor}
            x2={cursor}
            y1={LOAD_PAD.top}
            y2={layout.loadBottom}
            stroke="var(--ink)"
            strokeOpacity={activeIndex === layout.todayIndex ? 0 : 0.2}
          />
          <path d={layout.fitness} fill="none" stroke={FITNESS} strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" />
          <path d={layout.fatigue} fill="none" stroke={FATIGUE} strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" />
          <path d={layout.fitnessDash} fill="none" stroke={FITNESS} strokeWidth="1.5" strokeDasharray="5 6" strokeOpacity="0.7" />
          <path d={layout.fatigueDash} fill="none" stroke={FATIGUE} strokeWidth="1.5" strokeDasharray="5 6" strokeOpacity="0.7" />
          <circle cx={todayX} cy={layout.loadY(points[layout.todayIndex].fitness)} r="4" fill="var(--paper-raised)" stroke={FITNESS} strokeWidth="1.6" />
          <circle cx={todayX} cy={layout.loadY(points[layout.todayIndex].fatigue)} r="4" fill="var(--paper-raised)" stroke={FATIGUE} strokeWidth="1.6" />
          {activeIndex !== layout.todayIndex ? (
            <>
              <circle cx={cursor} cy={layout.loadY(activePoint.fitness)} r="3.25" fill={FITNESS} />
              <circle cx={cursor} cy={layout.loadY(activePoint.fatigue)} r="3.25" fill={FATIGUE} />
            </>
          ) : null}
        </svg>

        <p className="mt-4 text-[13px] font-medium text-ink">Form</p>
        <svg
          viewBox={`0 0 ${WIDTH} ${FORM_H}`}
          className="mt-1 block h-24 w-full cursor-crosshair sm:h-28"
          role="img"
          aria-label="Form"
          onMouseMove={onMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id={formFillId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--sage)" stopOpacity="0.28" />
              <stop offset="50%" stopColor="var(--sage)" stopOpacity="0.12" />
              <stop offset="100%" stopColor="var(--ember)" stopOpacity="0.2" />
            </linearGradient>
          </defs>
          {layout.formScale.ticks.map((tick) => (
            <g key={tick}>
              {tick !== 0 ? (
                <line
                  x1={LEFT}
                  x2={LEFT + INNER_W}
                  y1={layout.formY(tick)}
                  y2={layout.formY(tick)}
                  stroke="var(--line)"
                  strokeDasharray="2 6"
                  strokeWidth="1"
                />
              ) : null}
              <text
                x={LEFT - 8}
                y={layout.formY(tick) + 4}
                textAnchor="end"
                className="fill-muted text-[11px]"
              >
                {formatAxis(tick)}
              </text>
            </g>
          ))}
          <path d={layout.formArea} fill={`url(#${formFillId})`} />
          <line
            x1={LEFT}
            x2={LEFT + INNER_W}
            y1={layout.formZero}
            y2={layout.formZero}
            stroke="var(--ink)"
            strokeOpacity="0.55"
            strokeWidth="1.25"
          />
          <line
            x1={todayX}
            x2={todayX}
            y1={FORM_PAD.top}
            y2={layout.formBottom}
            stroke="var(--ink)"
            strokeOpacity="0.2"
            strokeDasharray="2 5"
          />
          <line
            x1={cursor}
            x2={cursor}
            y1={FORM_PAD.top}
            y2={layout.formBottom}
            stroke="var(--ink)"
            strokeOpacity={activeIndex === layout.todayIndex ? 0 : 0.2}
          />
          <path d={layout.form} fill="none" stroke={FORM} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
          <path d={layout.formDash} fill="none" stroke={FORM} strokeWidth="1.4" strokeDasharray="5 6" strokeOpacity="0.7" />
          <circle cx={todayX} cy={layout.formY(points[layout.todayIndex].form)} r="4" fill="var(--paper-raised)" stroke={FORM} strokeWidth="1.6" />
          {activeIndex !== layout.todayIndex ? (
            <circle cx={cursor} cy={layout.formY(activePoint.form)} r="3.25" fill={FORM} />
          ) : null}
          {layout.xTicks.map((index) => (
            <text
              key={points[index].date}
              x={xAt(index, layout.total)}
              y={FORM_H - 8}
              textAnchor="middle"
              className="fill-muted text-[11px]"
            >
              {formatDayAxis(points[index].date)}
            </text>
          ))}
        </svg>
      </figure>
    </section>
  );
}
