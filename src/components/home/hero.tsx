import Link from "next/link";

import { HomePhoto } from "@/components/home/photo";

const week = [
  { day: "Mon 21", title: "Easy aerobic", load: "41" },
  { day: "Tue 22", title: "CX specific", load: "72" },
  { day: "Wed 23", title: "Club session", load: "86" },
  { day: "Thu 24", title: "Easy endurance", load: "54" },
  { day: "Fri 25", title: "Rest", load: "—" },
];

export function HomeHero() {
  return (
    <section className="mx-auto grid min-h-[calc(100svh-4.25rem)] max-w-[1540px] lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] sm:min-h-[calc(100svh-4.75rem)]">
      <div className="flex flex-col justify-center px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <p className="home-kicker">For self-coached endurance athletes</p>
        <h1 className="home-display mt-8 max-w-[11ch] text-[clamp(3.4rem,7vw,7.25rem)] text-[var(--home-text)]">
          Know if the work is working.
        </h1>
        <p className="mt-9 max-w-lg text-[19px] leading-[1.52] tracking-[-0.018em] text-[var(--home-text-2)]">
          Ahead connects your training, recovery and races so you can see
          what’s changing — and decide what to do next.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-3">
          <Link href="/signup" className="home-cta">
            Coming soon
          </Link>
          <a
            href="#how-it-works"
            className="inline-flex h-11 items-center text-[14px] text-[var(--home-text-3)] transition-colors hover:text-[var(--home-text)]"
          >
            See how it works
          </a>
        </div>
        <p className="home-serif mt-16 text-[1.15rem] text-[var(--home-text-3)] italic">
          The calendar you can talk to.
        </p>
      </div>

      <div className="relative min-h-[40rem] overflow-hidden lg:min-h-full">
        <HomePhoto
          src="/home/session.jpg"
          alt="A runner checking her watch mid-session in the rain"
          preload
          objectPosition="62% 40%"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/35 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10" />

        <div className="relative z-10 flex h-full min-h-[40rem] flex-col justify-between p-5 pb-12 sm:p-8 sm:pb-14 lg:min-h-full lg:p-10 lg:pb-16">
          <div className="[text-shadow:0_1px_18px_rgba(0,0,0,0.45)]">
            <p className="home-mono text-[10px] tracking-[0.16em] text-white/70 uppercase">
              Readiness
            </p>
            <p className="home-mono mt-1 text-[clamp(5.5rem,10vw,9rem)] leading-none tracking-[-0.08em] text-white">
              49
            </p>
            <p className="home-mono mt-2 text-[10px] tracking-[0.16em] text-white/60 uppercase">
              Available capacity
            </p>
          </div>

          <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_minmax(16rem,22rem)] lg:items-start">
            <div className="border-t border-white/20 [text-shadow:0_1px_12px_rgba(0,0,0,0.5)]">
              <div className="flex items-center justify-between py-3">
                <p className="home-mono text-[9px] tracking-[0.16em] text-white/70 uppercase">
                  Week 39
                </p>
                <p className="home-mono text-[9px] tracking-[0.16em] text-white/70 uppercase">
                  3 races / 14d
                </p>
              </div>
              <ul>
                {week.map((row) => (
                  <li
                    key={row.day}
                    className="grid grid-cols-[4.4rem_1fr_2rem] items-center gap-3 border-b border-white/15 py-3"
                  >
                    <span className="home-mono text-[9px] tracking-[0.1em] text-white/65 uppercase">
                      {row.day}
                    </span>
                    <span className="text-[13px] text-white">{row.title}</span>
                    <span className="home-mono text-right text-[12px] text-white">
                      {row.load}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <aside className="bg-[#f1efe7] p-6 text-[#0a0b0a] sm:p-7 lg:mt-0">
              <p className="home-mono text-[9px] font-bold tracking-[0.15em] uppercase">
                Ask Ahead
              </p>
              <p className="mt-6 text-[1.15rem] leading-snug tracking-[-0.03em]">
                I’ve got three races in 14 days. What should I do between them?
              </p>
              <div className="mt-5 h-px w-11 bg-[#0a0b0a]" />
              <p className="mt-4 text-[13px] leading-6 text-black/60">
                Keep one quality session. Hold easy volume. Put a short opener
                before Sunday.
              </p>
              <ul className="mt-6 border-t border-black/15">
                <li className="grid grid-cols-[2.5rem_1fr] items-center border-b border-black/10 py-2.5 text-[12px]">
                  <span className="home-mono text-[9px] tracking-[0.12em]">
                    Tue
                  </span>
                  <span>CX specific · 60m</span>
                </li>
                <li className="grid grid-cols-[2.5rem_1fr] items-center border-b border-black/10 py-2.5 text-[12px]">
                  <span className="home-mono text-[9px] tracking-[0.12em]">
                    Thu
                  </span>
                  <span>Easy endurance · 75m</span>
                </li>
                <li className="grid grid-cols-[2.5rem_1fr] items-center py-2.5 text-[12px]">
                  <span className="home-mono text-[9px] tracking-[0.12em]">
                    Sat
                  </span>
                  <span>Race openers · 35m</span>
                </li>
              </ul>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}
