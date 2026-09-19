"use client";

import { useAppUser } from "@/components/app/app-shell";
import { formatDayRange, formatDayShort } from "@/lib/calendar";
import { loadTrainingHistoryDays } from "@/lib/coach-review/history";
import {
  nextReviewAvailability,
  nextWeeklyAvailability,
  todayInZone,
} from "@/lib/coach-review/period";
import { startCoachReview, startWeeklyReview } from "@/lib/coach-review/start";
import { reviewsOfKind } from "@/lib/coach-review/store";
import { useCoachReviews } from "@/lib/coach-review/use-reviews";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function CoachReviewHome() {
  const user = useAppUser();
  const router = useRouter();
  const reviews = useCoachReviews(user.id);
  const today = todayInZone(user.timezone);
  const [historyDays, setHistoryDays] = useState<number | null>(null);
  const [starting, setStarting] = useState<"week" | "month" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadTrainingHistoryDays(user.id, today).then(setHistoryDays);
  }, [today, user.id]);

  const weekly =
    historyDays == null
      ? null
      : nextWeeklyAvailability({
          athleteId: user.id,
          today,
          historyDays,
        });
  const monthly =
    historyDays == null
      ? null
      : nextReviewAvailability({
          athleteId: user.id,
          today,
          historyDays,
        });
  const weekReviews = reviews ? reviewsOfKind(user.id, "week") : [];
  const monthReviews = reviews ? reviewsOfKind(user.id, "month") : [];
  const latestWeek = weekReviews[0] ?? null;
  const latestMonth = monthReviews[0] ?? null;
  const earlierMonths = monthReviews.slice(1);

  async function startWeek(replaceId?: string, periodStart?: string, periodEnd?: string) {
    if (starting) {
      return;
    }
    setStarting("week");
    setError(null);
    try {
      const review = await startWeeklyReview({
        athleteId: user.id,
        timeZone: user.timezone,
        today,
        historyDays: historyDays ?? 0,
        periodStart,
        periodEnd,
        replaceId,
      });
      router.push(`/app/reviews/${review.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not write the week.");
      setStarting(null);
    }
  }

  async function startMonth() {
    if (!monthly || monthly.status !== "ready" || starting) {
      return;
    }
    setStarting("month");
    setError(null);
    try {
      const review = await startCoachReview({
        athleteId: user.id,
        timeZone: user.timezone,
        today,
        historyDays: historyDays ?? 0,
      });
      router.push(`/app/reviews/${review.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start the review.");
      setStarting(null);
    }
  }

  return (
    <main className="mx-auto max-w-[720px] px-4 py-12 sm:px-6 lg:px-8">
      <p className="kicker">Reviews</p>
      <h1 className="title mt-3 text-ink">Reviews</h1>
      <p className="lede mt-3 max-w-xl">
        A weekly note on what landed. A Coach Review when it's time to set the
        next block.
      </p>

      <section className="mt-10 border border-line bg-paper-raised px-5 py-6">
        <p className="kicker">This week</p>
        {weekly == null ? (
          <p className="mt-3 text-sm text-muted">Checking history…</p>
        ) : weekly.status === "ready" ? (
          <>
            <p className="mt-3 text-sm font-medium text-ink">Ready</p>
            <p className="mt-1 text-sm text-ink-soft">
              {formatDayRange(weekly.period.start, weekly.period.end)}
            </p>
            <p className="mt-2 text-sm text-ink-soft">
              A short read of the last seven days. Load, Performance, and capacity
              — not a new block plan.
            </p>
            <button
              type="button"
              className="mt-5 inline-flex h-11 items-center border border-line px-5 text-[0.9375rem] font-medium text-ink hover:bg-paper-sunken disabled:opacity-50"
              disabled={Boolean(starting)}
              onClick={() => void startWeek()}
            >
              {starting === "week" ? "Reading the week…" : "Read this week"}
            </button>
            {latestWeek ? (
              <p className="mt-3">
                <Link
                  href={`/app/reviews/${latestWeek.id}`}
                  className="text-sm text-ink-soft underline decoration-line underline-offset-4 hover:text-ink"
                >
                  Last week
                </Link>
              </p>
            ) : null}
          </>
        ) : latestWeek ? (
          <>
            <p className="mt-3 text-sm text-muted">{formatDayShort(latestWeek.periodEnd)}</p>
            <p className="mt-2 text-sm leading-6 text-ink-soft">{latestWeek.happened}</p>
            <div className="mt-5 flex flex-wrap items-center gap-4">
              <Link
                href={`/app/reviews/${latestWeek.id}`}
                className="text-sm font-medium text-ink underline decoration-line decoration-2 underline-offset-6 hover:decoration-ink"
              >
                View week
              </Link>
              <button
                type="button"
                className="text-sm text-ink-soft hover:text-ink disabled:opacity-50"
                disabled={Boolean(starting)}
                onClick={() =>
                  void startWeek(
                    latestWeek.id,
                    latestWeek.periodStart,
                    latestWeek.periodEnd,
                  )
                }
              >
                {starting === "week" ? "Reading the week…" : "Read this week again"}
              </button>
            </div>
            <p className="mt-3 text-sm text-ink-soft">
              Weekly notes land on Monday, after the week closes.
              {weekly.daysUntil > 0
                ? ` ${weekly.daysUntil} day${weekly.daysUntil === 1 ? "" : "s"} to go.`
                : null}
            </p>
          </>
        ) : (
          <p className="mt-3 text-sm text-ink-soft">
            Weekly notes land on Monday, after Sunday closes.
            {weekly.daysUntil > 0
              ? ` ${weekly.daysUntil} day${weekly.daysUntil === 1 ? "" : "s"} to go.`
              : null}
          </p>
        )}
      </section>

      <section className="mt-8 border border-line bg-paper-raised px-5 py-6">
        <p className="kicker">Coach Review</p>
        {monthly == null ? (
          <p className="mt-3 text-sm text-muted">Checking history…</p>
        ) : monthly.status === "ready" ? (
          <>
            <p className="mt-3 text-sm font-medium text-ink">Available now</p>
            <p className="mt-1 text-sm text-ink-soft">
              {formatDayRange(monthly.period.start, monthly.period.end)}
            </p>
            <p className="mt-2 text-sm text-ink-soft">
              Sit down with the last block and decide what the next four weeks
              are for.
            </p>
            <button
              type="button"
              className="mt-5 inline-flex h-11 items-center bg-forest px-5 text-[0.9375rem] font-medium text-[#04140a] hover:bg-forest-hover disabled:opacity-50"
              disabled={Boolean(starting)}
              onClick={() => void startMonth()}
            >
              {starting === "month" ? "Writing the review…" : "Start Coach Review"}
            </button>
            {starting === "month" ? (
              <p className="mt-2 text-sm text-ink-soft">
                This usually takes about a minute.
              </p>
            ) : null}
          </>
        ) : (
          <>
            <p className="mt-3 text-sm font-medium text-ink">Not yet</p>
            <p className="mt-2 text-sm text-ink-soft">
              {latestMonth
                ? `A Coach Review is available about four weeks after the last one. ${monthly.daysUntil} days to go.`
                : `Available after ${monthly.daysUntil} more day${monthly.daysUntil === 1 ? "" : "s"} of usable training history.`}
            </p>
          </>
        )}
      </section>

      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

      {latestMonth ? (
        <section className="mt-8 border border-line bg-paper-raised px-5 py-6">
          <p className="text-sm text-muted">
            {formatDayRange(latestMonth.periodStart, latestMonth.periodEnd)}
          </p>
          <h2 className="title mt-2 text-[2rem] text-ink">{latestMonth.title}</h2>
          <p className="mt-4 text-sm font-medium text-ink">Main lesson</p>
          <p className="mt-1 text-sm leading-6 text-ink-soft">{latestMonth.lessons}</p>
          <p className="mt-4 text-sm font-medium text-ink">Next-block objective</p>
          <p className="mt-1 text-sm leading-6 text-ink-soft">{latestMonth.nextObjective}</p>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <Link
              href={`/app/reviews/${latestMonth.id}`}
              className="inline-flex text-sm font-medium text-ink underline decoration-line decoration-2 underline-offset-6 hover:decoration-ink"
            >
              View review
            </Link>
            <button
              type="button"
              className="text-sm text-ink-soft hover:text-ink disabled:opacity-50"
              disabled={Boolean(starting)}
              onClick={() => {
                setStarting("month");
                setError(null);
                void startCoachReview({
                  athleteId: user.id,
                  timeZone: user.timezone,
                  today,
                  historyDays: historyDays ?? 0,
                  periodStart: latestMonth.periodStart,
                  periodEnd: latestMonth.periodEnd,
                  replaceId: latestMonth.id,
                })
                  .then((review) => router.push(`/app/reviews/${review.id}`))
                  .catch((caught) => {
                    setError(
                      caught instanceof Error ? caught.message : "Could not reread the block.",
                    );
                    setStarting(null);
                  });
              }}
            >
              {starting === "month" ? "Writing the review…" : "Read this block again"}
            </button>
            {starting === "month" ? (
              <p className="mt-2 w-full text-sm text-ink-soft">
                This usually takes about a minute.
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {earlierMonths.length > 0 ? (
        <section className="mt-10">
          <p className="kicker">Previous Coach Reviews</p>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {earlierMonths.map((review) => (
              <li key={review.id}>
                <Link
                  href={`/app/reviews/${review.id}`}
                  className="flex items-baseline justify-between gap-4 py-3 text-sm hover:bg-paper-sunken"
                >
                  <span className="text-muted">
                    {formatDayRange(review.periodStart, review.periodEnd)}
                  </span>
                  <span className="min-w-0 flex-1 text-ink">{review.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
