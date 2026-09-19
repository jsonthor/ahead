"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useState } from "react";

import { HomePhoto } from "@/components/home/photo";

const days = [
  {
    name: "Mon",
    date: "21",
    title: "Easy aerobic",
    meta: "50m",
    load: "41",
    kind: "done" as const,
  },
  {
    name: "Tue",
    date: "22",
    title: "CX specific",
    meta: "60m",
    load: "72",
    kind: "proposed" as const,
  },
  {
    name: "Wed",
    date: "23",
    title: "Club session",
    meta: "55m",
    load: "86",
    kind: "done" as const,
  },
  {
    name: "Thu",
    date: "24",
    title: "Easy endurance",
    meta: "75m",
    load: "54",
    kind: "proposed" as const,
  },
  {
    name: "Fri",
    date: "25",
    title: "Rest",
    meta: "—",
    load: "—",
    kind: "rest" as const,
  },
  {
    name: "Sat",
    date: "26",
    title: "Race openers",
    meta: "35m",
    load: "31",
    kind: "proposed" as const,
  },
  {
    name: "Sun",
    date: "27",
    title: "CX race",
    meta: "50m",
    load: "90",
    kind: "race" as const,
  },
];

const changes = [
  { day: "Thu", change: "Intervals removed" },
  { day: "Thu", change: "Recovery · 40m" },
  { day: "Fri", change: "Easy · 40m" },
];

export function HomeApplyDemo() {
  const [applied, setApplied] = useState(false);

  return (
    <section id="how-it-works" className="scroll-mt-24">
      <div className="relative min-h-[58vh] overflow-hidden lg:min-h-[68vh]">
        <HomePhoto
          src="/home/adapt.jpg"
          alt="An athlete pinning a race number onto a jersey"
          objectPosition="center 35%"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent" />
      </div>
      <div className="px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
      <div className="mx-auto max-w-[1470px]">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:gap-20">
          <div>
            <p className="home-kicker">One system, not another dashboard</p>
            <h2 className="home-display mt-8 text-[clamp(3.2rem,6.8vw,7rem)]">
              Ask. Review.
              <span className="block">Apply.</span>
            </h2>
          </div>
          <p className="max-w-lg text-[18px] leading-[1.55] text-[var(--home-text-2)]">
            Ahead understands the work you have already done, what’s coming
            next, and the constraints that make a perfect plan impossible.
          </p>
        </div>

        <div className="mt-20 border-y border-[var(--home-border)] bg-[#0c0c0c]">
          <div className="flex flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="home-mono text-[10px] tracking-[0.14em] text-[var(--home-text-3)] uppercase">
              21–27 Sep
            </p>
            <dl className="flex flex-wrap gap-x-7 gap-y-2">
              {[
                ["49", "readiness"],
                ["42.9", "fitness"],
                ["46.7", "fatigue"],
                ["−3.8", "form"],
              ].map(([value, label]) => (
                <div key={label} className="flex items-baseline gap-2">
                  <dt className="sr-only">{label}</dt>
                  <dd className="text-[16px] tracking-tight text-[var(--home-text)]">
                    {value}
                  </dd>
                  <span className="home-mono text-[10px] tracking-[0.12em] text-[var(--home-text-3)] uppercase">
                    {label}
                  </span>
                </div>
              ))}
            </dl>
          </div>

          <div className="overflow-x-auto">
            <div className="grid min-w-[64rem] grid-cols-7 border-t border-[var(--home-border)]">
              {days.map((day) => (
                <article
                  key={day.date}
                  className="min-h-[18rem] border-r border-[var(--home-border)] last:border-r-0"
                >
                  <header className="flex items-start justify-between border-b border-[var(--home-border)] px-4 py-4">
                    <span className="home-mono text-[9px] tracking-[0.14em] text-[var(--home-text-3)] uppercase">
                      {day.name}
                    </span>
                    <span className="text-[1.4rem] tracking-[-0.04em] text-[var(--home-text)]">
                      {day.date}
                    </span>
                  </header>
                  <div
                    className={`mx-2.5 mt-3 flex min-h-[9rem] flex-col px-3 py-3 ${
                      day.kind === "proposed"
                        ? "bg-[var(--home-accent-dim)]"
                        : day.kind === "race"
                          ? "bg-[rgba(212,165,116,0.08)]"
                          : day.kind === "rest"
                            ? "opacity-40"
                            : "bg-white/[0.025]"
                    }`}
                  >
                    <p className="home-mono min-h-4 text-[8px] tracking-[0.14em] text-[var(--home-accent)] uppercase">
                      {day.kind === "proposed"
                        ? "Proposed"
                        : day.kind === "race"
                          ? "Race"
                          : ""}
                    </p>
                    <p className="mt-2 text-[14px] leading-snug font-medium text-[var(--home-text)]">
                      {day.title}
                    </p>
                    <p className="mt-1 text-[10px] text-[var(--home-text-3)]">
                      {day.meta}
                    </p>
                    <p className="home-mono mt-auto pt-6 text-[9px] tracking-[0.12em] text-[var(--home-text-3)] uppercase">
                      Load {day.load}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="grid border-t border-[var(--home-border)] lg:grid-cols-[0.72fr_1.28fr]">
            <div className="border-b border-[var(--home-border)] px-5 py-8 sm:px-6 lg:border-r lg:border-b-0">
              <p className="home-kicker">You</p>
              <p className="mt-10 max-w-sm text-[clamp(1.6rem,2.4vw,2.4rem)] leading-[1.08] tracking-[-0.04em] text-[var(--home-text)]">
                I’m shattered, can’t train Thursday, and race Sunday. Fix the
                week.
              </p>
            </div>
            <div className="px-5 py-8 sm:px-6">
              <p className="home-kicker">Ahead</p>
              <p className="mt-10 max-w-2xl text-[18px] leading-[1.52] text-[var(--home-text-2)]">
                Wednesday already landed hard. I’d remove Thursday intensity
                rather than squeeze it into Friday.
              </p>
              <ul className="mt-8 border-t border-[var(--home-border)]">
                {changes.map((row) => (
                  <li
                    key={`${row.day}-${row.change}`}
                    className="grid grid-cols-[4rem_1fr] items-center border-b border-[var(--home-border)] py-3.5 text-[13px]"
                  >
                    <span className="home-mono text-[9px] tracking-[0.14em] text-[var(--home-accent)] uppercase">
                      {row.day}
                    </span>
                    <span className="text-[var(--home-text)]">
                      {applied && row.change.includes("Recovery")
                        ? "On the calendar · Recovery · 40m"
                        : row.change}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex flex-wrap items-center gap-4">
                {applied ? (
                  <button
                    type="button"
                    onClick={() => setApplied(false)}
                    className="text-[13px] text-[var(--home-text-2)] hover:text-[var(--home-text)]"
                  >
                    Undo
                  </button>
                ) : (
                  <AlertDialog.Root>
                    <AlertDialog.Trigger asChild>
                      <button type="button" className="home-cta home-cta-sm">
                        Apply
                      </button>
                    </AlertDialog.Trigger>
                    <AlertDialog.Portal>
                      <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/70" />
                      <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 flex w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col bg-[var(--home-surface-2)] p-6">
                        <AlertDialog.Title className="text-xl tracking-tight text-[var(--home-text)]">
                          Apply these changes?
                        </AlertDialog.Title>
                        <AlertDialog.Description className="mt-3 text-[15px] leading-7 text-[var(--home-text-2)]">
                          Thursday intervals will be removed. Recovery 40
                          minutes will be added. Nothing else on the week
                          changes.
                        </AlertDialog.Description>
                        <div className="mt-6 flex justify-end gap-4">
                          <AlertDialog.Cancel asChild>
                            <button
                              type="button"
                              className="inline-flex h-9 items-center text-sm text-[var(--home-text-2)] hover:text-[var(--home-text)]"
                            >
                              Cancel
                            </button>
                          </AlertDialog.Cancel>
                          <AlertDialog.Action asChild>
                            <button
                              type="button"
                              onClick={() => setApplied(true)}
                              className="home-cta home-cta-sm"
                            >
                              Apply
                            </button>
                          </AlertDialog.Action>
                        </div>
                      </AlertDialog.Content>
                    </AlertDialog.Portal>
                  </AlertDialog.Root>
                )}
                {!applied ? (
                  <span className="text-[13px] text-[var(--home-text-3)]">
                    Dismiss
                  </span>
                ) : null}
                <p className="w-full text-[12px] text-[var(--home-text-3)] sm:ml-auto sm:w-auto">
                  Nothing changes until you confirm it.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </section>
  );
}
