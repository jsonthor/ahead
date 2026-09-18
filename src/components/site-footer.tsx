import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <div>
          <p className="font-serif text-2xl text-ink">Ahead</p>
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted">
            A training calendar that remembers the athlete behind it. Ask
            about your history, then put the decision on the week.
          </p>
        </div>
        <Link
          href="/signup"
          className="inline-flex h-10 w-fit items-center rounded-sm border border-line px-4 text-sm text-ink hover:bg-paper-sunken"
        >
          Sign up
        </Link>
      </div>
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 pb-8 text-xs text-muted sm:flex-row sm:justify-between sm:px-6">
        <p>Not a medical device. Trend models, not diagnoses.</p>
        <p>Working name. Built for self-coached athletes first.</p>
      </div>
    </footer>
  );
}
