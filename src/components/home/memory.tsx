const notes = [
  { label: "Wednesday club", value: "Usually hard" },
  { label: "Sunday", value: "Frequent CX race" },
  { label: "Current block", value: "3 races / 14 days" },
  { label: "Decision", value: "Reduce midweek intensity" },
];

export function HomeMemory() {
  return (
    <section
      id="memory"
      className="scroll-mt-24 px-4 py-24 sm:px-6 lg:px-8 lg:py-36"
    >
      <div className="mx-auto grid max-w-[1470px] gap-16 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:gap-24">
        <div>
          <p className="home-kicker">Persistent context</p>
          <p className="mt-16 max-w-3xl text-[clamp(1.7rem,3.5vw,3.5rem)] leading-[1.05] tracking-[-0.05em] text-[var(--home-text-3)]">
            Should we put Wednesday intervals back?
          </p>
          <p className="mt-8 max-w-4xl text-[clamp(2.2rem,5vw,4.8rem)] leading-[0.98] tracking-[-0.06em] text-[var(--home-text)]">
            We removed them because Sunday races were suffering after hard
            Wednesday club sessions. I’d keep Wednesday controlled until this
            race block ends.
          </p>
        </div>
        <ul className="border-t border-[var(--home-border)]">
          {notes.map((item) => (
            <li
              key={item.label}
              className="flex flex-col gap-1.5 border-b border-[var(--home-border)] py-5"
            >
              <span className="home-mono text-[9px] tracking-[0.17em] text-[var(--home-accent)] uppercase">
                {item.label}
              </span>
              <span className="text-[14px] text-[var(--home-text)]">
                {item.value}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
