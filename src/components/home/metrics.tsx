"use client";

import * as Tooltip from "@radix-ui/react-tooltip";
import Link from "next/link";

import { HomeRing } from "@/components/home/ring";

const metrics = [
  {
    name: "Readiness",
    display: "49",
    value: 49,
    hint: "Available capacity",
    detail:
      "How much of your built training capacity appears available right now.",
    color: "var(--home-accent)",
    delay: "0s",
  },
  {
    name: "Fitness",
    display: "42.9",
    value: 42.9,
    hint: "Long-term training load",
    detail: "A slow average of training load. Useful as a trend, not a race prediction.",
    color: "var(--home-ride)",
    delay: "0.12s",
  },
  {
    name: "Fatigue",
    display: "46.7",
    value: 46.7,
    hint: "Recent training load",
    detail:
      "A fast average of recent work. Jumps after a hard block. Why Thursday can feel worse than the week looks.",
    color: "var(--home-race)",
    delay: "0.24s",
  },
  {
    name: "Form",
    display: "−3.8",
    value: 41,
    max: 100,
    hint: "Fitness minus Fatigue",
    detail:
      "The balance between Fitness and Fatigue. High is not always better; it can mean you under-trained.",
    color: "rgba(245,245,243,0.55)",
    delay: "0.36s",
  },
];

export function HomeMetrics() {
  return (
    <section id="form" className="scroll-mt-24 px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1360px]">
        <p className="home-mono text-[11px] tracking-[0.18em] text-[var(--home-text-3)] uppercase">
          Numbers, with context
        </p>
        <h2 className="mt-4 max-w-[16ch] text-4xl leading-[0.94] font-medium tracking-[-0.045em] text-[var(--home-text)] sm:text-6xl">
          The numbers still matter.
          <span className="mt-2 block text-[var(--home-text-2)]">
            They’re evidence, not the answer.
          </span>
        </h2>

        <div className="mt-14 grid grid-cols-2 gap-8 lg:grid-cols-4 lg:gap-4">
          {metrics.map((metric) => (
            <div key={metric.name} className="flex flex-col items-center">
              <HomeRing
                value={metric.value}
                display={metric.display}
                max={metric.max ?? 100}
                label={metric.name}
                hint={metric.hint}
                size={210}
                color={metric.color}
                delay={metric.delay}
              />
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <button
                    type="button"
                    className="home-mono mt-3 text-[11px] tracking-[0.14em] text-[var(--home-text-3)] uppercase underline decoration-[var(--home-border)] underline-offset-4 hover:text-[var(--home-text-2)] hover:decoration-[var(--home-accent)]"
                  >
                    What this is
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    sideOffset={8}
                    className="z-50 max-w-64 border border-[var(--home-border)] bg-[var(--home-surface-3)] px-3 py-2 text-[13px] leading-5 text-[var(--home-text-2)]"
                  >
                    {metric.detail}
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-12 max-w-2xl text-center text-[17px] leading-8 text-[var(--home-text-2)]">
          Ahead uses training metrics to help explain what’s happening, rather
          than expecting you to interpret every chart yourself.
        </p>
        <div className="mt-6 text-center">
          <Link
            href="#faq"
            className="inline-flex text-[15px] text-[var(--home-text)] underline decoration-[var(--home-border)] underline-offset-4 hover:decoration-[var(--home-accent)]"
          >
            How Readiness works →
          </Link>
        </div>
      </div>
    </section>
  );
}
