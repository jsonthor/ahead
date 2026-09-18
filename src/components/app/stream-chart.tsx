"use client";

import { useId, useMemo, useState } from "react";

type Point = { t: number; y: number };

function ticks(min: number, max: number, count = 4) {
  if (min === max) {
    return [min];
  }
  const span = max - min;
  return Array.from({ length: count }, (_, index) => min + (span * index) / (count - 1));
}

export function StreamChart({
  title,
  points,
  color,
  formatY,
  invert = false,
  unitLabel,
}: {
  title: string;
  points: Point[];
  color: string;
  formatY: (value: number) => string;
  invert?: boolean;
  unitLabel?: string;
}) {
  const gradientId = useId();
  const [active, setActive] = useState<Point | null>(null);

  const layout = useMemo(() => {
    const width = 640;
    const height = 168;
    const pad = { top: 16, right: 16, bottom: 28, left: 52 };
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;
    const tMin = points[0]?.t ?? 0;
    const tMax = points[points.length - 1]?.t ?? 1;
    const ys = points.map((point) => point.y);
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);
    const span = yMax - yMin || 1;
    const xAt = (t: number) =>
      pad.left + ((t - tMin) / Math.max(1, tMax - tMin)) * innerW;
    const yAt = (y: number) =>
      invert
        ? pad.top + ((y - yMin) / span) * innerH
        : pad.top + ((yMax - y) / span) * innerH;
    const line = points
      .map((point, index) => `${index === 0 ? "M" : "L"}${xAt(point.t)} ${yAt(point.y)}`)
      .join(" ");
    const area = `${line} L${xAt(tMax)} ${pad.top + innerH} L${xAt(tMin)} ${pad.top + innerH} Z`;
    return {
      width,
      height,
      pad,
      innerW,
      innerH,
      tMin,
      tMax,
      yMin,
      yMax,
      xAt,
      yAt,
      line,
      area,
      xTicks: ticks(tMin, tMax, 5),
      yTicks: ticks(yMin, yMax, 4),
    };
  }, [invert, points]);

  if (points.length < 2) {
    return null;
  }

  const shown = active ?? points[Math.floor(points.length / 2)] ?? points[0];

  return (
    <figure className="rounded-md border border-line bg-paper-raised p-4">
      <div className="flex items-baseline justify-between gap-3">
        <figcaption className="text-[13px] font-medium tracking-[0.14em] text-muted uppercase">
          {title}
        </figcaption>
        <p className="font-mono text-[13px] text-ink">
          {formatY(shown.y)}
          {unitLabel ? <span className="ml-1 text-muted">{unitLabel}</span> : null}
        </p>
      </div>
      <svg
        role="img"
        aria-label={`${title} over time`}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="mt-3 h-auto w-full"
        onPointerLeave={() => setActive(null)}
        onPointerMove={(event) => {
          const svg = event.currentTarget;
          const rect = svg.getBoundingClientRect();
          const x = ((event.clientX - rect.left) / rect.width) * layout.width;
          let nearest = points[0];
          let best = Infinity;
          for (const point of points) {
            const dx = Math.abs(layout.xAt(point.t) - x);
            if (dx < best) {
              best = dx;
              nearest = point;
            }
          }
          setActive(nearest ?? null);
        }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {layout.yTicks.map((tick) => (
          <g key={`y-${tick}`}>
            <line
              x1={layout.pad.left}
              x2={layout.width - layout.pad.right}
              y1={layout.yAt(tick)}
              y2={layout.yAt(tick)}
              stroke="currentColor"
              className="text-line"
              strokeWidth="1"
            />
            <text
              x={layout.pad.left - 8}
              y={layout.yAt(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-muted"
              fontSize="10"
            >
              {formatY(tick)}
            </text>
          </g>
        ))}
        {layout.xTicks.map((tick) => (
          <text
            key={`x-${tick}`}
            x={layout.xAt(tick)}
            y={layout.height - 8}
            textAnchor="middle"
            className="fill-muted"
            fontSize="10"
          >
            {formatClock(tick)}
          </text>
        ))}
        <path d={layout.area} fill={`url(#${gradientId})`} />
        <path d={layout.line} fill="none" stroke={color} strokeWidth="1.75" />
        {active ? (
          <>
            <line
              x1={layout.xAt(active.t)}
              x2={layout.xAt(active.t)}
              y1={layout.pad.top}
              y2={layout.pad.top + layout.innerH}
              stroke={color}
              strokeOpacity="0.45"
              strokeWidth="1"
            />
            <circle
              cx={layout.xAt(active.t)}
              cy={layout.yAt(active.y)}
              r="3.5"
              fill={color}
            />
          </>
        ) : null}
      </svg>
      <p className="sr-only">
        {title} ranged from {formatY(layout.yMin)} to {formatY(layout.yMax)}.
      </p>
    </figure>
  );
}

function formatClock(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) {
    return `${hours}h${minutes ? ` ${minutes}m` : ""}`;
  }
  return `${minutes}m`;
}
