const days = [
  {
    name: "Mon",
    date: "21",
    title: "Easy aerobic",
    meta: "50m",
    kind: "done" as const,
  },
  {
    name: "Tue",
    date: "22",
    title: "CX specific",
    meta: "60m",
    kind: "done" as const,
  },
  {
    name: "Wed",
    date: "23",
    title: "Club session",
    meta: "55m",
    kind: "done" as const,
  },
  {
    name: "Thu",
    date: "24",
    title: "Recovery",
    meta: "40m",
    was: "Intervals",
    kind: "proposed" as const,
  },
  {
    name: "Fri",
    date: "25",
    title: "Easy",
    meta: "40m",
    was: "Threshold",
    kind: "proposed" as const,
  },
  {
    name: "Sat",
    date: "26",
    title: "Race openers",
    meta: "35m",
    kind: "planned" as const,
  },
  {
    name: "Sun",
    date: "27",
    title: "CX race",
    meta: "50m",
    kind: "race" as const,
  },
];

export function HomeTalk() {
  return (
    <section id="product" className="scroll-mt-24 px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
      <div className="mx-auto max-w-[1470px]">
        <p className="home-kicker">21–27 Sep</p>
        <h2 className="home-display mt-8 max-w-[14ch] text-[clamp(3.2rem,6.8vw,7.2rem)] text-[var(--home-text)]">
          The calendar you can talk to.
        </h2>
        <p className="mt-8 max-w-xl text-[18px] leading-[1.55] text-[var(--home-text-2)]">
          Completed work stays where it landed. Proposed changes wait for you.
          Race week is visible before you ask.
        </p>

        <div className="mt-16 overflow-x-auto border-y border-[var(--home-border)]">
          <div className="grid min-w-[64rem] grid-cols-7">
            {days.map((day) => (
              <article
                key={day.date}
                className="min-h-[18rem] border-r border-[var(--home-border)] last:border-r-0"
              >
                <header className="flex items-start justify-between border-b border-[var(--home-border)] px-4 py-4">
                  <span className="home-mono text-[9px] tracking-[0.14em] text-[var(--home-text-3)] uppercase">
                    {day.name}
                  </span>
                  <span className="text-[1.4rem] tracking-[-0.04em] text-[var(--home-text)]">
                    {day.date}
                  </span>
                </header>
                <div
                  className={`mx-2.5 mt-3 flex min-h-[10rem] flex-col px-3 py-3 ${
                    day.kind === "proposed"
                      ? "bg-[var(--home-accent-dim)] shadow-[inset_2px_0_0_var(--home-cta)]"
                      : day.kind === "race"
                        ? "bg-[rgba(212,165,116,0.08)]"
                        : day.kind === "done"
                          ? "bg-white/[0.03]"
                          : "bg-white/[0.02]"
                  }`}
                >
                  <p className="home-mono min-h-4 text-[8px] tracking-[0.14em] uppercase">
                    {day.kind === "proposed" ? (
                      <span className="text-[var(--home-cta)]">Proposed</span>
                    ) : day.kind === "race" ? (
                      <span className="text-[var(--home-race)]">Race</span>
                    ) : day.kind === "done" ? (
                      <span className="text-white/35">Completed</span>
                    ) : null}
                  </p>
                  {day.was ? (
                    <p className="mt-2 text-[12px] text-white/30 line-through">
                      {day.was}
                    </p>
                  ) : null}
                  <p className="mt-1 text-[14px] leading-snug font-medium text-[var(--home-text)]">
                    {day.title}
                  </p>
                  <p className="mt-1 text-[10px] text-[var(--home-text-3)]">
                    {day.meta}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
