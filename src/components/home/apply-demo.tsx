"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useState } from "react";

const review = [
  { day: "Thu", change: "Intervals removed · Recovery 40m added" },
  { day: "Fri", change: "Threshold kept off. Easy 40m remains." },
];

export function HomeAsk() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-24 border-y border-[var(--home-border)] bg-[var(--home-bg-2)] px-4 py-24 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-[1360px]">
        <p className="home-mono text-[11px] tracking-[0.18em] text-[var(--home-text-3)] uppercase">
          Plain English
        </p>
        <h2 className="mt-4 text-4xl leading-[0.94] font-medium tracking-[-0.045em] text-[var(--home-text)] sm:text-6xl">
          Ask Ahead.
        </h2>
        <p className="mt-7 max-w-xl text-[17px] leading-7 text-[var(--home-text-2)] sm:text-[18px] sm:leading-8">
          You don’t need to learn another dashboard before you can understand
          your training. Ask in plain English.
        </p>
        <p className="mt-8 max-w-xl border-l-2 border-[var(--home-accent)] pl-4 text-[1.2rem] leading-snug tracking-tight text-[var(--home-text)]">
          I’ve got three races in the next 14 days. What should I do between
          them?
        </p>
        <p className="mt-6 max-w-xl text-[17px] leading-7 text-[var(--home-text-2)] sm:text-[18px] sm:leading-8">
          Ahead looks at the training you’ve already done, your current load,
          recovery and what’s coming next. It can recommend and prepare changes
          to your calendar. You review them first.
        </p>
        <p className="mt-6 max-w-xl text-[17px] font-medium leading-7 text-[var(--home-text)] sm:text-[18px] sm:leading-8">
          Nothing changes until you say so.
        </p>
      </div>
    </section>
  );
}

export function HomeApplyDemo() {
  const [applied, setApplied] = useState(false);

  return (
    <section className="scroll-mt-24 border-y border-[var(--home-border)] bg-[var(--home-bg-2)] px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1360px]">
        <p className="home-mono text-[11px] tracking-[0.18em] text-[var(--home-text-3)] uppercase">
          Real life
        </p>
        <h2 className="mt-4 text-4xl leading-[0.94] font-medium tracking-[-0.045em] text-[var(--home-text)] sm:text-6xl">
          Your plan should survive real life.
        </h2>
        <p className="mt-7 max-w-xl text-[17px] leading-7 text-[var(--home-text-2)] sm:text-[18px] sm:leading-8">
          A training plan can look perfect on Monday. Then work runs late. You
          sleep badly. Wednesday’s club session turns into a race. A new event
          gets added. Your legs simply aren’t there.
        </p>
        <p className="mt-4 max-w-xl text-[17px] leading-7 text-[var(--home-text-2)] sm:text-[18px] sm:leading-8">
          Ahead works with what actually happened — not just what was supposed
          to happen. It can adjust what comes next without pretending the missed
          or harder session never happened.
        </p>

        <ol className="mt-12 grid gap-px overflow-hidden border border-[var(--home-border)] bg-[var(--home-border)] lg:grid-cols-3">
          <li className="bg-[var(--home-surface)] p-6 sm:p-8">
            <p className="home-mono text-[12px] tracking-[0.16em] text-[var(--home-accent)]">
              01 — Ask
            </p>
            <p className="mt-8 border-l-2 border-[var(--home-accent)] pl-4 text-[1.2rem] leading-snug tracking-tight text-[var(--home-text)]">
              I’m shattered, can’t train Thursday and race Sunday. Fix the
              week.
            </p>
          </li>
          <li className="bg-[var(--home-surface)] p-6 sm:p-8">
            <p className="home-mono text-[12px] tracking-[0.16em] text-[var(--home-accent)]">
              02 — Review
            </p>
            <p className="mt-6 text-[15px] leading-7 text-[var(--home-text-2)]">
              Club Wednesday already landed hard. Thursday intervals would be
              the third quality session before Sunday.
            </p>
            <ul className="mt-5 space-y-3">
              {review.map((row) => (
                <li
                  key={row.day}
                  className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3"
                >
                  <p className="home-mono text-[12px] text-[var(--home-accent)]">
                    {row.day}
                  </p>
                  <p className="text-[14px] text-[var(--home-text)]">
                    {row.change}
                  </p>
                </li>
              ))}
            </ul>
          </li>
          <li className="bg-[var(--home-surface)] p-6 sm:p-8">
            <p className="home-mono text-[12px] tracking-[0.16em] text-[var(--home-accent)]">
              03 — Apply
            </p>
            <p className="mt-6 text-[15px] leading-7 text-[var(--home-text-2)]">
              Only confirmed changes become part of the calendar.
            </p>

            <div
              className={`mt-6 border px-3 py-3 ${
                applied
                  ? "border-[var(--home-accent-line)] bg-[var(--home-accent-dim)]"
                  : "border-dashed border-[var(--home-accent-line)]"
              }`}
            >
              <p className="home-mono text-[10px] tracking-[0.14em] text-[var(--home-accent)] uppercase">
                {applied ? "On the calendar" : "Proposed"}
              </p>
              <p className="mt-1 text-[14px] text-[var(--home-text)]">
                Thu · Recovery 40 min
              </p>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              {applied ? (
                <button
                  type="button"
                  onClick={() => setApplied(false)}
                  className="inline-flex h-9 items-center px-1 text-sm text-[var(--home-text-2)] underline-offset-4 hover:text-[var(--home-text)] hover:underline"
                >
                  Undo
                </button>
              ) : (
                <AlertDialog.Root>
                  <AlertDialog.Trigger asChild>
                    <button
                      type="button"
                      className="home-cta home-cta-sm"
                    >
                      Apply changes
                    </button>
                  </AlertDialog.Trigger>
                  <AlertDialog.Portal>
                    <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/70" />
                    <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 flex w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col border border-[var(--home-border)] bg-[var(--home-surface-2)] p-6">
                      <AlertDialog.Title className="text-xl tracking-tight text-[var(--home-text)]">
                        Apply these changes?
                      </AlertDialog.Title>
                      <AlertDialog.Description className="mt-3 text-[15px] leading-7 text-[var(--home-text-2)]">
                        Thursday intervals will be removed. Recovery 40 minutes
                        will be added. Nothing else on the week changes.
                      </AlertDialog.Description>
                      <div className="mt-6 flex justify-end gap-3">
                        <AlertDialog.Cancel asChild>
                          <button
                            type="button"
                            className="inline-flex h-9 items-center px-3 text-sm text-[var(--home-text-2)] hover:text-[var(--home-text)]"
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
            </div>
          </li>
        </ol>
      </div>
    </section>
  );
}
