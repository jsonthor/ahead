const findings = [
  {
    label: "What worked",
    body: "Specific capacity developed while the aerobic base held.",
    lead: true,
  },
  {
    label: "What we learned",
    body: "Weekly racing can provide the main high-intensity stimulus. There is no reason to add extra intensity simply to increase load.",
  },
  {
    label: "Next block",
    body: "Use the upcoming CX races as the backbone of the block. Keep one meaningful aerobic session each week and protect recovery between race weekends.",
  },
];

export function HomeReview() {
  return (
    <section id="review" className="scroll-mt-24 px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
      <div className="mx-auto max-w-[1470px]">
        <div className="max-w-4xl">
          <p className="home-kicker">Every few weeks</p>
          <h2 className="home-display mt-8 max-w-[14ch] text-[clamp(3.2rem,6.8vw,7.2rem)] text-[var(--home-text)]">
            Step back before you plan the next block.
          </h2>
          <p className="mt-8 max-w-xl text-[18px] leading-[1.55] text-[var(--home-text-2)]">
            Day-to-day decisions keep training on track. Every few weeks, you
            need to know whether the whole block worked.
          </p>
          <p className="mt-5 max-w-xl text-[18px] leading-[1.55] text-[var(--home-text-2)]">
            Coach Review looks at what you actually completed, what changed,
            what appears to be working and what still isn’t clear — then uses
            what’s ahead to shape the next block.
          </p>
        </div>

        <div className="mt-20 border-y border-[var(--home-border)]">
          <header className="flex flex-wrap items-end justify-between gap-6 py-8">
            <div>
              <p className="text-[1.35rem] font-medium tracking-[-0.03em] text-[var(--home-text)]">
                September Coach Review
              </p>
              <p className="home-mono mt-2 text-[11px] tracking-[0.12em] text-[var(--home-text-3)] uppercase">
                23 Aug – 19 Sep
              </p>
            </div>
            <p className="home-mono text-[11px] tracking-[0.14em] text-[var(--home-cta)] uppercase">
              Performance · Building
            </p>
          </header>
          <div className="grid gap-px bg-[var(--home-border)] lg:grid-cols-3">
            {findings.map((item) => (
              <section
                key={item.label}
                className="bg-[var(--home-bg)] px-6 py-8 lg:min-h-[20rem]"
              >
                <p className="home-mono text-[10px] font-bold tracking-[0.16em] text-[var(--home-text-3)] uppercase">
                  {item.label}
                </p>
                <p
                  className={`mt-5 leading-snug ${
                    item.lead
                      ? "text-[1.35rem] font-medium tracking-[-0.03em] text-[var(--home-text)]"
                      : "text-[16px] leading-7 text-[var(--home-text-2)]"
                  }`}
                >
                  {item.body}
                </p>
              </section>
            ))}
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-end justify-between gap-6">
          <p className="max-w-xl text-[clamp(1.35rem,2.1vw,2rem)] leading-snug tracking-[-0.03em] text-[var(--home-text-2)]">
            Review what happened. Carry the lesson forward. Decide what the next
            block is actually for.
          </p>
          <p className="text-[13px] text-[var(--home-text-3)]">
            Build next block →
          </p>
        </div>
      </div>
    </section>
  );
}
