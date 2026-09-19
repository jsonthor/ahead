const notes = [
  { label: "Wednesday club", value: "Usually hard" },
  { label: "Sunday", value: "Frequent CX race" },
  { label: "Current block", value: "3 races / 14 days" },
  { label: "Decision", value: "Reduce midweek intensity", current: true },
];

export function HomeMemory() {
  return (
    <section
      id="memory"
      className="scroll-mt-24 px-4 py-24 sm:px-6 lg:px-8 lg:py-36"
    >
      <div className="mx-auto grid max-w-[1470px] gap-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:gap-24">
        <div>
          <p className="home-kicker">Persistent context</p>
          <h2 className="home-display mt-8 max-w-[16ch] text-[clamp(3.2rem,6.4vw,6.6rem)] text-[var(--home-text)]">
            It remembers why things changed.
          </h2>
          <p className="mt-8 max-w-xl text-[18px] leading-[1.55] text-[var(--home-text-2)]">
            A plan without context is just a schedule. Ahead remembers the
            decisions behind your training, so next week’s advice does not
            forget what you learned last month.
          </p>
          <p className="home-mono mt-12 text-[10px] font-bold tracking-[0.16em] text-white/55 uppercase">
            You
          </p>
          <p className="mt-3 max-w-3xl text-[clamp(1.35rem,2.2vw,1.85rem)] leading-snug tracking-[-0.03em] text-[var(--home-text)]">
            Should we put Wednesday intervals back?
          </p>
          <p className="home-mono mt-8 text-[10px] font-bold tracking-[0.16em] text-white/55 uppercase">
            Ahead
          </p>
          <p className="mt-3 max-w-3xl text-[18px] leading-[1.5] text-[var(--home-text-2)]">
            We reduced them because hard Wednesday club sessions were leaving
            too much fatigue before Sunday racing. I’d keep Wednesday controlled
            until this race block ends.
          </p>
        </div>
        <div>
          <p className="home-mono text-[10px] font-bold tracking-[0.16em] text-[var(--home-text-3)] uppercase">
            Current context
          </p>
          <ul className="mt-4 border-t border-[var(--home-border)]">
            {notes.map((item) => (
              <li
                key={item.label}
                className="flex flex-col gap-1.5 border-b border-[var(--home-border)] py-5"
              >
                <span
                  className={`home-mono text-[9px] tracking-[0.17em] uppercase ${
                    item.current
                      ? "text-[var(--home-cta)]"
                      : "text-[var(--home-text-3)]"
                  }`}
                >
                  {item.label}
                </span>
                <span className="text-[14px] text-[var(--home-text)]">
                  {item.value}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
