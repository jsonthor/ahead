"use client";

import * as Tooltip from "@radix-ui/react-tooltip";
import Link from "next/link";

const metrics = [
  {
    name: "Direction",
    display: "Building",
    hint: "The band you want to stay in",
    detail:
      "A slow trajectory: Declining, Maintaining, or Building. Strain is the cost of that path, not another band. Confidence is separate. Fitness rising is stimulus, not proof of adaptation.",
    primary: true,
  },
  {
    name: "Readiness",
    display: "49",
    hint: "Expressible today",
    detail:
      "How much of your built capacity is expressible today.",
  },
  {
    name: "Fitness",
    display: "42.9",
    hint: "Long-term load",
    detail:
      "A slow average of training load. Useful as a trend, not a race prediction.",
  },
  {
    name: "Fatigue",
    display: "46.7",
    hint: "Recent load",
    detail:
      "A fast average of recent work. Jumps after a hard block. Why Thursday can feel worse than the week looks.",
  },
  {
    name: "Form",
    display: "−3.8",
    hint: "Fitness minus Fatigue",
    detail:
      "The balance between Fitness and Fatigue. High is not always better; it can mean you under-trained.",
  },
];

export function HomeMetrics() {
  return (
    <section id="form" className="scroll-mt-24 px-4 pb-24 sm:px-6 lg:px-8 lg:pb-36">
      <div className="mx-auto max-w-[1470px]">
        <div className="border-t border-[var(--home-border)] pt-12">
          <p className="home-kicker">Numbers, with context</p>
          <h2 className="home-display mt-8 max-w-5xl text-[clamp(3.2rem,6.8vw,7rem)] text-[var(--home-text)]">
            The numbers still matter.
            <span className="block">They’re just not the answer.</span>
          </h2>
        </div>

        <dl className="mt-20 grid border-y border-[var(--home-border)] sm:grid-cols-2 lg:grid-cols-[1.35fr_1.05fr_repeat(3,0.9fr)]">
          {metrics.map((metric) => (
            <div
              key={metric.name}
              className={`flex min-h-[16rem] flex-col justify-between border-b border-[var(--home-border)] p-6 sm:min-h-[20rem] lg:border-r lg:border-b-0 lg:last:border-r-0 ${
                metric.primary
                  ? "bg-[var(--home-accent)] text-[#04140a]"
                  : "text-[var(--home-text)]"
              }`}
            >
              <dt className="home-mono text-[10px] font-bold tracking-[0.17em] uppercase">
                {metric.name}
              </dt>
              <dd>
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <button
                      type="button"
                      className={`home-mono leading-none tracking-[-0.09em] ${
                        metric.name === "Direction"
                          ? "text-[clamp(2.6rem,4.4vw,4.6rem)]"
                          : "text-[clamp(4.2rem,8vw,8.5rem)]"
                      }`}
                    >
                      {metric.display}
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      sideOffset={8}
                      className="z-50 max-w-64 bg-[var(--home-surface-3)] px-3 py-2 text-[13px] leading-5 text-[var(--home-text-2)]"
                    >
                      {metric.detail}
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </dd>
              <p
                className={`text-[11px] ${
                  metric.primary ? "opacity-60" : "text-[var(--home-text-3)]"
                }`}
              >
                {metric.hint}
              </p>
            </div>
          ))}
        </dl>

        <div className="mt-8">
          <Link
            href="#faq"
            className="text-[13px] text-[var(--home-text-3)] underline decoration-[var(--home-border)] underline-offset-4 hover:text-[var(--home-text)]"
          >
            How Direction and Readiness work
          </Link>
        </div>
      </div>
    </section>
  );
}
