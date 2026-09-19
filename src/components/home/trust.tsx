const control = [
  {
    title: "You approve training changes.",
    body: "Ahead can propose changes, but nothing is silently rewritten.",
  },
  {
    title: "Missing stays missing.",
    body: "No recorded activity is not automatically treated as rest.",
  },
  {
    title: "The numbers have provenance.",
    body: "Metrics expose the models, assumptions and confidence behind them.",
  },
  {
    title: "AI interprets. Ahead calculates.",
    body: "Canonical training metrics come from Ahead’s models, not from the language model guessing them.",
  },
  {
    title: "Ahead is not a medical device.",
    body: "It helps interpret training and recovery data. It does not diagnose health conditions.",
  },
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
            {control.map((item, index) => (
              <li
                key={item.title}
                className="grid grid-cols-[3.25rem_1fr] items-start border-b border-[var(--home-border)] py-5"
              >
                <span className="home-mono text-[9px] tracking-[0.12em] text-[var(--home-text-3)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>
                  <p className="text-[15px] font-medium text-[var(--home-text)]">
                    {item.title}
                  </p>
                  <p className="mt-1 text-[14px] leading-6 text-[var(--home-text-2)]">
                    {item.body}
                  </p>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
