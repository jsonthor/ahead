export function HomeSession() {
  return (
    <section
      id="product"
      className="home-paper scroll-mt-24 px-4 py-24 sm:px-6 lg:px-8 lg:py-32"
    >
      <div className="mx-auto grid max-w-[1470px] gap-16 lg:grid-cols-[1fr_28rem] lg:items-start lg:gap-24">
        <div>
          <p className="home-kicker">After the session</p>
          <h2 className="home-display mt-8 max-w-[13ch] text-[clamp(3.2rem,6.8vw,7.2rem)]">
            Every workout should tell you something.
          </h2>
          <p className="mt-8 max-w-xl text-[18px] leading-[1.55] text-black/55">
            Ahead looks at what was planned, what actually happened and where
            the session sits in the rest of your training.
          </p>
          <p className="mt-5 max-w-xl text-[18px] leading-[1.55] text-black/55">
            Not another activity summary. An explanation of whether the session
            did the job it was there to do.
          </p>
        </div>

        <article className="border border-black/10 bg-white p-6 shadow-[0_18px_40px_rgba(10,11,10,0.06)]">
          <p className="text-[15px] font-medium tracking-[-0.02em]">
            Pre-race opener
          </p>
          <p className="home-mono mt-1 text-[11px] text-black/40">
            22:24 · 4.3 mi
          </p>
          <h3 className="mt-5 text-[1.35rem] leading-snug tracking-[-0.03em]">
            The opener ran harder than planned.
          </h3>
          <p className="mt-3 text-[14px] leading-6 text-black/55">
            Duration stayed within the prescription, but heart rate remained
            close to threshold for much of the ride. Strong wind may have
            contributed. There was no power data, so the short pickups cannot be
            verified independently.
          </p>
          <div className="mt-6 border-t border-black/8 pt-4">
            <p className="home-mono text-[10px] font-bold tracking-[0.16em] text-black/40 uppercase">
              For tomorrow
            </p>
            <p className="mt-2 text-[14px] leading-6 text-[#0a0b0a]">
              No more training today. Keep the race warm-up short and familiar.
            </p>
          </div>
          <p className="mt-5 text-[13px] text-black/45">
            Ask about this session
          </p>
        </article>
      </div>
    </section>
  );
}
