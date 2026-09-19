import Link from "next/link";

const why = [
  { label: "Aerobic capacity", value: "Rising" },
  { label: "Specific capacity", value: "At top of range" },
  { label: "Strain", value: "Typical" },
];

export function HomeState() {
  return (
    <section id="performance" className="scroll-mt-24 px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
      <div className="mx-auto grid max-w-[1470px] gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:gap-24">
        <div>
          <p className="home-kicker">Your training state</p>
          <h2 className="home-display mt-8 max-w-[12ch] text-[clamp(3.2rem,6.8vw,7.2rem)] text-[var(--home-text)]">
            One answer. Then the reasons why.
          </h2>
          <p className="mt-8 max-w-xl text-[18px] leading-[1.55] text-[var(--home-text-2)]">
            Performance shows where your training has left you right now,
            compared with your own history.
          </p>
          <p className="mt-5 max-w-xl text-[18px] leading-[1.55] text-[var(--home-text-2)]">
            The number shows where you are today. Building, Maintaining or
            Declining shows how that same state has been moving over the longer
            term.
          </p>
          <p className="mt-8 max-w-xl text-[clamp(1.35rem,2.1vw,1.85rem)] leading-snug tracking-[-0.03em] text-[var(--home-text)]">
            The numbers still matter. They’re just not the answer.
          </p>
        </div>

        <div className="rounded-sm border border-line bg-paper-raised p-6">
          <p className="home-mono text-[10px] font-bold tracking-[0.16em] text-[var(--home-text-3)] uppercase">
            Performance
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <p className="home-mono text-[4.2rem] leading-none tracking-[-0.08em] text-[var(--home-text)]">
              74
            </p>
            <p className="mb-1 text-[1.15rem] text-[var(--home-cta)]">↑ 8</p>
          </div>
          <p className="mt-2 text-[15px] text-[var(--home-text-2)]">Building</p>

          <p className="home-mono mt-8 text-[10px] font-bold tracking-[0.16em] text-[var(--home-text-3)] uppercase">
            Why
          </p>
          <dl className="mt-4 grid gap-4">
            {why.map((item) => (
              <div
                key={item.label}
                className="flex items-baseline justify-between gap-6 border-b border-[var(--home-border)] pb-3 last:border-b-0 last:pb-0"
              >
                <dt className="text-[14px] text-[var(--home-text-3)]">
                  {item.label}
                </dt>
                <dd className="text-[15px] font-medium text-[var(--home-text)]">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-[15px] leading-6 text-[var(--home-text-2)]">
            Capacity is rising while strain remains typical.
          </p>
          <Link
            href="#faq"
            className="mt-6 inline-flex text-[13px] text-[var(--home-text-3)] underline decoration-[var(--home-border)] underline-offset-4 hover:text-[var(--home-text)]"
          >
            How Performance works →
          </Link>
        </div>
      </div>
    </section>
  );
}
