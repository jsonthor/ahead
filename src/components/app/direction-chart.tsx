"use client";

import { CHART_RANGES, type ChartRangeId } from "@/components/app/history-chart";
import { addDaysToKey, formatDayAxis, formatDayTitle } from "@/lib/calendar";
import { askAboutDirection, setDirectionSelection } from "@/lib/direction-ask";
import {
  DIRECTION_BANDS,
  directionConfidenceOpacity,
  directionQuestions,
  directionScaleCopy,
  formatDirectionScore,
  type DirectionReading,
} from "@/lib/load/direction";
import { useMemo, useState, type MouseEvent } from "react";

const WIDTH = 960;
const LEFT = 86;
const RIGHT = 16;
const HEIGHT = 220;
const TOP = 12;
const BOTTOM = 28;
const INNER_W = WIDTH - LEFT - RIGHT;
const INNER_H = HEIGHT - TOP - BOTTOM;
const SCORE_MIN = -100;
const SCORE_MAX = 100;

function xAt(index: number, total: number) {
  return LEFT + (total <= 1 ? INNER_W / 2 : (index / (total - 1)) * INNER_W);
}

function yAt(score: number) {
  return TOP + ((SCORE_MAX - score) / (SCORE_MAX - SCORE_MIN)) * INNER_H;
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

function pathFor(points: Array<{ score: number }>, total: number, offset = 0) {
  return points
    .map((point, index) => {
      const command = index === 0 ? "M" : "L";
      return `${command}${xAt(offset + index, total)} ${yAt(point.score)}`;
    })
    .join(" ");
}

function rangePillClass(active: boolean) {
  return `rounded-full border px-3 py-1 text-[13px] transition-colors ${
    active
      ? "border-ink bg-ink text-paper"
      : "border-line text-ink-soft hover:border-ink/40 hover:text-ink"
  }`;
}

export function DirectionChart({
  points,
  today,
  onAsked,
}: {
  points: DirectionReading[];
  today?: string;
  onAsked?: () => void;
}) {
  const [range, setRange] = useState<ChartRangeId>("3m");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const scored = useMemo(
    () => points.filter((point) => point.score != null && point.state !== "unknown"),
    [points],
  );
  const series = useMemo(() => {
    const selected = CHART_RANGES.find((option) => option.id === range);
    if (!selected?.days || !today) {
      return scored;
    }
    const from = addDaysToKey(today, -(selected.days - 1));
    return scored.filter((point) => point.asOf && point.asOf >= from);
  }, [range, scored, today]);

  const rangePills = (
    <div className="flex flex-wrap gap-2">
      {CHART_RANGES.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => {
            setRange(option.id);
            setHoverIndex(null);
            setSelectedIndex(null);
          }}
          className={rangePillClass(range === option.id)}
          aria-pressed={range === option.id}
        >
          {option.label}
        </button>
      ))}
    </div>
  );

  if (scored.length < 2) {
    return (
      <p className="text-sm text-ink-soft">
        A few more weeks of completed training before Direction can be drawn.
      </p>
    );
  }

  if (series.length < 2) {
    return (
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="text-[13px] font-medium text-ink">Direction</p>
          {rangePills}
        </div>
        <p className="mt-4 text-sm text-ink-soft">
          Not enough Direction in this timeframe. Try a longer range.
        </p>
      </div>
    );
  }

  const total = series.length;
  const todayIndex = Math.max(
    0,
    series.findIndex((point) => point.asOf === today),
  );
  const pinnedIndex = selectedIndex ?? (todayIndex >= 0 ? todayIndex : total - 1);
  const activeIndex = hoverIndex ?? pinnedIndex;
  const active = series[activeIndex] ?? series[total - 1];
  const questions = directionQuestions(active);
  const scale = directionScaleCopy();
  const cursor = xAt(activeIndex, total);
  const todayX = xAt(todayIndex >= 0 ? todayIndex : total - 1, total);
  const buildingY = yAt(DIRECTION_BANDS.buildingMin);
  const decliningY = yAt(DIRECTION_BANDS.decliningMax);
  const xTicks = tickIndexes(total, total > 240 ? 6 : 5);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-ink">
            {active.asOf ? formatDayTitle(active.asOf) : "Direction"}
          </p>
          <p className="mt-1 text-[12px] text-muted">{active.label}</p>
        </div>
        {rangePills}
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="mt-2 block h-52 w-full cursor-crosshair sm:h-56"
        role="img"
        aria-label="Direction over time"
        onMouseMove={(event) => {
          const index = indexFromSvg(event, total);
          if (index != null) {
            setHoverIndex(index);
          }
        }}
        onMouseLeave={() => setHoverIndex(null)}
        onClick={(event) => {
          const index = indexFromSvg(event, total);
          if (index == null) {
            return;
          }
          setSelectedIndex(index);
          const point = series[index];
          if (point?.asOf) {
            setDirectionSelection({
              date: point.asOf,
              label: point.label,
              score: point.score,
              conclusion: point.conclusion,
            });
          }
        }}
      >
        <rect
          x={LEFT}
          y={TOP}
          width={INNER_W}
          height={buildingY - TOP}
          fill="var(--forest)"
          fillOpacity="0.07"
        />
        <rect
          x={LEFT}
          y={buildingY}
          width={INNER_W}
          height={decliningY - buildingY}
          fill="var(--ink)"
          fillOpacity="0.035"
        />
        <rect
          x={LEFT}
          y={decliningY}
          width={INNER_W}
          height={TOP + INNER_H - decliningY}
          fill="var(--ember)"
          fillOpacity="0.07"
        />
        <line
          x1={LEFT}
          x2={LEFT + INNER_W}
          y1={buildingY}
          y2={buildingY}
          stroke="var(--line)"
          strokeWidth="1"
        />
        <line
          x1={LEFT}
          x2={LEFT + INNER_W}
          y1={decliningY}
          y2={decliningY}
          stroke="var(--line)"
          strokeWidth="1"
        />
        <text x={LEFT - 10} y={yAt(60) + 4} textAnchor="end" className="fill-muted text-[11px]">
          Building
        </text>
        <text x={LEFT - 10} y={yAt(0) + 4} textAnchor="end" className="fill-muted text-[11px]">
          Maintaining
        </text>
        <text x={LEFT - 10} y={yAt(-60) + 4} textAnchor="end" className="fill-muted text-[11px]">
          Declining
        </text>
        <line
          x1={todayX}
          x2={todayX}
          y1={TOP}
          y2={TOP + INNER_H}
          stroke="var(--ink)"
          strokeOpacity="0.2"
          strokeDasharray="2 5"
        />
        <line
          x1={cursor}
          x2={cursor}
          y1={TOP}
          y2={TOP + INNER_H}
          stroke="var(--ink)"
          strokeOpacity={activeIndex === todayIndex ? 0 : 0.2}
        />
        <path
          d={pathFor(
            series.map((point) => ({ score: point.score ?? 0 })),
            total,
          )}
          fill="none"
          stroke="var(--ink)"
          strokeWidth="1.7"
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeOpacity={directionConfidenceOpacity(active.confidence)}
        />
        <circle
          cx={todayX}
          cy={yAt(series[todayIndex >= 0 ? todayIndex : total - 1].score ?? 0)}
          r="4"
          fill="var(--paper-raised)"
          stroke="var(--ink)"
          strokeWidth="1.6"
        />
        {activeIndex !== todayIndex ? (
          <circle cx={cursor} cy={yAt(active.score ?? 0)} r="3.25" fill="var(--ink)" />
        ) : null}
        {xTicks.map((index) => {
          const date = series[index]?.asOf;
          if (!date) {
            return null;
          }
          return (
            <text
              key={date}
              x={xAt(index, total)}
              y={HEIGHT - 8}
              textAnchor="middle"
              className="fill-muted text-[11px]"
            >
              {formatDayAxis(date)}
            </text>
          );
        })}
      </svg>
      <div className="mt-3 border border-line bg-paper px-4 py-3">
        <p className="text-sm font-medium text-ink">
          {active.asOf ? formatDayTitle(active.asOf) : "Today"}
        </p>
        <p className="mt-1 text-sm text-ink">{active.label}</p>
        {active.score != null ? (
          <p className="mt-1 text-sm text-ink-soft">
            Direction score <span className="font-medium text-ink">{formatDirectionScore(active.score)}</span>
          </p>
        ) : null}
        <p className="mt-3 text-[12px] leading-5 text-muted">
          {scale.building}
          <br />
          {scale.maintaining}
          <br />
          {scale.declining}
        </p>
        <p className="mt-4 text-[12px] tracking-wide text-muted uppercase">
          {active.windowLabel}
        </p>
        <dl className="mt-2 space-y-1 text-sm">
          {active.signals.map((signal) => (
            <div key={signal.label} className="flex items-baseline justify-between gap-4">
              <dt className="text-ink-soft">{signal.label}</dt>
              <dd className="font-medium text-ink">{signal.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-sm leading-6 text-ink">{active.conclusion}</p>
        <p className="mt-3 text-[12px] text-muted">
          {active.confidenceLabel}
          {active.performanceNote ? ` · ${active.performanceNote}` : null}
        </p>
        {questions.length > 0 && active.asOf ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {questions.map((question) => (
              <button
                key={question}
                type="button"
                className="rounded-full border border-line px-3 py-1.5 text-[13px] text-ink-soft hover:border-ink/40 hover:text-ink"
                onClick={() => {
                  askAboutDirection({
                    date: active.asOf!,
                    message: question,
                    label: active.label,
                    score: active.score,
                    conclusion: active.conclusion,
                  });
                  onAsked?.();
                }}
              >
                {question}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
