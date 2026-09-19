export function HomeFooter() {
  return (
    <footer className="border-t border-[var(--home-border)]">
      <div className="mx-auto grid max-w-[1470px] gap-6 px-4 py-10 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:px-6 lg:px-8">
        <p className="text-[17px] font-semibold tracking-tight text-[var(--home-text)]">
          Ahead
        </p>
        <p className="home-mono text-[10px] tracking-[0.16em] text-[var(--home-text-3)] uppercase">
          getahead.fit
        </p>
        <p className="text-[10px] text-[var(--home-text-3)] sm:justify-self-end">
          Not a medical device. Trend models, not diagnoses.
        </p>
      </div>
    </footer>
  );
}
