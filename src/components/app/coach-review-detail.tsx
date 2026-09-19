"use client";

import { useAppUser } from "@/components/app/app-shell";
import { formatDayRange } from "@/lib/calendar";
import {
  askAboutCoachReview,
  buildBlockHref,
  reviewAskDetail,
} from "@/lib/coach-review/ask";
import { coachReviewById } from "@/lib/coach-review/store";
import { reviewKind } from "@/lib/coach-review/types";
import { useCoachReviews } from "@/lib/coach-review/use-reviews";
import { formatTrainingMetric } from "@/lib/load/training-state";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function CoachReviewDetail({ id }: { id: string }) {
  const user = useAppUser();
  const router = useRouter();
  const reviews = useCoachReviews(user.id);
  const review = reviews ? coachReviewById(user.id, id) : null;

  useEffect(() => {
    if (reviews && !review) {
      router.replace("/app/reviews");
    }
  }, [review, reviews, router]);

  if (!review) {
    return (
      <main className="mx-auto max-w-[720px] px-4 py-16">
        <p className="text-sm text-muted">Opening review…</p>
      </main>
    );
  }

  const weekly = reviewKind(review) === "week";
  const fitness =
    review.fitnessStart != null && review.fitnessEnd != null
      ? `${formatTrainingMetric(review.fitnessStart)} → ${formatTrainingMetric(review.fitnessEnd)}`
      : "—";

  return (
    <main className="mx-auto max-w-[720px] px-4 py-12 sm:px-6 lg:px-8">
      <Link href="/app/reviews" className="text-sm text-ink-soft hover:text-ink">
        Reviews
      </Link>
      <p className="kicker mt-6">{weekly ? "Weekly review" : "Coach Review"}</p>
      <h1 className="title mt-3 text-ink">{review.title}</h1>
      <p className="mt-3 text-sm text-ink-soft">
        {formatDayRange(review.periodStart, review.periodEnd)}
      </p>

      <dl className="mt-8 grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-2">
        <Stat label="Direction" value={review.directionLabel} note={review.directionTrajectory} />
        <Stat label="Fitness" value={fitness} />
        <Stat label="Specific capacity" value={review.specificTrend} />
        <Stat label="Aerobic capacity" value={review.aerobicTrend} />
        <Stat label="Races / competition" value={String(review.races)} />
        <Stat label="Performance evidence" value={review.performanceEvidence} />
      </dl>

      {review.objective ? (
        <Article title="What were we trying to do?" body={review.objective} />
      ) : null}
      <Article title="What happened" body={review.happened} />
      {review.didItWork ? (
        <Article title="Did the block work?" body={review.didItWork} />
      ) : null}

      {review.worked.length > 0 ? (
        <section className="mt-10">
          <h2 className="title text-[2rem] text-ink">What worked</h2>
          <ul className="mt-5 grid gap-5">
            {review.worked.map((item) => (
              <li key={item.title}>
                <p className="text-sm font-medium text-ink">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-ink-soft">{item.body}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {review.didnt.length > 0 ? (
        <section className="mt-10">
          <h2 className="title text-[2rem] text-ink">What didn't</h2>
          <ul className="mt-5 grid gap-5">
            {review.didnt.map((item) => (
              <li key={item.title}>
                <p className="text-sm font-medium text-ink">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-ink-soft">{item.body}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {review.unknown ? (
        <Article title="What we don't know yet" body={review.unknown} />
      ) : null}
      {review.lessons && !weekly ? (
        <Article title="What did we learn?" body={review.lessons} />
      ) : null}

      {weekly ? (
        review.immediatePriority ? (
          <Article title="Coming days" body={review.immediatePriority} />
        ) : null
      ) : (
        <section className="mt-10 border border-line bg-paper-raised px-5 py-6">
          <h2 className="title text-[2rem] text-ink">Next block</h2>
          {review.immediatePriority ? (
            <>
              <p className="mt-4 text-sm font-medium text-ink">Immediate priority</p>
              <p className="mt-1 text-sm leading-6 text-ink-soft">{review.immediatePriority}</p>
            </>
          ) : null}
          {review.nextObjective ? (
            <>
              <p className="mt-4 text-sm font-medium text-ink">Next-block goal</p>
              <p className="mt-1 text-sm leading-6 text-ink-soft">{review.nextObjective}</p>
            </>
          ) : null}
          {review.nextKeep.length > 0 ? (
            <List label="Keep" items={review.nextKeep} />
          ) : null}
          {review.nextChange.length > 0 ? (
            <List label="Change" items={review.nextChange} />
          ) : null}
          {review.nextWatch.length > 0 ? (
            <List label="Watch" items={review.nextWatch} />
          ) : null}
        </section>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        {weekly ? null : (
          <Link
            href={buildBlockHref(review.id)}
            className="inline-flex h-11 items-center bg-forest px-5 text-[0.9375rem] font-medium text-[#04140a] hover:bg-forest-hover"
          >
            Build / update next block →
          </Link>
        )}
        <button
          type="button"
          className="inline-flex h-11 items-center border border-line px-5 text-[0.9375rem] font-medium text-ink hover:bg-paper-sunken"
          onClick={() =>
            askAboutCoachReview(
              reviewAskDetail(
                review,
                weekly ? "How did this week look?" : "Can we talk through this review?",
              ),
            )
          }
        >
          Ask about this review
        </button>
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string | null;
}) {
  return (
    <div className="bg-paper-raised px-5 py-5">
      <dt className="kicker">{label}</dt>
      <dd className="mt-2 text-sm font-medium text-ink">{value}</dd>
      {note ? <p className="mt-1 text-sm text-ink-soft">{note}</p> : null}
    </div>
  );
}

function Article({ title, body }: { title: string; body: string }) {
  return (
    <section className="mt-10">
      <h2 className="title text-[2rem] text-ink">{title}</h2>
      <p className="mt-4 text-sm leading-6 text-ink-soft">{body}</p>
    </section>
  );
}

function List({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="mt-5">
      <p className="text-sm font-medium text-ink">{label}</p>
      <ul className="mt-2 grid gap-1">
        {items.map((item) => (
          <li key={item} className="text-sm leading-6 text-ink-soft">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
