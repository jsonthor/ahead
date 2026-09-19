"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useState } from "react";

import { HomePhoto } from "@/components/home/photo";

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
          <div className="grid lg:grid-cols-[0.72fr_1.28fr]">
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
                    <span className="home-mono text-[9px] tracking-[0.14em] text-[var(--home-cta)] uppercase">
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
