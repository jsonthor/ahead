import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/database.types";
import {
  reviewKind,
  type CoachReview,
  type CoachReviewState,
  type ReviewKind,
} from "@/lib/coach-review/types";

export const COACH_REVIEW_EVENT = "ahead:coach-reviews";

function storageKey(athleteId: string) {
  return `ahead.coach-reviews.${athleteId}`;
}

function empty(): CoachReviewState {
  return { reviews: [] };
}

function notify() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(COACH_REVIEW_EVENT));
  }
}

function sortReviews(reviews: CoachReview[]) {
  return [...reviews].sort((left, right) => {
    const byEnd = right.periodEnd.localeCompare(left.periodEnd);
    if (byEnd !== 0) {
      return byEnd;
    }
    return right.completedAt.localeCompare(left.completedAt);
  });
}

function mergeReviews(local: CoachReview[], remote: CoachReview[]) {
  const byId = new Map<string, CoachReview>();
  for (const row of [...remote, ...local]) {
    const existing = byId.get(row.id);
    if (!existing || row.completedAt > existing.completedAt) {
      byId.set(row.id, row);
    }
  }
  return sortReviews([...byId.values()]);
}

export function readCoachReviews(athleteId: string): CoachReviewState {
  if (typeof window === "undefined") {
    return empty();
  }
  try {
    const raw = window.localStorage.getItem(storageKey(athleteId));
    if (!raw) {
      return empty();
    }
    const parsed = JSON.parse(raw) as CoachReviewState;
    return { reviews: Array.isArray(parsed.reviews) ? parsed.reviews : [] };
  } catch {
    return empty();
  }
}

export function writeCoachReviews(athleteId: string, state: CoachReviewState) {
  window.localStorage.setItem(
    storageKey(athleteId),
    JSON.stringify({ reviews: sortReviews(state.reviews) }),
  );
  notify();
}

function asReview(value: unknown): CoachReview | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as CoachReview;
  if (!row.id || !row.athleteId || !row.periodStart || !row.periodEnd) {
    return null;
  }
  return row;
}

export async function hydrateCoachReviews(athleteId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("coach_reviews")
    .select("review")
    .eq("athlete_id", athleteId)
    .order("period_end", { ascending: false });
  if (error) {
    console.error("Load coach reviews failed", error);
    return readCoachReviews(athleteId).reviews;
  }
  const remote = (data ?? [])
    .map((row) => asReview(row.review))
    .filter((row): row is CoachReview => Boolean(row));
  const local = readCoachReviews(athleteId).reviews;
  const merged = mergeReviews(local, remote);
  writeCoachReviews(athleteId, { reviews: merged });
  const missing = local.filter((row) => !remote.some((item) => item.id === row.id));
  await Promise.all(missing.map((review) => persistCoachReview(review)));
  return merged;
}

async function persistCoachReview(review: CoachReview) {
  const supabase = createClient();
  const { error } = await supabase.from("coach_reviews").upsert({
    id: review.id,
    athlete_id: review.athleteId,
    kind: reviewKind(review),
    period_start: review.periodStart,
    period_end: review.periodEnd,
    source: review.source ?? null,
    title: review.title,
    review: review as unknown as Json,
    created_at: review.createdAt,
    completed_at: review.completedAt,
  });
  if (error) {
    console.error("Save coach review failed", error);
    throw new Error("Could not save the review.");
  }
}

export async function saveCoachReview(athleteId: string, review: CoachReview) {
  const state = readCoachReviews(athleteId);
  writeCoachReviews(athleteId, {
    reviews: mergeReviews(state.reviews, [review]),
  });
  await persistCoachReview(review);
}

export function reviewsOfKind(athleteId: string, kind: ReviewKind) {
  return readCoachReviews(athleteId).reviews.filter((row) => reviewKind(row) === kind);
}

export function latestCoachReview(athleteId: string) {
  return reviewsOfKind(athleteId, "month")[0] ?? null;
}

export function latestWeeklyReview(athleteId: string) {
  return reviewsOfKind(athleteId, "week")[0] ?? null;
}

export function coachReviewById(athleteId: string, id: string) {
  return readCoachReviews(athleteId).reviews.find((row) => row.id === id) ?? null;
}
