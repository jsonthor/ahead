import { HomePhoto } from "@/components/home/photo";

const load = [62, 70, 58, 81, 74, 66, 88, 71, 54, 60, 49, 57, 63, 52, 48, 55];

export function HomeHistory() {
  const max = Math.max(...load);
  const width = 1400;
  const height = 440;
  const step = width / (load.length - 1);
  const coords = load.map((value, index) => {
    const x = index * step;
    const y = height - (value / max) * (height - 80) - 40;
    return [x, y] as const;
  });
  const line = coords
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");

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
            <div className="flex items-end gap-5">
              <p className="home-mono text-[clamp(6rem,12vw,13rem)] leading-none tracking-[-0.09em] text-white">
                14×
              </p>
              <p className="home-mono mb-3 text-[10px] leading-4 tracking-[0.17em] text-white uppercase">
                You’ve ridden
                <span className="block">this route</span>
              </p>
            </div>
            <dl className="self-end text-right">
              <dt className="home-mono text-[9px] tracking-[0.16em] text-white/45 uppercase">
                Today vs typical
              </dt>
              <dd className="mt-3 text-[clamp(3rem,6vw,6rem)] leading-none tracking-[-0.07em] text-white">
                −1:18
              </dd>
              <p className="mt-2 text-[11px] text-white/50">faster</p>
              <dd className="mt-6 text-[clamp(3rem,6vw,6rem)] leading-none tracking-[-0.07em] text-white">
                −3 bpm
              </dd>
              <p className="mt-2 text-[11px] text-white/50">average HR</p>
            </dl>
          </div>
        </div>
        <div className="flex flex-col justify-center px-4 py-20 sm:px-8 lg:px-12">
          <p className="home-kicker">Your own baseline</p>
          <h2 className="home-display mt-8 text-[clamp(3.2rem,6.8vw,7rem)] text-[var(--home-text)]">
            Same route.
            <span className="block">Less effort.</span>
          </h2>
          <p className="mt-9 max-w-md text-[18px] leading-[1.55] text-[var(--home-text-2)]">
            Some progress is easier to see than to model. Ahead compares
            repeated routes against your own history so you can see when the
            same effort starts producing more.
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

          <p className="mt-16 border-y border-black/15 py-6 text-[clamp(1.4rem,2.3vw,2.5rem)] tracking-[-0.04em]">
            Compare the four weeks before Assen with the four weeks after.
          </p>

          <div className="relative mt-10 h-[22rem] sm:h-[27.5rem]">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="absolute inset-0 h-full w-full"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                d="M0 90 H1400 M0 220 H1400 M0 350 H1400"
                fill="none"
                stroke="rgba(10,11,10,0.09)"
                strokeWidth="1"
              />
              <path
                d={line}
                fill="none"
                stroke="#667f69"
                strokeWidth="3"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <div className="absolute top-10 left-[4%]">
              <p className="home-mono text-[9px] tracking-[0.17em] text-black/45 uppercase">
                Before
              </p>
              <p className="mt-1 text-[clamp(3.2rem,5vw,5.4rem)] leading-none tracking-[-0.07em]">
                18.4h
              </p>
              <p className="mt-2 text-[12px] text-black/50">68% easy</p>
            </div>
            <div className="absolute top-10 right-[4%] text-right">
              <p className="home-mono text-[9px] tracking-[0.17em] text-black/45 uppercase">
                After
              </p>
              <p className="mt-1 text-[clamp(3.2rem,5vw,5.4rem)] leading-none tracking-[-0.07em]">
                15.8h
              </p>
              <p className="mt-2 text-[12px] text-black/50">52% easy</p>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
