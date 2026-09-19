import {
  coachReviewById,
  reviewsOfKind,
} from "@/lib/coach-review/store";
import { reviewKind, type CoachReview } from "@/lib/coach-review/types";

export const COACH_REVIEW_ASK_EVENT = "ahead:ask-coach-review";
export const BUILD_REVIEW_PARAM = "buildReview";

export type CoachReviewFindingBrief = {
  title: string;
  body: string;
};

export type CoachReviewContext = {
  current: {
    reviewId: string;
    title: string;
    periodStart: string;
    periodEnd: string;
    directionLabel: string;
    specificTrend: string;
    aerobicTrend: string;
    races: number;
    objective: string;
    happened: string;
    didItWork: string;
    worked: CoachReviewFindingBrief[];
    didnt: CoachReviewFindingBrief[];
    unknown: string;
    lessons: string;
    immediatePriority: string | null;
    nextObjective: string;
    nextKeep: string[];
    nextChange: string[];
    nextWatch: string[];
  } | null;
  previous: {
    title: string;
    periodStart: string;
    periodEnd: string;
    lessons: string;
    nextObjective: string;
  }[];
  latestWeek: {
    title: string;
    periodStart: string;
    periodEnd: string;
    happened: string;
    lessons: string;
    immediatePriority: string | null;
  } | null;
};

export type CoachReviewAskDetail = CoachReviewContext & {
  message: string;
};

let focusedId: string | null = null;

export function setCoachReviewSelection(reviewId: string | null) {
  focusedId = reviewId;
}

export function getCoachReviewSelection() {
  return focusedId;
}

function monthBrief(review: CoachReview) {
  return {
    reviewId: review.id,
    title: review.title,
    periodStart: review.periodStart,
    periodEnd: review.periodEnd,
    directionLabel: review.directionLabel,
    specificTrend: review.specificTrend,
    aerobicTrend: review.aerobicTrend,
    races: review.races,
    objective: review.objective,
    happened: review.happened,
    didItWork: review.didItWork,
    worked: review.worked,
    didnt: review.didnt,
    unknown: review.unknown,
    lessons: review.lessons,
    immediatePriority: review.immediatePriority ?? null,
    nextObjective: review.nextObjective,
    nextKeep: review.nextKeep,
    nextChange: review.nextChange,
    nextWatch: review.nextWatch,
  };
}

export function coachReviewContext(athleteId: string): CoachReviewContext {
  const months = reviewsOfKind(athleteId, "month");
  const weeks = reviewsOfKind(athleteId, "week");
  const focused = focusedId ? coachReviewById(athleteId, focusedId) : null;
  const current =
    focused && reviewKind(focused) === "month"
      ? focused
      : (months[0] ?? null);
  const latestWeek =
    focused && reviewKind(focused) === "week"
      ? focused
      : (weeks[0] ?? null);
  return {
    current: current ? monthBrief(current) : null,
    previous: months
      .filter((row) => row.id !== current?.id)
      .slice(0, 3)
      .map((row) => ({
        title: row.title,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
        lessons: row.lessons,
        nextObjective: row.nextObjective,
      })),
    latestWeek: latestWeek
      ? {
          title: latestWeek.title,
          periodStart: latestWeek.periodStart,
          periodEnd: latestWeek.periodEnd,
          happened: latestWeek.happened,
          lessons: latestWeek.lessons,
          immediatePriority: latestWeek.immediatePriority ?? null,
        }
      : null,
  };
}

export function askAboutCoachReview(detail: { reviewId: string; message: string }) {
  setCoachReviewSelection(detail.reviewId);
  window.dispatchEvent(
    new CustomEvent(COACH_REVIEW_ASK_EVENT, {
      detail: { message: detail.message },
    }),
  );
}

export function reviewAskDetail(review: CoachReview, message: string) {
  return {
    reviewId: review.id,
    message,
  };
}

export function buildBlockMessage() {
  return "Build the next 4 weeks from the Coach Review.";
}

export function buildBlockHref(reviewId: string) {
  return `/app/activities?${BUILD_REVIEW_PARAM}=${reviewId}`;
}
