"use client";

import * as HoverCard from "@radix-ui/react-hover-card";
import Link from "next/link";

type SessionState = "done" | "planned" | "race" | "proposed" | "rest";

type Session = {
  sport: string;
  title: string;
  duration: string;
  state: SessionState;
};

type Day = {
  name: string;
  date: string;
  load: number;
  kind: "done" | "proposed" | "race" | "rest";
  sessions: Session[];
};

const days: Day[] = [
  {
    name: "Mon",
    date: "21",
    load: 41,
    kind: "done",
    sessions: [
      { sport: "Run", title: "Easy aerobic", duration: "50m", state: "done" },
    ],
  },
  {
    name: "Tue",
    date: "22",
    load: 72,
    kind: "proposed",
    sessions: [
      {
        sport: "Ride",
        title: "CX specific",
        duration: "60m",
        state: "proposed",
      },
    ],
  },
  {
    name: "Wed",
    date: "23",
    load: 86,
    kind: "done",
    sessions: [
      { sport: "Run", title: "Shakeout", duration: "32m", state: "done" },
      { sport: "Run", title: "Club session", duration: "55m", state: "planned" },
    ],
  },
  {
    name: "Thu",
    date: "24",
    load: 54,
    kind: "proposed",
    sessions: [
      {
        sport: "Ride",
        title: "Easy endurance",
        duration: "75m",
        state: "proposed",
      },
    ],
  },
  {
    name: "Fri",
    date: "25",
    load: 8,
    kind: "rest",
    sessions: [{ sport: "Rest", title: "Rest", duration: "—", state: "rest" }],
  },
  {
    name: "Sat",
    date: "26",
    load: 31,
    kind: "proposed",
    sessions: [
      { sport: "Run", title: "Race openers", duration: "35m", state: "proposed" },
    ],
  },
  {
    name: "Sun",
    date: "27",
    load: 90,
    kind: "race",
    sessions: [
      { sport: "Race", title: "CX race", duration: "50m", state: "race" },
    ],
  },
];

const overlayMetrics = [
  { k: "Readiness", v: "49" },
  { k: "Fitness", v: "42.9" },
  { k: "Fatigue", v: "46.7" },
  { k: "Form", v: "−3.8" },
];

function sportColor(sport: string) {
  if (sport === "Ride") return "text-[var(--home-ride)]";
  if (sport === "Race") return "text-[var(--home-race)]";
  if (sport === "Rest") return "text-[var(--home-text-3)]";
  return "text-[var(--home-run)]";
}

export function HomeHero() {
  return (
    <section className="home-glow relative overflow-hidden">
      <div className="relative z-10 mx-auto max-w-[1360px] px-4 pt-8 pb-14 sm:px-6 lg:px-8 lg:pt-10 lg:pb-16">
        <div className="max-w-[38rem]">
          <p className="home-mono text-[11px] tracking-[0.24em] text-[var(--home-accent)] uppercase">
            For self-coached endurance athletes
          </p>
          <h1 className="mt-4 text-[2.45rem] leading-[0.94] font-medium tracking-[-0.055em] text-[var(--home-text)] sm:text-5xl lg:text-[3.6rem]">
            <span className="block">Know if your</span>
            <span className="block">training is working.</span>
          </h1>
          <p className="mt-4 max-w-[30rem] text-[16px] leading-7 text-[var(--home-text-2)]">
            Ahead connects your training, recovery and races to show what’s
            changing — and help you decide what to do next.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Link href="/signup" className="home-cta">
              Coming soon
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex h-12 items-center text-[16px] text-[var(--home-text-2)] transition-colors hover:text-[var(--home-text)]"
            >
              See how it works
            </a>
          </div>
        </div>

        <div
          id="product"
          className="relative mt-8 min-h-[22rem] scroll-mt-24 overflow-hidden border border-[var(--home-border)] bg-[var(--home-surface)] md:min-h-[38rem] lg:mt-10"
        >
          <div className="pointer-events-none absolute inset-x-3 top-3 z-20">
            <div className="border border-[var(--home-border)] bg-[#0b0b0b]/88 px-3 py-2.5 backdrop-blur-md">
              <p className="home-mono text-[11px] text-[var(--home-text-3)]">
                Week 39 · 21–27 Sep
              </p>
              <dl className="mt-2 grid grid-cols-4 gap-2">
                {overlayMetrics.map((metric) => (
                  <div key={metric.k}>
                    <dt className="home-mono text-[9px] tracking-[0.14em] text-[var(--home-text-3)] uppercase">
                      {metric.k}
                    </dt>
                    <dd className="home-mono mt-0.5 text-[15px] tracking-tight text-[var(--home-text)]">
                      {metric.v}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          <div className="min-w-0 overflow-x-auto px-3 pb-5 pt-[5.75rem] md:pb-6">
            <div className="grid min-w-[48rem] grid-cols-7 gap-2">
              {days.map((day) => (
                <div key={day.date} className="flex flex-col">
                  <div className="border-b border-[var(--home-border)] pb-2">
                    <p className="home-mono text-[10px] tracking-[0.12em] text-[var(--home-text-3)] uppercase">
                      {day.name} {day.date}
                    </p>
                    <p className="home-mono mt-0.5 text-[12px] text-[var(--home-text)]">
                      {day.kind === "rest" ? "—" : day.load}
                    </p>
                  </div>
                  <div className="mt-2 flex flex-col gap-1.5">
                    {day.sessions.map((session) => (
                      <SessionChip
                        key={`${day.date}-${session.title}`}
                        session={session}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <aside className="relative z-20 border-t border-[var(--home-border)] bg-[#0c0c0c] md:absolute md:right-3 md:bottom-3 md:flex md:max-h-[22rem] md:w-[22rem] md:flex-col md:border md:border-[var(--home-border)] md:shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
            <div className="flex items-center justify-between border-b border-[var(--home-border)] px-3 py-2.5">
              <p className="text-[13px] font-medium text-[var(--home-text)]">
                Ask Ahead
              </p>
              <span className="home-mono text-[10px] tracking-[0.14em] text-[var(--home-accent)] uppercase">
                Live
              </span>
            </div>
            <div className="flex min-h-0 flex-col gap-2.5 overflow-y-auto p-3">
              <p className="home-rise home-rise-1 ml-auto max-w-[92%] bg-[#f5f5f3] px-3 py-2 text-[13px] leading-5 text-[#111]">
                I’ve got three races in the next 14 days. What should I do
                between them?
              </p>
              <div className="home-rise home-rise-2 max-w-[94%] border-l-2 border-[var(--home-accent)] bg-[var(--home-surface-2)] px-3 py-2 text-[13px] leading-5 text-[var(--home-text-2)]">
                You’ve already done enough race-specific work this week. Keep
                one quality session, retain the easy volume and put a short
                opener before the A race.
              </div>
              <div className="home-rise home-rise-3 border border-[var(--home-border)] bg-[var(--home-surface-2)] p-2.5">
                <p className="home-mono text-[10px] tracking-[0.16em] text-[var(--home-accent)] uppercase">
                  Proposed changes
                </p>
                <ul className="mt-2 grid gap-1.5 text-[13px] text-[var(--home-text)]">
                  <li className="flex justify-between gap-3">
                    <span>Tue · CX specific</span>
                    <span className="home-mono text-[var(--home-text-3)]">
                      60m
                    </span>
                  </li>
                  <li className="flex justify-between gap-3">
                    <span>Thu · Easy endurance</span>
                    <span className="home-mono text-[var(--home-text-3)]">
                      75m
                    </span>
                  </li>
                  <li className="flex justify-between gap-3">
                    <span>Sat · Race openers</span>
                    <span className="home-mono text-[var(--home-text-3)]">
                      35m
                    </span>
                  </li>
                </ul>
                <div className="mt-2.5 flex gap-2">
                  <span className="home-cta home-cta-sm">Apply changes</span>
                  <span className="inline-flex h-8 items-center px-2 text-xs text-[var(--home-text-3)]">
                    Dismiss
                  </span>
                </div>
              </div>
            </div>
            <div className="border-t border-[var(--home-border)] px-3 py-2.5">
              <p className="border border-[var(--home-border)] bg-[var(--home-surface-2)] px-3 py-2 text-[13px] text-[var(--home-text-3)]">
                Ask in plain English…
              </p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

function SessionChip({ session }: { session: Session }) {
  const chip = (
    <div
      className={`border-l-2 px-2 py-1.5 ${
        session.state === "proposed"
          ? "border border-dashed border-[var(--home-accent-line)] border-l-[var(--home-accent-line)] bg-[var(--home-accent-dim)]"
          : session.state === "race"
            ? "border border-[rgba(212,165,116,0.35)] border-l-[var(--home-race)] bg-[rgba(212,165,116,0.1)]"
            : session.state === "rest"
              ? "border-transparent border-l-transparent"
              : `border border-[var(--home-border)] bg-[var(--home-surface-3)] ${
                  session.sport === "Ride"
                    ? "border-l-[var(--home-ride)]"
                    : "border-l-[var(--home-run)]"
                }`
      }`}
    >
      <p className="truncate text-[12px] leading-4 text-[var(--home-text)]">
        {session.title}
      </p>
      {session.state !== "rest" ? (
        <p className={`home-mono mt-0.5 text-[11px] ${sportColor(session.sport)}`}>
          {session.duration}
        </p>
      ) : null}
    </div>
  );

  if (session.state === "rest") {
    return chip;
  }

  return (
    <HoverCard.Root openDelay={120} closeDelay={80}>
      <HoverCard.Trigger asChild>
        <button type="button" className="block w-full text-left">
          {chip}
        </button>
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          sideOffset={8}
          className="z-50 w-48 border border-[var(--home-border)] bg-[var(--home-surface-3)] p-3 shadow-[0_16px_40px_rgba(0,0,0,0.4)]"
        >
          <p className="home-mono text-[10px] tracking-[0.14em] text-[var(--home-text-3)] uppercase">
            {session.state === "proposed" ? "Proposed" : session.sport}
          </p>
          <p className="mt-1 text-sm text-[var(--home-text)]">{session.title}</p>
          <p className="home-mono mt-1 text-[12px] text-[var(--home-text-2)]">
            {session.duration}
          </p>
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}
