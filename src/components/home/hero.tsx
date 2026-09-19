"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import Link from "next/link";
import { useState } from "react";

import { HomePhoto } from "@/components/home/photo";

const HERO_SCORES = [
  { name: "Fitness", value: "42.9" },
  { name: "Fatigue", value: "46.7" },
  { name: "Form", value: "−3.8" },
];

export function HomeHero({ signedIn = false }: { signedIn?: boolean }) {
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
          <Link href={signedIn ? "/app" : "/signup"} className="home-cta">
            {signedIn ? "Open Ahead" : "Coming soon"}
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
        <div className="relative aspect-[16/10] overflow-hidden">
          <HomePhoto
            src="/home/session-hero.jpg"
            alt="A runner checking her watch mid-session in the rain"
            preload
            objectPosition="center top"
          />
          <div className="absolute inset-0 bg-gradient-to-l from-black/50 via-black/15 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10" />

          <div className="relative z-10 flex h-full flex-col items-end justify-center p-5 text-right sm:p-7 lg:p-8">
            <p className="home-mono text-[10px] tracking-[0.16em] text-white/70 uppercase">
              Direction
            </p>
            <p className="home-mono mt-1 text-[clamp(2.4rem,4.6vw,3.6rem)] leading-none tracking-[-0.06em] text-white [text-shadow:0_1px_18px_rgba(0,0,0,0.45)]">
              Building
            </p>
            <p className="home-mono mt-6 text-[10px] tracking-[0.16em] text-white/70 uppercase">
              Readiness
            </p>
            <p className="home-mono mt-1 text-[clamp(3.6rem,6vw,5.4rem)] leading-none tracking-[-0.08em] text-white [text-shadow:0_1px_18px_rgba(0,0,0,0.45)]">
              49
            </p>
            <div className="mt-2 flex items-center justify-end gap-3">
              <p className="home-mono text-[14px] text-[var(--home-cta)]">
                ↓ 8
              </p>
              <ReadinessSpark />
            </div>
            <p className="home-mono mt-3 text-[10px] tracking-[0.12em] text-white/70 uppercase">
              since Monday
            </p>
            <dl className="mt-6 w-[9.5rem] space-y-2.5">
              {HERO_SCORES.map((score) => (
                <div
                  key={score.name}
                  className="flex items-baseline justify-between gap-4"
                >
                  <dt className="home-mono text-[9px] tracking-[0.14em] text-white/55 uppercase">
                    {score.name}
                  </dt>
                  <dd className="home-mono text-[1.15rem] leading-none tracking-[-0.04em] text-white [text-shadow:0_1px_12px_rgba(0,0,0,0.45)]">
                    {score.value}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-5 max-w-[17rem] text-[13px] leading-5 text-white/80 [text-shadow:0_1px_10px_rgba(0,0,0,0.55)]">
              Moderate confidence · Performance evidence still limited
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
              <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
                <div>
                  <p className="home-mono text-[9px] tracking-[0.14em] text-black/40 uppercase">
                    Before
                  </p>
                  <HeroPlan
                    day="Thu 24"
                    title="Intervals · 5×5"
                    struck={!applied}
                  />
                  <HeroPlan
                    day="Fri 25"
                    title="Threshold · 40m"
                    struck={!applied}
                  />
                </div>
                <p
                  className="self-center pt-4 text-[18px] text-black/25"
                  aria-hidden
                >
                  →
                </p>
                <div>
                  <p className="home-mono text-[9px] tracking-[0.14em] text-[var(--home-cta)] uppercase">
                    {applied ? "Applied" : "Ahead proposes"}
                  </p>
                  <HeroPlan day="Thu 24" title="Recovery · 40m" proposed />
                  <HeroPlan day="Fri 25" title="Easy · 40m" proposed />
                </div>
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

function HeroPlan({
  day,
  title,
  proposed,
  struck,
}: {
  day: string;
  title: string;
  proposed?: boolean;
  struck?: boolean;
}) {
  return (
    <div
      className={`mt-2 px-2.5 py-2.5 ${
        proposed
          ? "bg-[var(--home-accent-dim)] shadow-[inset_3px_0_0_var(--home-cta)]"
          : "bg-black/[0.04]"
      }`}
    >
      <p className="home-mono text-[8px] tracking-[0.12em] text-black/45 uppercase">
        {day}
      </p>
      <p
        className={`mt-1 text-[13px] leading-5 ${
          struck
            ? "text-black/35 line-through"
            : proposed
              ? "font-medium text-[#04140a]"
              : "text-black/55"
        }`}
      >
        {title}
      </p>
    </div>
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
