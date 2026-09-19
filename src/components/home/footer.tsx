export function HomeFooter() {
  return (
    <footer className="border-t border-[var(--home-border)]">
      <div className="mx-auto flex max-w-[1360px] flex-col gap-6 px-4 py-10 sm:flex-row sm:items-end sm:justify-between sm:px-6 lg:px-8">
        <div>
          <p className="text-[15px] font-medium tracking-tight text-[var(--home-text)]">
            Ahead
          </p>
          <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--home-text-3)]">
            Training analysis and planning for self-coached endurance athletes.
          </p>
        </div>
        <p className="home-mono text-[12px] tracking-[0.14em] text-[var(--home-text-3)] uppercase">
          getahead.fit
        </p>
      </div>
      <div className="mx-auto flex max-w-[1360px] flex-col gap-2 px-4 pb-8 text-[11px] tracking-wide text-[var(--home-text-3)] sm:flex-row sm:justify-between sm:px-6 lg:px-8">
        <p>Not a medical device. Trend models, not diagnoses.</p>
        <p>Built for self-coached athletes first.</p>
      </div>
    </footer>
  );
}
