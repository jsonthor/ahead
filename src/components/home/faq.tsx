"use client";

import * as Accordion from "@radix-ui/react-accordion";

const items = [
  {
    q: "Is Ahead a replacement for a coach?",
    a: "Ahead is designed primarily for self-coached athletes. It can analyse training, explain patterns and help plan what comes next, but it doesn’t pretend to replace everything a good human coach brings.",
  },
  {
    q: "Does Ahead create my whole training plan?",
    a: "It can, but it doesn’t have to. Ahead can work with an existing routine, club sessions, races, coach-prescribed workouts or whatever training you already do.",
  },
  {
    q: "What is Readiness?",
    a: "Readiness estimates how much of the training capacity you’ve built appears available right now. It combines your longer-term aerobic and race-specific work with the temporary effect of recent fatigue.",
  },
  {
    q: "Can Ahead change my calendar?",
    a: "It can prepare changes. You see exactly what will move, be removed or be added before anything is applied.",
  },
  {
    q: "Which devices work?",
    a: "COROS and FIT activity imports are supported first, with more integrations being added.",
  },
  {
    q: "Is Ahead medical advice?",
    a: "No. Ahead uses training and recovery trends to help you understand your training. It does not diagnose illness, injury or medical conditions.",
  },
];

export function HomeFaq() {
  return (
    <section
      id="faq"
      className="scroll-mt-24 border-t border-[var(--home-border)] px-4 py-24 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-[1360px]">
        <h2 className="text-4xl font-medium tracking-[-0.045em] text-[var(--home-text)] sm:text-6xl">
          Questions
        </h2>
        <Accordion.Root
          type="single"
          collapsible
          className="mt-10 border-t border-[var(--home-border)]"
        >
          {items.map((item, index) => (
            <Accordion.Item
              key={item.q}
              value={item.q}
              className="border-b border-[var(--home-border)]"
            >
              <Accordion.Header>
                <Accordion.Trigger className="group flex w-full items-baseline justify-between gap-6 py-5 text-left">
                  <span className="flex min-w-0 items-baseline gap-4">
                    <span className="home-mono hidden w-6 shrink-0 text-[12px] text-[var(--home-text-3)] sm:inline">
                      0{index + 1}
                    </span>
                    <span className="text-[1.05rem] tracking-tight text-[var(--home-text)] sm:text-[1.2rem]">
                      {item.q}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className="home-mono text-sm text-[var(--home-text-3)] group-data-[state=open]:hidden"
                  >
                    +
                  </span>
                  <span
                    aria-hidden
                    className="home-mono hidden text-sm text-[var(--home-text-3)] group-data-[state=open]:inline"
                  >
                    −
                  </span>
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Content>
                <p className="max-w-2xl pb-6 text-[16px] leading-7 text-[var(--home-text-2)] sm:pl-10">
                  {item.a}
                </p>
              </Accordion.Content>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      </div>
    </section>
  );
}
