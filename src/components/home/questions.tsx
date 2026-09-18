const questions = [
  "Am I getting fitter?",
  "Why was I faster last month?",
  "Am I doing too much intensity?",
  "Should I train hard today?",
  "What should I do between these races?",
  "I missed a session. What should change?",
];

export function HomeQuestions() {
  const [featured, ...rest] = questions;

  return (
    <section id="questions" className="scroll-mt-24 px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1360px]">
        <p className="home-mono text-[11px] tracking-[0.18em] text-[var(--home-text-3)] uppercase">
          The actual problem
        </p>
        <h2 className="mt-4 max-w-[18ch] text-4xl leading-[0.94] font-medium tracking-[-0.045em] text-[var(--home-text)] sm:text-6xl">
          Your training gives you plenty of numbers.
          <span className="mt-2 block text-[var(--home-text-2)]">
            The hard part is knowing what they mean.
          </span>
        </h2>
        <p className="mt-7 max-w-xl text-[17px] leading-7 text-[var(--home-text-2)] sm:text-[18px] sm:leading-8">
          Fitness is up. Your legs feel awful. You raced better three weeks ago.
          You missed Thursday. There’s another race on Sunday.
        </p>
        <p className="mt-4 max-w-xl text-[17px] leading-7 text-[var(--home-text-2)] sm:text-[18px] sm:leading-8">
          Most training apps leave the interpretation to you. Ahead brings the
          pieces together so you can ask the questions that actually matter.
        </p>

        <p className="home-q mt-16 max-w-[18ch] pl-5 text-[2.35rem] leading-[1.05] font-medium tracking-[-0.04em] text-[var(--home-text)] transition-colors hover:text-[var(--home-accent)] sm:text-6xl">
          {featured}
        </p>

        <ul className="mt-12 grid gap-x-10 gap-y-1 md:grid-cols-2">
          {rest.map((item, index) => (
            <li key={item} className="home-q border-t border-[var(--home-border)] py-5 pl-5">
              <p className="home-mono text-[11px] text-[var(--home-text-3)]">
                0{index + 2}
              </p>
              <p className="mt-2 text-[1.25rem] leading-snug tracking-tight text-[var(--home-text)] transition-colors hover:text-[var(--home-accent)] sm:text-[1.45rem]">
                {item}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
