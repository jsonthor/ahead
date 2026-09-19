"use client";

import { useAppUser } from "@/components/app/app-shell";
import { formatDayRange, formatMonthName } from "@/lib/calendar";
import { loadTrainingHistoryDays } from "@/lib/coach-review/history";
import { nextReviewAvailability, todayInZone } from "@/lib/coach-review/period";
import { useCoachReviews } from "@/lib/coach-review/use-reviews";
import Link from "next/link";
import { useEffect, useState } from "react";

export function CoachReviewCard() {
  const user = useAppUser();
  const reviews = useCoachReviews(user.id);
  const today = todayInZone(user.timezone);
  const [historyDays, setHistoryDays] = useState<number | null>(null);

  useEffect(() => {
    void loadTrainingHistoryDays(user.id, today).then(setHistoryDays);
  }, [today, user.id]);

  if (reviews == null || historyDays == null) {
    return null;
  }

  const availability = nextReviewAvailability({
    athleteId: user.id,
    today,
    historyDays,
  });
  if (availability.status !== "ready") {
    return null;
  }

  return (
    <section className="mt-8 border border-line bg-paper-raised px-5 py-6">
      <p className="kicker">Coach Review</p>
      <h2 className="title mt-3 text-[2rem] text-ink">
        Your {formatMonthName(availability.period.end)} review is ready
      </h2>
      <p className="mt-3 text-sm text-ink-soft">
        {formatDayRange(availability.period.start, availability.period.end)}
        {availability.weeksSince
          ? ` · ${availability.weeksSince} weeks since the last review`
          : null}
      </p>
      <Link
        href="/app/reviews"
        className="mt-5 inline-flex h-11 items-center text-[0.9375rem] font-medium text-ink underline decoration-line decoration-2 underline-offset-6 hover:decoration-ink"
      >
        Start review →
      </Link>
    </section>
  );
}
