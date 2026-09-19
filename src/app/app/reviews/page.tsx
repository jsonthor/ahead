import { CoachReviewHome } from "@/components/app/coach-review-home";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reviews — Ahead",
};

export default function ReviewsPage() {
  return <CoachReviewHome />;
}
