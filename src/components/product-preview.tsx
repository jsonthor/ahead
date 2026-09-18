const days = [
  {
    name: "Mon",
    date: "14",
    items: [
      {
        sport: "Run",
        title: "Easy 50′",
        load: "48",
        state: "done" as const,
        tone: "run" as const,
      },
    ],
  },
  {
    name: "Tue",
    date: "15",
    items: [
      {
        sport: "Run",
        title: "Threshold 5×5",
        load: "92",
        state: "done" as const,
        tone: "run" as const,
      },
    ],
  },
  {
    name: "Wed",
    date: "16",
    items: [
      {
        sport: "Run",
        title: "Club 8×400",
        load: "86",
        state: "done" as const,
        tone: "run" as const,
      },
    ],
  },
  {
    name: "Thu",
    date: "17",
    items: [
      {
        sport: "Run",
        title: "Intervals",
        load: "88",
        state: "moving" as const,
        tone: "run" as const,
      },
    ],
  },
  {
    name: "Fri",
    date: "18",
    today: true,
    items: [
      {
        sport: "Run",
        title: "Easy 40′",
        load: "36",
        state: "planned" as const,
        tone: "run" as const,
      },
    ],
  },
  {
    name: "Sat",
    date: "19",
    items: [
      {
        sport: "Run",
        title: "Shakeout 25′",
        load: "22",
        state: "planned" as const,
        tone: "run" as const,
      },
    ],
  },
  {
    name: "Sun",
    date: "20",
    items: [
      {
        sport: "Race",
        title: "10K",
        load: "—",
        state: "race" as const,
        tone: "race" as const,
      },
    ],
  },
];

const toneClass: Record<(typeof days)[number]["items"][number]["tone"], string> =
  {
    run: "text-run",
    race: "text-ember",
  };

export function ProductPreview() {
  return (
    <figure
      aria-label="Product preview: Ask Ahead compares this week with when the athlete was strongest, then proposes dropping Thursday intervals before a Sunday race"
      className="overflow-hidden rounded-md border border-line bg-paper-raised"
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <p className="text-[11px] font-medium tracking-[0.14em] text-muted uppercase">
            This week
          </p>
          <p className="mt-0.5 font-serif text-lg text-ink">14–20 Sep 2026</p>
        </div>
        <p className="hidden text-sm text-ink-soft sm:block">Race Sunday</p>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 overflow-x-auto">
          <div className="grid min-w-[44rem] grid-cols-7 divide-x divide-line border-b border-line lg:border-b-0 lg:border-r">
            {days.map((day) => (
              <div key={day.date} className="min-h-64 bg-paper-raised p-2.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] tracking-wide text-muted uppercase">
                    {day.name}
                  </span>
                  <span
                    className={
                      day.today
                        ? "flex h-6 w-6 items-center justify-center rounded-full bg-ink text-[11px] font-medium text-paper"
                        : "text-[13px] text-ink-soft"
                    }
                  >
                    {day.date}
                  </span>
                </div>
                <ul className="mt-3 grid gap-1.5">
                  {day.items.map((item) => (
                    <li
                      key={`${day.date}-${item.title}`}
                      className={`rounded-sm border px-2 py-1.5 ${
                        item.state === "moving"
                          ? "border-ember/40 bg-paper-sunken line-through decoration-ink/30"
                          : item.state === "race"
                            ? "border-ember/40 bg-paper"
                            : "border-line bg-paper"
                      }`}
                    >
                      <p
                        className={`text-[10px] font-medium tracking-wide uppercase ${toneClass[item.tone]}`}
                      >
                        {item.sport}
                      </p>
                      <p className="text-[13px] leading-5 text-ink">
                        {item.title}
                      </p>
                      <p className="font-mono text-[11px] text-muted">
                        Load {item.load}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <aside className="flex min-h-80 flex-col bg-paper">
          <div className="border-b border-line px-4 py-3">
            <p className="text-[11px] font-medium tracking-[0.14em] text-muted uppercase">
              Ask Ahead
            </p>
            <p className="mt-0.5 text-sm text-ink">Remembers this athlete</p>
          </div>
          <div className="flex flex-1 flex-col gap-3 p-4">
            <p className="self-end max-w-[95%] rounded-sm bg-ink px-3 py-2 text-[13px] leading-5 text-paper">
              What was I doing when I was strongest? Should this week look more
              like that?
            </p>
            <div className="max-w-[95%] rounded-sm border border-line bg-paper-raised px-3 py-2 text-[13px] leading-5 text-ink-soft">
              August was club plus one other quality session, then quiet before
              the race. We already learned that Friday intensity before Sunday
              races costs you. This week has threshold Tuesday, club Wednesday,
              and intervals Thursday. I’d drop Thursday.
            </div>
            <div className="rounded-sm border border-line bg-paper-raised p-3">
              <p className="text-[11px] font-medium tracking-wide text-muted uppercase">
                Proposed changes
              </p>
              <ul className="mt-2 grid gap-1 text-[13px] text-ink">
                <li>Thu 17 — Intervals removed</li>
                <li>Fri 18 — Easy 40′ kept</li>
              </ul>
              <div className="mt-3 flex gap-2">
                <span className="inline-flex h-8 items-center rounded-sm bg-forest px-3 text-xs font-medium text-paper">
                  Apply
                </span>
                <span className="inline-flex h-8 items-center px-2 text-xs text-muted">
                  Dismiss
                </span>
              </div>
            </div>
          </div>
        </aside>
      </div>
      <figcaption className="sr-only">
        Example week compared with a stronger August block. Ask Ahead
        remembers that Friday intensity before Sunday races costs this athlete,
        and proposes dropping Thursday intervals.
      </figcaption>
    </figure>
  );
}
