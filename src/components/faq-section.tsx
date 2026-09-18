"use client";

import * as Accordion from "@radix-ui/react-accordion";

const items = [
  {
    q: "Is this a replacement for a human coach?",
    a: "No. Bring the training you already do — club, coach, your own sessions, races. Potential interrogates the history, remembers why the week changed, and can propose a rewrite. It does not diagnose injury, and it will not silently change your calendar.",
  },
  {
    q: "Does Potential write my season for me?",
    a: "No. It is not an AI plan you hand your year to. You arrive with messy training, races, and constraints. Potential helps you understand that, remember the decisions, and steer what comes next.",
  },
  {
    q: "Do you copy TrainingPeaks metrics?",
    a: "We use a Banister-style fitness–fatigue model and talk about training load, fitness, fatigue, and form. Those are trend indicators, not race predictions. We do not use TrainingPeaks’ trademarked names.",
  },
  {
    q: "What can the assistant actually do?",
    a: "Read your profile, calendar, activities, wellness, load, and what it already knows about you. Answer questions about history and the current week. Then, if you ask, propose creating, moving, or deleting sessions. Every write shows a diff. You apply it. Undo is always available.",
  },
  {
    q: "Which devices work at launch?",
    a: "Garmin, COROS, Polar, and FIT/GPX upload. Those become Potential activities and feed Ask Ahead. Strava is not used for coaching or load. Apple Health — and Amazfit via Apple Health — come with an iPhone app later.",
  },
  {
    q: "Who sees my data?",
    a: "You. Training, wellness, and chat are private. They are not used to train public models. Conversations stay with the athlete unless you explicitly share.",
  },
  {
    q: "Is this medical advice?",
    a: "No. Potential is not a medical device. Chest pain, suspected stress fractures, disordered eating, and similar questions get a refusal and a pointer to a clinician — not a training rewrite presented as treatment.",
  },
];

export function FaqSection() {
  return (
    <Accordion.Root type="single" collapsible className="border-t border-line">
      {items.map((item) => (
        <Accordion.Item
          key={item.q}
          value={item.q}
          className="border-b border-line"
        >
          <Accordion.Header>
            <Accordion.Trigger className="group flex w-full items-baseline justify-between gap-6 py-5 text-left">
              <span className="font-serif text-xl tracking-tight text-ink sm:text-[1.35rem]">
                {item.q}
              </span>
              <span
                aria-hidden
                className="font-mono text-sm text-muted group-data-[state=open]:hidden"
              >
                +
              </span>
              <span
                aria-hidden
                className="hidden font-mono text-sm text-muted group-data-[state=open]:inline"
              >
                −
              </span>
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="overflow-hidden data-[state=closed]:animate-none">
            <p className="max-w-2xl pb-5 text-[15px] leading-7 text-ink-soft">
              {item.a}
            </p>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
