import type { CSSProperties } from "react";

export function HomeRing({
  value,
  display,
  max = 100,
  label,
  hint,
  size = 280,
  color = "var(--home-accent)",
  delay = "0s",
}: {
  value: number;
  display: string;
  max?: number;
  label: string;
  hint?: string;
  size?: number;
  color?: string;
  delay?: string;
}) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(Math.max(value, 0), max);
  const offset = c - (clamped / max) * c;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
    >
      <div
        className="pointer-events-none absolute inset-[12%] rounded-full bg-[var(--home-accent)] opacity-[0.14] blur-3xl"
        aria-hidden
      />
      <svg viewBox="0 0 100 100" className="relative h-full w-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="6.5"
        />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="6.5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="home-ring-arc"
          style={
            {
              "--ring-c": c,
              "--ring-offset": offset,
              animationDelay: delay,
            } as CSSProperties
          }
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <p className="home-mono text-[10px] tracking-[0.22em] text-[var(--home-text-3)] uppercase">
          {label}
        </p>
        <p className="home-mono mt-1 text-[2.8rem] leading-none tracking-tight text-[var(--home-text)] sm:text-[3.25rem]">
          {display}
        </p>
        {hint ? (
          <p className="mt-2 max-w-[9rem] text-[11px] leading-4 text-[var(--home-text-3)]">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}
