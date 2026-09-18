import { BRAND_MARKS } from "@/components/brands/marks";

const live = [
  { id: "coros" as const, name: "COROS", status: "Live" },
  { id: "fit" as const, name: "FIT uploads", status: "Live" },
];

const coming = [
  { id: "garmin" as const, name: "Garmin" },
  { id: "polar" as const, name: "Polar" },
  { id: "wahoo" as const, name: "Wahoo" },
];

export function HomeIngest() {
  return (
    <section
      id="calendar"
      className="scroll-mt-24 border-y border-[var(--home-border)] bg-[var(--home-bg-2)] px-4 py-24 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-[1360px]">
        <p className="home-mono text-[11px] tracking-[0.18em] text-[var(--home-text-3)] uppercase">
          Bring the training you already do
        </p>
        <h2 className="mt-4 max-w-[16ch] text-4xl leading-[0.94] font-medium tracking-[-0.045em] text-[var(--home-text)] sm:text-6xl">
          You don’t have to hand your training over to Ahead.
        </h2>
        <p className="mt-7 max-w-xl text-[17px] leading-7 text-[var(--home-text-2)] sm:text-[18px] sm:leading-8">
          Club nights. Races. Coach-prescribed sessions. Solo rides. Runs. The
          45-minute session you squeezed in because that was all you had.
        </p>
        <p className="mt-4 max-w-xl text-[17px] leading-7 text-[var(--home-text-2)] sm:text-[18px] sm:leading-8">
          Ahead works around the training you actually do.
        </p>

        <ul className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-6">
          {live.map((item) => {
            const Mark = BRAND_MARKS[item.id];
            return (
              <li key={item.id} className="flex items-center gap-3">
                <Mark width={28} height={28} className="h-7 w-7" />
                <span>
                  <span className="block text-[14px] text-[var(--home-text)]">
                    {item.name}
                  </span>
                  <span className="home-mono text-[11px] tracking-[0.14em] text-[var(--home-accent)] uppercase">
                    {item.status}
                  </span>
                </span>
              </li>
            );
          })}
          {coming.map((item) => {
            const Mark = BRAND_MARKS[item.id];
            return (
              <li key={item.id} className="flex items-center gap-3 opacity-45">
                <Mark width={28} height={28} className="h-7 w-7 grayscale" />
                <span>
                  <span className="block text-[14px] text-[var(--home-text)]">
                    {item.name}
                  </span>
                  <span className="home-mono text-[11px] tracking-[0.14em] text-[var(--home-text-3)] uppercase">
                    Coming
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-5 text-[13px] text-[var(--home-text-3)]">
          More integrations are on the way.
        </p>
      </div>
    </section>
  );
}
