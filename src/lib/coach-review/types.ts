export type CoachReviewFinding = {
  title: string;
  body: string;
};

export type CoachReviewEvidence = {
  fitnessStart: number | null;
  fitnessEnd: number | null;
  directionStart: string | null;
  directionEnd: string | null;
  directionScoreStart: number | null;
  directionScoreEnd: number | null;
  aerobicRawStart: number | null;
  aerobicRawEnd: number | null;
  specificRawStart: number | null;
  specificRawEnd: number | null;
  trainingLoad: number;
  trainedDays: number;
  historyDays: number;
};

export type ReviewKind = "week" | "month";

export function reviewKind(review: Pick<CoachReview, "kind">): ReviewKind {
  return review.kind === "week" ? "week" : "month";
}

export type CoachReview = {
  id: string;
  athleteId: string;
  kind?: ReviewKind;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  completedAt: string;
  source?: "terra" | "compose";
  title: string;
  directionLabel: string;
  directionTrajectory: string | null;
  fitnessStart: number | null;
  fitnessEnd: number | null;
  specificTrend: string;
  aerobicTrend: string;
  races: number;
  performanceEvidence: string;
  objective: string;
  happened: string;
  didItWork: string;
  worked: CoachReviewFinding[];
  didnt: CoachReviewFinding[];
  unknown: string;
  lessons: string;
  immediatePriority?: string | null;
  nextObjective: string;
  nextKeep: string[];
  nextChange: string[];
  nextWatch: string[];
  nextPriorities: string[];
  evidence: CoachReviewEvidence;
};

export type CoachReviewState = {
  reviews: CoachReview[];
};
