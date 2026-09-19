"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import Link from "next/link";
import { useState } from "react";

import { HomePhoto } from "@/components/home/photo";

export function HomeHero() {
  const [applied, setApplied] = useState(false);

  return (
    <section className="mx-auto grid max-w-[1540px] lg:min-h-[calc(100svh-4.75rem)] lg:grid-cols-[minmax(22rem,0.88fr)_minmax(0,1.12fr)]">
      <div className="flex flex-col justify-center px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <p className="home-kicker">For self-coached endurance athletes</p>
        <h1 className="home-display mt-8 max-w-[11ch] text-[clamp(3.2rem,6.4vw,6.6rem)] text-[var(--home-text)]">
          Know if the work is working.
        </h1>
        <p className="mt-8 max-w-md text-[18px] leading-[1.5] tracking-[-0.018em] text-[var(--home-text-2)]">
          Ahead connects your training, recovery and races so you can see
          what’s changing — and decide what to do next.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3">
          <Link href="/signup" className="home-cta">
            Coming soon
          </Link>
          <a
            href="#product"
            className="inline-flex h-11 items-center text-[14px] text-[var(--home-text-3)] transition-colors hover:text-[var(--home-text)]"
          >
            See how it works
          </a>
        </div>
      </div>

      <div className="flex min-h-0 flex-col">
        <div className="relative min-h-[20rem] overflow-hidden lg:min-h-0 lg:flex-1">
          <HomePhoto
            src="/home/session.jpg"
            alt="A runner checking her watch mid-session in the rain"
            preload
            objectPosition="72% 28%"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/25 to-black/10" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20" />

          <div className="relative z-10 p-5 sm:p-7 lg:p-8">
            <p className="home-mono text-[10px] tracking-[0.16em] text-white/70 uppercase">
              Readiness
            </p>
            <div className="mt-1 flex items-end gap-4">
              <p className="home-mono text-[clamp(3.6rem,6vw,5.4rem)] leading-none tracking-[-0.08em] text-white [text-shadow:0_1px_18px_rgba(0,0,0,0.45)]">
                49
              </p>
              <p className="home-mono mb-1.5 text-[14px] text-[var(--home-cta)]">
                ↓ 8
              </p>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
              <ReadinessSpark />
              <p className="home-mono text-[10px] tracking-[0.12em] text-white/70 uppercase">
                since Monday
              </p>
            </div>
            <p className="mt-3 max-w-[20rem] text-[13px] leading-5 text-white/80 [text-shadow:0_1px_10px_rgba(0,0,0,0.55)]">
              Recent load is suppressing more of your capacity.
            </p>
          </div>
        </div>

        <aside className="bg-[#f1efe7] px-5 py-6 text-[#0a0b0a] sm:px-7 sm:py-7 lg:px-8 lg:py-8">
          <p className="home-mono text-[9px] font-bold tracking-[0.16em] uppercase">
            Ask Ahead
          </p>

          <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(16rem,0.95fr)] lg:gap-10">
            <div>
              <p className="text-[1.25rem] leading-[1.25] tracking-[-0.03em]">
                I’m shattered, I can’t train Thursday, and I race Sunday. What
                should I do?
              </p>
              <div className="mt-5 h-px w-10 bg-[#0a0b0a]" />
              <p className="mt-4 text-[14px] leading-6 text-black/58">
                Wednesday already landed hard. I’d drop Thursday’s intervals
                rather than move them to Friday.
              </p>
            </div>

            <div>
              <div className="grid grid-cols-[4.2rem_1fr_1fr] items-end gap-x-3 gap-y-2">
                <span />
                <p className="home-mono text-[9px] tracking-[0.14em] text-black/40 uppercase">
                  Before
                </p>
                <p className="home-mono text-[9px] tracking-[0.14em] text-black/40 uppercase">
                  {applied ? "Applied" : "Proposed"}
                </p>

                <p className="home-mono text-[9px] tracking-[0.1em] text-black/45 uppercase">
                  Thu 24
                </p>
                <p
                  className={`text-[13px] leading-5 ${applied ? "text-black/45" : "text-black/40 line-through"}`}
                >
                  Intervals · 5×5
                </p>
                <p className="bg-[var(--home-accent-dim)] px-2 py-1.5 text-[13px] leading-5 shadow-[inset_2px_0_0_var(--home-cta)]">
                  Recovery · 40m
                </p>

                <p className="home-mono text-[9px] tracking-[0.1em] text-black/45 uppercase">
                  Fri 25
                </p>
                <p className="text-[13px] leading-5 text-black/55">
                  Threshold · 40m
                </p>
                <p className="bg-[var(--home-accent-dim)] px-2 py-1.5 text-[13px] leading-5 shadow-[inset_2px_0_0_var(--home-cta)]">
                  Easy · 40m
                </p>
              </div>

              <div className="mt-5">
                {applied ? (
                  <button
                    type="button"
                    onClick={() => setApplied(false)}
                    className="inline-flex h-11 items-center text-[13px] text-black/50 hover:text-black"
                  >
                    Undo
                  </button>
                ) : (
                  <AlertDialog.Root>
                    <AlertDialog.Trigger asChild>
                      <button type="button" className="home-cta home-cta-sm">
                        Apply changes
                      </button>
                    </AlertDialog.Trigger>
                    <AlertDialog.Portal>
                      <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/70" />
                      <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 flex w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col bg-[var(--home-surface-2)] p-6">
                        <AlertDialog.Title className="text-xl tracking-tight text-[var(--home-text)]">
                          Apply these changes?
                        </AlertDialog.Title>
                        <AlertDialog.Description className="mt-3 text-[15px] leading-7 text-[var(--home-text-2)]">
                          Thursday intervals will be removed. Recovery and an
                          easy Friday go on the calendar. Nothing else changes.
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
                              Apply changes
                            </button>
                          </AlertDialog.Action>
                        </div>
                      </AlertDialog.Content>
                    </AlertDialog.Portal>
                  </AlertDialog.Root>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function ReadinessSpark() {
  return (
    <svg
      viewBox="0 0 132 28"
      className="h-6 w-32"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M1 8 C18 7 28 9 40 8 C52 7 58 10 68 8 C78 6 84 18 96 20 C108 22 118 19 131 21"
        stroke="rgba(255,255,255,0.7)"
        strokeWidth="1.75"
      />
      <circle cx="131" cy="21" r="2.4" fill="#00e05a" />
    </svg>
  );
}
