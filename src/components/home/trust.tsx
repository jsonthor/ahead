const uses = [
  "understand whether your training is moving in the right direction",
  "compare periods and repeated sessions",
  "make sense of training load and recovery",
  "plan around races and real life",
  "adjust the calendar when circumstances change",
  "remember why previous decisions were made",
];

const control = [
  "Ahead can suggest. You decide.",
  "Calendar changes are shown before they are applied.",
  "Missing activity data is treated as missing — not silently assumed to be rest.",
  "Training metrics show their assumptions and limitations.",
  "Ahead is a training tool, not a medical device.",
];

export function HomeTrust() {
  return (
    <section className="scroll-mt-24 px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1360px]">
        <p className="home-mono text-[11px] tracking-[0.18em] text-[var(--home-text-3)] uppercase">
          Who it’s for
        </p>
        <h2 className="mt-4 max-w-[16ch] text-4xl leading-[0.94] font-medium tracking-[-0.045em] text-[var(--home-text)] sm:text-6xl">
          Built for self-coached athletes.
        </h2>
        <p className="mt-7 max-w-2xl text-[17px] leading-7 text-[var(--home-text-2)] sm:text-[18px] sm:leading-8">
          Ahead isn’t trying to replace every reason someone might hire a great
          coach. It is for athletes who already make most of their own training
          decisions and want better evidence behind them.
        </p>
        <p className="mt-8 text-[15px] text-[var(--home-text)]">Use Ahead to:</p>
        <ul className="mt-4 max-w-2xl divide-y divide-[var(--home-border)] border-y border-[var(--home-border)]">
          {uses.map((line) => (
            <li
              key={line}
              className="py-4 text-[16px] leading-7 text-[var(--home-text)]"
            >
              {line}
            </li>
          ))}
        </ul>

        <h3 className="mt-24 max-w-[14ch] text-4xl leading-[0.94] font-medium tracking-[-0.045em] text-[var(--home-text)] sm:text-6xl">
          You stay in control.
        </h3>
        <ul className="mt-10 max-w-2xl divide-y divide-[var(--home-border)] border-y border-[var(--home-border)]">
          {control.map((line, index) => (
            <li
              key={line}
              className="flex items-start gap-4 py-4 text-[16px] leading-7 text-[var(--home-text)]"
            >
              <span className="home-mono mt-0.5 w-6 shrink-0 text-[12px] text-[var(--home-accent)]">
                0{index + 1}
              </span>
              {line}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
