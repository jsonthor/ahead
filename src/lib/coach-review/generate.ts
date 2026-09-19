import { formatTrainingMetric } from "@/lib/load/training-state";
import { chatModelReady, completeJson } from "@/lib/chat/model";
import {
  applyGeneratedReview,
  composeCoachReview,
} from "@/lib/coach-review/compose";
import type { ReviewPacket } from "@/lib/coach-review/packet";
import { formatRaceResult } from "@/lib/race-result/types";
import { daysSince } from "@/lib/coach-review/period";
import type { CoachReview } from "@/lib/coach-review/types";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";

type PreviousReview = Pick<
  CoachReview,
  | "title"
  | "periodStart"
  | "periodEnd"
  | "lessons"
  | "nextObjective"
  | "nextKeep"
  | "nextChange"
>;

function sessionBrief(row: { date: string; title: string; weekday: string; kind: string }) {
  return {
    date: row.date,
    title: row.title,
    weekday: row.weekday,
    kind: row.kind,
  };
}

function packetBrief(packet: ReviewPacket) {
  const near = packet.upcomingRaces.filter(
    (race) => daysSince(packet.periodEnd, race.date) <= 2,
  );
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
    specificTrend:
      packet.specificRawStart == null || packet.specificRawEnd == null
        ? "Unknown"
        : packet.specificRawEnd > packet.specificRawStart
          ? "Rising"
          : packet.specificRawEnd < packet.specificRawStart
            ? "Falling"
            : "Stable",
    aerobicTrend:
      packet.aerobicRawStart == null || packet.aerobicRawEnd == null
        ? "Unknown"
        : packet.aerobicRawEnd > packet.aerobicRawStart
          ? "Rising"
          : packet.aerobicRawEnd < packet.aerobicRawStart
            ? "Falling"
            : "Stable",
    performanceStart: packet.performanceStart.label,
    performanceEnd: packet.performanceEnd.label,
    performanceScore: packet.performanceEnd.score,
    directionStart: packet.directionStart.label,
    directionEnd: packet.directionEnd.label,
    racesInBlock: packet.races.map(sessionBrief),
    raceCount: packet.races.length,
    raceResults: packet.raceResults.map((row) => ({
      date: row.date,
      title: row.title,
      result: formatRaceResult(row),
      gap: row.gap,
      factor: row.factor,
      status: row.status,
    })),
    upcomingRaces: packet.upcomingRaces.map(sessionBrief),
    immediateRaces: near.map(sessionBrief),
    fixtures: packet.fixtures.map(sessionBrief),
    upcomingPlanned: packet.upcomingPlanned
      .filter((row) => row.kind === "club" || row.kind === "quality" || row.kind === "race")
      .map(sessionBrief),
    routeEvidence: packet.routeEvidence,
  };
}

const SYSTEM = `You are Ahead writing a monthly Coach Review. Do not fill a section merely because the schema contains it. Empty arrays and empty strings are allowed.

Use Specific capacity, Aerobic capacity, and Performance as modeled metrics. A rise in Specific or Aerobic capacity is training evidence, not race-performance evidence. Race results (place / field / gap / factor) are the competitive outcome. Do not infer placing or "raced well" from HR or pace. Repeated routes are supporting evidence between races. Do not issue Direction as a second verdict. If the packet still has a Direction label, treat it as legacy and prefer Performance. Do not assess starts, lap fade, technical execution, or race-execution quality. Missing results belong under unknown, not didnt. If nothing obviously went wrong, didnt is []. nextPriorities is always []. Immediate priority must be grounded, not slogans.

Return ONLY JSON with this shape:
{
  "objective": string,
  "happened": string,
  "didItWork": string,
  "worked": [{"title": string, "body": string}],
  "didnt": [{"title": string, "body": string}],
  "unknown": string,
  "lessons": string,
  "immediatePriority": string | null,
  "nextObjective": string,
  "nextKeep": string[],
  "nextChange": string[],
  "nextWatch": string[],
  "nextPriorities": string[]
}`;

async function writeReviewJson(input: {
  packet: ReturnType<typeof packetBrief> & {
    specificTrend: string;
    aerobicTrend: string;
    performanceEvidence: string;
  };
  previous: PreviousReview | null | undefined;
  accessToken?: string;
}) {
  const payload = {
    packet: input.packet,
    previousReview: input.previous
      ? {
          title: input.previous.title,
          periodStart: input.previous.periodStart,
          periodEnd: input.previous.periodEnd,
          lessons: input.previous.lessons,
          nextObjective: input.previous.nextObjective,
          nextKeep: input.previous.nextKeep,
          nextChange: input.previous.nextChange,
        }
      : null,
  };
  if (input.accessToken) {
    return writeViaPotentialAi(input.accessToken, payload);
  }
  if (chatModelReady()) {
    return completeJson({
      system: SYSTEM,
      user: JSON.stringify(payload),
    });
  }
  throw new Error("Coach Review needs Ask Ahead configured.");
}

async function writeViaPotentialAi(
  accessToken: string,
  payload: { packet: unknown; previousReview: unknown },
) {
  const response = await fetch(`${supabaseUrl()}/functions/v1/potential-ai`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      apikey: supabasePublishableKey(),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      mode: "coach-review",
      packet: payload.packet,
      previousReview: payload.previousReview,
    }),
  });
  const body = (await response.json().catch(() => null)) as {
    review?: Record<string, unknown>;
    message?: string;
  } | null;
  if (!response.ok || !body?.review) {
    throw new Error(body?.message || "Could not write the review.");
  }
  return body.review;
}

export async function generateCoachReview(input: {
  athleteId: string;
  packet: ReviewPacket;
  previous?: PreviousReview | null;
  accessToken?: string;
}) {
  const draft = composeCoachReview({
    athleteId: input.athleteId,
    packet: input.packet,
  });
  const generated = await writeReviewJson({
    packet: {
      ...packetBrief(input.packet),
      specificTrend: draft.specificTrend,
      aerobicTrend: draft.aerobicTrend,
      performanceEvidence: draft.performanceEvidence,
    },
    previous: input.previous,
    accessToken: input.accessToken,
  });
  return applyGeneratedReview(draft, generated);
}
