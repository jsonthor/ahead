const questions = [
  "Why was I faster last month?",
  "I’ve got three races in 14 days. What should I do between them?",
  "I can’t train Thursday. What should move?",
  "Is this training actually moving me forward?",
  "Why is Fitness rising while Readiness is falling?",
  "Compare the four weeks before this race with the four weeks after.",
];

export function HomeQuestions() {
  return (
    <section className="home-paper scroll-mt-24 px-4 py-24 sm:px-6 lg:px-8 lg:py-36">
      <div className="mx-auto max-w-[1470px]">
        <p className="home-kicker">The question behind the numbers</p>
        <h2 className="home-display mt-8 max-w-[16ch] text-[clamp(3.2rem,7vw,7.4rem)]">
          Your watch can tell you what happened.
        </h2>
        <p className="mt-7 max-w-3xl text-[clamp(1.4rem,2.1vw,2.2rem)] leading-snug tracking-[-0.035em] text-black/55">
          Ahead helps you decide what it means.
        </p>

        <div className="mt-24 grid gap-12 border-t border-black/15 pt-8 lg:mt-32 lg:grid-cols-[1.3fr_0.7fr] lg:items-end lg:gap-16">
          <p className="home-display text-[clamp(3.2rem,7vw,7rem)]">
            Am I actually
            <span className="block">getting fitter?</span>
          </p>
          <ul>
            {questions.map((item) => (
              <li
                key={item}
                className="border-b border-black/15 py-4 text-[15px] leading-6 last:border-b-0"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
