const before = [
  { k: "Hours", v: "18.4" },
  { k: "Load", v: "1,180" },
  { k: "Easy", v: "68%" },
  { k: "Fitness", v: "37 → 42" },
];

const after = [
  { k: "Hours", v: "15.8" },
  { k: "Load", v: "1,090" },
  { k: "Easy", v: "52%" },
  { k: "Fitness", v: "42 → 44" },
];

const load = [62, 70, 58, 81, 74, 66, 88, 71, 54, 60, 49, 57, 63, 52, 48, 55];

const compares = [
  "Why was I racing better in August?",
  "Compare the four weeks before Assen with the four weeks after.",
  "What changed before my best races?",
  "Has my easy riding actually increased this season?",
];

export function HomeHistory() {
  const max = Math.max(...load);
  const width = 720;
  const height = 220;
  const step = width / (load.length - 1);
  const coords = load.map((value, index) => {
    const x = index * step;
    const y = height - (value / max) * (height - 12) - 6;
    return [x, y] as const;
  });
  const line = coords
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${width} ${height} L0 ${height} Z`;

  return (
    <section id="history" className="scroll-mt-24 px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1360px]">
        <p className="home-mono text-[11px] tracking-[0.18em] text-[var(--home-text-3)] uppercase">
          Compared with you
        </p>
        <h2 className="mt-4 max-w-[16ch] text-4xl leading-[0.94] font-medium tracking-[-0.045em] text-[var(--home-text)] sm:text-6xl">
          See whether the work is paying off.
        </h2>
        <p className="mt-7 max-w-xl text-[17px] leading-7 text-[var(--home-text-2)] sm:text-[18px] sm:leading-8">
          Training progress isn’t always a bigger Fitness number. Sometimes
          it’s riding the same loop faster at the same heart rate. Sometimes
          it’s fading less late in a session. Sometimes it’s handling more
          training without carrying as much fatigue.
        </p>
        <p className="mt-4 max-w-xl text-[17px] leading-7 text-[var(--home-text-2)] sm:text-[18px] sm:leading-8">
          Ahead looks for those changes across your own history.
        </p>

        <div className="mt-12 overflow-hidden border border-[var(--home-border)] bg-[var(--home-surface)]">
          <div className="border-b border-[var(--home-border)] px-4 py-5 sm:px-6">
            <p className="home-mono text-[10px] tracking-[0.16em] text-[var(--home-text-3)] uppercase">
              Route history
            </p>
            <p className="mt-2 text-[1.35rem] tracking-tight text-[var(--home-text)] sm:text-[1.6rem]">
              You’ve ridden this route 14 times.
            </p>
          </div>
          <div className="grid sm:grid-cols-2">
            <div className="border-b border-[var(--home-border)] px-4 py-6 sm:border-r sm:border-b-0 sm:px-6">
              <p className="text-[12px] text-[var(--home-text-3)]">
                Today vs typical
              </p>
              <p className="home-mono mt-2 text-[2rem] tracking-tight text-[var(--home-text)]">
                1:18 faster
              </p>
            </div>
            <div className="px-4 py-6 sm:px-6">
              <p className="text-[12px] text-[var(--home-text-3)]">
                Average heart rate
              </p>
              <p className="home-mono mt-2 text-[2rem] tracking-tight text-[var(--home-text)]">
                3 bpm lower
              </p>
            </div>
          </div>
          <p className="border-t border-[var(--home-border)] px-4 py-5 text-[15px] leading-7 text-[var(--home-text-2)] sm:px-6">
            That’s your training compared with you, not a population benchmark.
          </p>
        </div>

        <h3 className="mt-24 max-w-[14ch] text-4xl leading-[0.94] font-medium tracking-[-0.045em] text-[var(--home-text)] sm:text-6xl">
          Last week or last season.
        </h3>
        <p className="mt-7 max-w-xl text-[17px] leading-7 text-[var(--home-text-2)] sm:text-[18px] sm:leading-8">
          Ask Ahead to compare any part of your training. It finds the relevant
          sessions, compares the periods and explains the differences without
          making you piece them together yourself.
        </p>

        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {compares.map((item) => (
            <li
              key={item}
              className="border-l-2 border-[var(--home-accent)] bg-[var(--home-surface)] px-4 py-3 text-[15px] leading-6 text-[var(--home-text)]"
            >
              {item}
            </li>
          ))}
        </ul>

        <div className="mt-12 overflow-hidden border border-[var(--home-border)] bg-[var(--home-surface)]">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--home-border)] px-4 py-4 sm:px-6">
            <div>
              <p className="home-mono text-[10px] tracking-[0.16em] text-[var(--home-text-3)] uppercase">
                Period compare
              </p>
              <p className="mt-2 max-w-2xl text-[1.35rem] tracking-tight text-[var(--home-text)] sm:text-[1.6rem]">
                Compare the four weeks before Assen with the four weeks after.
              </p>
            </div>
          </div>

          <div className="grid lg:grid-cols-2">
            <div className="border-b border-[var(--home-border)] bg-[rgba(143,191,163,0.05)] px-4 py-6 sm:px-6 lg:border-r lg:border-b-0">
              <p className="home-mono text-[11px] tracking-[0.16em] text-[var(--home-accent)] uppercase">
                Before
              </p>
              <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5">
                {before.map((row) => (
                  <div key={row.k}>
                    <dt className="text-[12px] text-[var(--home-text-3)]">
                      {row.k}
                    </dt>
                    <dd className="home-mono mt-1 text-[1.65rem] tracking-tight text-[var(--home-text)]">
                      {row.v}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="px-4 py-6 sm:px-6">
              <p className="home-mono text-[11px] tracking-[0.16em] text-[var(--home-text-3)] uppercase">
                After
              </p>
              <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5">
                {after.map((row) => (
                  <div key={row.k}>
                    <dt className="text-[12px] text-[var(--home-text-3)]">
                      {row.k}
                    </dt>
                    <dd className="home-mono mt-1 text-[1.65rem] tracking-tight text-[var(--home-text)]">
                      {row.v}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          <div className="relative border-t border-[var(--home-border)] px-4 py-5 sm:px-6">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="h-44 w-full text-[var(--home-accent)]"
              aria-hidden="true"
            >
              <rect
                x="0"
                y="0"
                width={width / 2}
                height={height}
                fill="rgba(143,191,163,0.07)"
              />
              <path d={area} fill="rgba(143,191,163,0.12)" />
              <path
                d={line}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <div className="mt-2 flex justify-between text-[11px] tracking-[0.12em] text-[var(--home-text-3)] uppercase">
              <span>Four weeks before</span>
              <span>Four weeks after</span>
            </div>
          </div>

          <p className="border-t border-[var(--home-border)] px-4 py-5 text-[15px] leading-7 text-[var(--home-text-2)] sm:px-6">
            Intensity rose after Assen and easy volume fell. Fitness still
            climbed, but the mix is less like the block that produced the
            result.
          </p>
        </div>
      </div>
    </section>
  );
}
