import { HomePhoto } from "@/components/home/photo";

const questions = [
  "Am I actually getting fitter?",
  "What changed before my best race?",
  "I’ve got three races in 14 days. What should I do between them?",
  "Compare the four weeks before this race with the four weeks after.",
];

export function HomeHistory() {
  return (
    <section id="history" className="scroll-mt-24">
      <div className="px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
        <div className="mx-auto max-w-[1470px]">
          <p className="home-kicker">Performance evidence</p>
          <h2 className="home-display mt-8 max-w-[16ch] text-[clamp(3.2rem,6.8vw,7rem)] text-[var(--home-text)]">
            Performance, backed by evidence.
          </h2>
          <p className="mt-8 max-w-2xl text-[18px] leading-[1.55] text-[var(--home-text-2)]">
            Race results are the strongest real-world signal. Repeated efforts
            fill the gaps between them. Capacity models explain the physiology.
            Training load is the input, not the proof.
          </p>

          <div className="mt-16 grid gap-4 lg:grid-cols-2">
            <article className="border border-[var(--home-border)] bg-[var(--home-surface)] p-6 sm:p-8">
              <p className="home-mono text-[10px] font-bold tracking-[0.16em] text-white/45 uppercase">
                Race result
              </p>
              <p className="mt-5 text-[15px] text-white/70">Eastern CX R3 · 27 Sep</p>
              <p className="mt-3 text-[clamp(3.2rem,6vw,5.4rem)] leading-none tracking-[-0.07em] text-white">
                4th / 38
              </p>
              <p className="mt-4 text-[15px] text-white/55">U12 · +0:17 · felt good</p>
              <p className="mt-8 text-[16px] leading-6 text-white/70">
                Best placing against this field this season. The file has the
                ride. This is how it actually finished.
              </p>
            </article>

            <article className="relative min-h-[22rem] overflow-hidden border border-[var(--home-border)]">
              <HomePhoto
                src="/home/loop.jpg"
                alt="A road cyclist on a coastal road"
                objectPosition="68% 40%"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/10" />
              <div className="relative z-10 flex h-full min-h-[22rem] flex-col justify-between p-6 sm:p-8">
                <p className="home-mono text-[10px] font-bold tracking-[0.16em] text-white/45 uppercase">
                  Between races
                </p>
                <div>
                  <p className="text-[clamp(3.2rem,6vw,5.4rem)] leading-none tracking-[-0.07em] text-white">
                    −1:18
                  </p>
                  <p className="mt-2 text-[15px] text-white/55">faster · −3 bpm</p>
                  <p className="mt-6 max-w-sm text-[16px] leading-6 text-white/70">
                    Same loop, 14 times. Supporting evidence when there was no
                    race, test or FTP session.
                  </p>
                </div>
              </div>
            </article>
          </div>
        </div>
      </div>

      <div className="home-paper px-4 py-24 sm:px-6 lg:px-8 lg:py-36">
        <div className="mx-auto max-w-[1470px]">
          <p className="home-kicker">Ask your history</p>
          <h2 className="home-display mt-8 text-[clamp(3.2rem,6.8vw,7rem)]">
            Last week.
            <span className="block">Last season.</span>
          </h2>
          <p className="mt-8 max-w-xl text-[18px] leading-[1.55] text-black/55">
            Your training history should be useful for more than charts. Ask
            Ahead to compare blocks, races, sessions or entire periods and
            explain what actually changed.
          </p>

          <ul className="mt-16 max-w-2xl border-t border-black/15">
            {questions.map((item) => (
              <li
                key={item}
                className="border-b border-black/15 py-4 text-[15px] leading-6"
              >
                {item}
              </li>
            ))}
          </ul>

          <p className="mt-16 border-y border-black/15 py-6 text-[clamp(1.4rem,2.3vw,2.5rem)] tracking-[-0.04em]">
            Compare the four weeks before this race with the four weeks after.
          </p>

          <div className="mt-10 grid gap-10 sm:grid-cols-2">
            <div>
              <p className="home-mono text-[9px] tracking-[0.17em] text-black/45 uppercase">
                Before
              </p>
              <p className="mt-1 text-[clamp(3.2rem,5vw,5.4rem)] leading-none tracking-[-0.07em]">
                18.4h
              </p>
              <p className="mt-2 text-[12px] text-black/50">68% easy</p>
            </div>
            <div className="sm:text-right">
              <p className="home-mono text-[9px] tracking-[0.17em] text-black/45 uppercase">
                After
              </p>
              <p className="mt-1 text-[clamp(3.2rem,5vw,5.4rem)] leading-none tracking-[-0.07em]">
                15.8h
              </p>
              <p className="mt-2 text-[12px] text-black/50">52% easy</p>
            </div>
          </div>

          <div className="mt-12 max-w-2xl">
            <p className="home-mono text-[10px] font-bold tracking-[0.16em] text-black/40 uppercase">
              Ahead
            </p>
            <p className="mt-3 text-[18px] leading-[1.55] text-black/55">
              Capacity rose across the block, and the last two races provide
              supporting performance evidence: 4th and 2nd, both improvements
              against comparable fields.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
