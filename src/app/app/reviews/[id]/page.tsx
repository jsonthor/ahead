import { CoachReviewDetail } from "@/components/app/coach-review-detail";

export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CoachReviewDetail id={id} />;
}
