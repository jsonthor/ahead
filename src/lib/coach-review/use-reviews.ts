"use client";

import {
  COACH_REVIEW_EVENT,
  hydrateCoachReviews,
  readCoachReviews,
} from "@/lib/coach-review/store";
import type { CoachReview } from "@/lib/coach-review/types";
import { useEffect, useState } from "react";

export function useCoachReviews(athleteId: string) {
  const [reviews, setReviews] = useState<CoachReview[] | null>(null);

  useEffect(() => {
    function refresh() {
      setReviews(readCoachReviews(athleteId).reviews);
    }
    refresh();
    void hydrateCoachReviews(athleteId).then(setReviews).catch(() => refresh());
    window.addEventListener(COACH_REVIEW_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(COACH_REVIEW_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [athleteId]);

  return reviews;
}
