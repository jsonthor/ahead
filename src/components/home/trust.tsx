const control = [
  "Calendar changes are shown before they are applied.",
  "Missing activity data stays missing. It is not invented as rest.",
  "Metrics expose their assumptions and limitations.",
  "Ahead is a training tool, not a medical device.",
];

export function HomeTrust() {
  return (
    <section className="scroll-mt-24 px-4 py-24 sm:px-6 lg:px-8 lg:py-36">
      <div className="mx-auto max-w-[1470px]">
        <p className="home-kicker">You stay in control</p>
        <div className="mt-10 grid gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-24">
          <h2 className="home-display text-[clamp(3.2rem,6.8vw,7rem)] text-[var(--home-text)]">
            Ahead can suggest.
            <span className="block">You decide.</span>
          </h2>
          <ol className="border-t border-[var(--home-border)]">
            {control.map((line, index) => (
              <li
                key={line}
                className="grid grid-cols-[3.25rem_1fr] items-start border-b border-[var(--home-border)] py-5 text-[14px] leading-6 text-[var(--home-text-2)]"
              >
                <span className="home-mono text-[9px] tracking-[0.12em] text-[var(--home-text-3)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
