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
      className="home-paper scroll-mt-24 px-4 py-24 sm:px-6 lg:px-8 lg:py-36"
    >
      <div className="mx-auto max-w-[1470px]">
        <p className="home-kicker">Before a season</p>
        <h2 className="home-display mt-8 text-[clamp(3.6rem,8vw,7.8rem)]">
          Questions.
        </h2>
        <Accordion.Root type="single" collapsible className="mt-16">
          {items.map((item, index) => (
            <Accordion.Item
              key={item.q}
              value={item.q}
              className="border-t border-black/15 last:border-b"
            >
              <Accordion.Header>
                <Accordion.Trigger className="group grid w-full grid-cols-[3.25rem_minmax(0,1fr)_1.5rem] items-center gap-3 py-7 text-left sm:grid-cols-[3.6rem_minmax(0,1fr)_1.75rem]">
                  <span className="home-mono text-[9px] tracking-[0.14em] text-black/45">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[1.05rem] tracking-[-0.02em] sm:text-[1.25rem]">
                    {item.q}
                  </span>
                  <span
                    aria-hidden
                    className="text-right text-[1.25rem] text-black/45 group-data-[state=open]:hidden"
                  >
                    +
                  </span>
                  <span
                    aria-hidden
                    className="hidden text-right text-[1.25rem] text-black/45 group-data-[state=open]:inline"
                  >
                    −
                  </span>
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Content>
                <p className="max-w-3xl pb-7 pl-[3.25rem] text-[16px] leading-7 text-black/55 sm:pl-[3.6rem]">
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
