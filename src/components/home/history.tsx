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
      <div className="grid lg:min-h-[880px] lg:grid-cols-[1.23fr_0.77fr]">
        <div className="relative min-h-[32rem] overflow-hidden">
          <HomePhoto
            src="/home/loop.jpg"
            alt="A road cyclist on a coastal road"
            objectPosition="68% 40%"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/15" />
          <div className="relative z-10 flex h-full min-h-[32rem] flex-col justify-between p-6 sm:p-10 lg:min-h-[880px] lg:p-14">
            <p className="home-mono text-[10px] font-bold tracking-[0.16em] text-white/55 uppercase">
              Today vs your usual
            </p>
            <dl className="self-end text-right">
              <dd className="text-[clamp(3.6rem,7vw,7rem)] leading-none tracking-[-0.07em] text-white">
                −1:18
              </dd>
              <p className="mt-2 text-[13px] text-white/55">faster</p>
              <dd className="mt-8 text-[clamp(3.6rem,7vw,7rem)] leading-none tracking-[-0.07em] text-white">
                −3 bpm
              </dd>
              <p className="mt-2 text-[13px] text-white/55">average HR</p>
              <p className="mt-10 text-[13px] text-white/45">
                Based on 14 comparable rides
              </p>
            </dl>
          </div>
        </div>
        <div className="flex flex-col justify-center px-4 py-20 sm:px-8 lg:px-12">
          <p className="home-kicker">Your own benchmark</p>
          <h2 className="home-display mt-8 text-[clamp(3.2rem,6.8vw,7rem)] text-[var(--home-text)]">
            Same effort.
            <span className="block">Faster.</span>
          </h2>
          <p className="mt-9 max-w-md text-[18px] leading-[1.55] text-[var(--home-text-2)]">
            Ahead recognises routes you ride regularly and compares today with
            your own past efforts — so progress shows up even when there was no
            test, race or FTP session.
          </p>
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
              The second block had less volume but substantially more specific
              work. Performance stayed high while strain increased around the
              race sequence.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
