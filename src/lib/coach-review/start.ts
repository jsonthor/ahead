import { invokeCoachReview } from "@/lib/chat/edge";
import {
  applyGeneratedReview,
  composeCoachReview,
  composeWeeklyReview,
} from "@/lib/coach-review/compose";
import { loadReviewPacket, type ReviewPacket } from "@/lib/coach-review/packet";
import { daysSince, nextReviewAvailability, nextWeeklyAvailability } from "@/lib/coach-review/period";
import { readCoachReviews, saveCoachReview } from "@/lib/coach-review/store";
import { reviewKind } from "@/lib/coach-review/types";
import { formatTrainingMetric } from "@/lib/load/training-state";

function sessionBrief(row: { date: string; title: string; weekday: string; kind: string }) {
  return {
    date: row.date,
    title: row.title,
    weekday: row.weekday,
    kind: row.kind,
  };
}

function packetBrief(packet: ReviewPacket, draft: ReturnType<typeof composeCoachReview>) {
  return {
    periodStart: packet.periodStart,
    periodEnd: packet.periodEnd,
    nextStart: packet.nextStart,
    nextEnd: packet.nextEnd,
    trainedDays: packet.trainedDays,
    trainingLoad: Math.round(packet.trainingLoad),
    fitnessStart:
      packet.fitnessStart == null ? null : formatTrainingMetric(packet.fitnessStart),
    fitnessEnd: packet.fitnessEnd == null ? null : formatTrainingMetric(packet.fitnessEnd),
    specificTrend: draft.specificTrend,
    aerobicTrend: draft.aerobicTrend,
    performanceEvidence: draft.performanceEvidence,
    directionStart: packet.directionStart.label,
    directionEnd: packet.directionEnd.label,
    directionTrajectory: packet.directionEnd.trajectoryLabel,
    racesInBlock: packet.races.map(sessionBrief),
    raceCount: packet.races.length,
    upcomingRaces: packet.upcomingRaces.map(sessionBrief),
    immediateRaces: packet.upcomingRaces
      .filter((race) => daysSince(packet.periodEnd, race.date) <= 2)
      .map(sessionBrief),
    fixtures: packet.fixtures.map(sessionBrief),
    upcomingPlanned: packet.upcomingPlanned
      .filter((row) => row.kind === "club" || row.kind === "quality" || row.kind === "race")
      .map(sessionBrief),
    seasonRaces: packet.seasonRaces.map(sessionBrief),
    goals: packet.goals,
    routeEvidence: packet.routeEvidence,
  };
}

export async function startCoachReview(input: {
  athleteId: string;
  timeZone: string;
  today: string;
  historyDays: number;
  periodStart?: string;
  periodEnd?: string;
  replaceId?: string;
}) {
  const availability = nextReviewAvailability({
    athleteId: input.athleteId,
    today: input.today,
    historyDays: input.historyDays,
  });
  const periodStart = input.periodStart ?? availability.period.start;
  const periodEnd = input.periodEnd ?? availability.period.end;
  const previous = readCoachReviews(input.athleteId).reviews.find(
    (row) => reviewKind(row) === "month" && row.id !== input.replaceId,
  );
  const packet = await loadReviewPacket({
    athleteId: input.athleteId,
    timeZone: input.timeZone,
    periodStart,
    periodEnd,
  });
  const draft = composeCoachReview({
    athleteId: input.athleteId,
    packet,
  });
  const generated = await invokeCoachReview({
    packet: packetBrief(packet, draft),
    previousReview: previous
      ? {
          title: previous.title,
          periodStart: previous.periodStart,
          periodEnd: previous.periodEnd,
          lessons: previous.lessons,
          nextObjective: previous.nextObjective,
          nextKeep: previous.nextKeep,
          nextChange: previous.nextChange,
        }
      : null,
  });
  const review = applyGeneratedReview(draft, generated);
  if (review.source !== "terra") {
    throw new Error("Coach Review did not use the coaching model.");
  }
  if (input.replaceId) {
    review.id = input.replaceId;
  }
  saveCoachReview(input.athleteId, review);
  return review;
}

export async function startWeeklyReview(input: {
  athleteId: string;
  timeZone: string;
  today: string;
  historyDays: number;
  periodStart?: string;
  periodEnd?: string;
  replaceId?: string;
}) {
  const availability = nextWeeklyAvailability({
    athleteId: input.athleteId,
    today: input.today,
    historyDays: input.historyDays,
  });
  const packet = await loadReviewPacket({
    athleteId: input.athleteId,
    timeZone: input.timeZone,
    periodStart: input.periodStart ?? availability.period.start,
    periodEnd: input.periodEnd ?? availability.period.end,
  });
  const review = composeWeeklyReview({
    athleteId: input.athleteId,
    packet,
  });
  if (input.replaceId) {
    review.id = input.replaceId;
  }
  saveCoachReview(input.athleteId, review);
  return review;
}
