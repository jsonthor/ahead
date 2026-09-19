"use client";

import * as Accordion from "@radix-ui/react-accordion";

const items = [
  {
    q: "Is Ahead a replacement for a coach?",
    a: "Ahead is built primarily for athletes who coach themselves. It can interpret training, help with day-to-day decisions, review completed blocks and plan what comes next. You remain in control of the training and every proposed change.",
  },
  {
    q: "Does Ahead create my whole training plan?",
    a: "It can, but it does not require you to start from a blank calendar. Ahead works around club sessions, races, existing plans and the training you already do.",
  },
  {
    q: "What is Performance?",
    a: "Performance is Ahead’s athlete-relative view of your current training state. It combines the capacity you have built with the strain you are currently carrying, then compares that state with your own history. The number shows where you are today. Building, Maintaining or Declining shows how that same state has been moving over the longer term.",
  },
  {
    q: "What is a Coach Review?",
    a: "A periodic look back at the block you just completed. Ahead considers what happened, what appears to have worked, what is still uncertain and what the next block should be trying to achieve.",
  },
  {
    q: "What happens after a workout?",
    a: "Ahead can compare the completed activity with what was planned, put it into the context of your recent training and explain whether anything should change next.",
  },
  {
    q: "Can Ahead change my training automatically?",
    a: "No. Ahead can propose changes. You approve them before they are applied.",
  },
  {
    q: "Which devices work?",
    a: "COROS and FIT uploads are supported first. Garmin, Polar and Wahoo are planned.",
  },
  {
    q: "Is Ahead medical advice?",
    a: "No. Ahead is a training tool, not a medical device. It does not diagnose medical conditions.",
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
