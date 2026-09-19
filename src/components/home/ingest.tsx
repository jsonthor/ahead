const sources = [
  { name: "COROS", status: "Live" },
  { name: "FIT uploads", status: "Live" },
  { name: "Garmin", status: "Coming" },
  { name: "Polar", status: "Coming" },
  { name: "Wahoo", status: "Coming" },
];

export function HomeIngest() {
  return (
    <section
      id="calendar"
      className="home-paper scroll-mt-24 px-4 py-24 sm:px-6 lg:px-8 lg:py-36"
    >
      <div className="mx-auto max-w-[1470px]">
        <div className="grid gap-10 lg:grid-cols-[1.25fr_0.75fr] lg:items-end lg:gap-20">
          <div>
            <p className="home-kicker">Bring the training you already do</p>
            <h2 className="home-display mt-8 text-[clamp(3.2rem,6.8vw,7rem)]">
              Your plan does not
              <span className="block">have to start here.</span>
            </h2>
          </div>
          <p className="max-w-md text-[18px] leading-[1.56] text-black/55">
            Club nights. Races. Coach-prescribed sessions. The 45 minutes you
            squeezed in because that was all you had. Ahead works around that.
          </p>
        </div>

        <ul className="mt-16 grid border-t border-black/15 sm:grid-cols-2 lg:grid-cols-5">
          {sources.map((item) => (
            <li
              key={item.name}
              className="flex min-h-[8rem] flex-col justify-between border-b border-black/15 px-4 py-5 lg:border-r lg:border-b-0 lg:last:border-r-0"
            >
              <p className="text-[1.4rem] tracking-[-0.04em]">{item.name}</p>
              <p
                className={`home-mono inline-flex w-fit rounded-full px-2.5 py-1 text-[8px] tracking-[0.14em] uppercase ${
                  item.status === "Live"
                    ? "bg-[#00e05a] text-[#04140a]"
                    : "bg-black/8 text-black/45"
                }`}
              >
                {item.status}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
