import { addDaysToKey, dateKeyInZone, weekdayIndexFromKey } from "@/lib/calendar";
import { latestCoachReview, latestWeeklyReview } from "@/lib/coach-review/store";

export const COACH_REVIEW_DAYS = 28;
export const WEEKLY_REVIEW_DAYS = 7;

export function reviewPeriodEnding(end: string, days = COACH_REVIEW_DAYS) {
  return {
    start: addDaysToKey(end, -(days - 1)),
    end,
  };
}

export function weeklyPeriodEnding(end: string) {
  return reviewPeriodEnding(end, WEEKLY_REVIEW_DAYS);
}

function mondayOf(today: string) {
  return addDaysToKey(today, -weekdayIndexFromKey(today));
}

function daysUntilMonday(today: string) {
  const weekday = weekdayIndexFromKey(today);
  return weekday === 0 ? 0 : 7 - weekday;
}

export function currentTrainingWeek(today: string) {
  const monday = mondayOf(today);
  return {
    start: monday,
    end: addDaysToKey(monday, 6),
  };
}

export function lastCompleteTrainingWeek(today: string) {
  const monday = mondayOf(today);
  return {
    start: addDaysToKey(monday, -7),
    end: addDaysToKey(monday, -1),
  };
}

export function daysSince(from: string, to: string) {
  return Math.round(
    (Date.parse(`${to}T12:00:00.000Z`) - Date.parse(`${from}T12:00:00.000Z`)) /
      86_400_000,
  );
}

export function nextReviewAvailability(input: {
  athleteId: string;
  today: string;
  historyDays: number;
}) {
  const latest = latestCoachReview(input.athleteId);
  if (!latest) {
    if (input.historyDays < COACH_REVIEW_DAYS) {
      return {
        status: "waiting" as const,
        period: reviewPeriodEnding(input.today),
        daysUntil: COACH_REVIEW_DAYS - input.historyDays,
        weeksSince: null,
      };
    }
    return {
      status: "ready" as const,
      period: reviewPeriodEnding(input.today),
      daysUntil: 0,
      weeksSince: null,
    };
  }
  const elapsed = daysSince(latest.completedAt.slice(0, 10), input.today);
  if (elapsed < COACH_REVIEW_DAYS) {
    return {
      status: "waiting" as const,
      period: reviewPeriodEnding(input.today),
      daysUntil: COACH_REVIEW_DAYS - elapsed,
      weeksSince: Math.round(elapsed / 7),
    };
  }
  return {
    status: "ready" as const,
    period: {
      start: addDaysToKey(latest.periodEnd, 1),
      end: input.today,
    },
    daysUntil: 0,
    weeksSince: Math.max(4, Math.round(elapsed / 7)),
  };
}

export function nextWeeklyAvailability(input: {
  athleteId: string;
  today: string;
  historyDays: number;
}) {
  const weekday = weekdayIndexFromKey(input.today);
  const lastWeek = lastCompleteTrainingWeek(input.today);
  const thisWeek = currentTrainingWeek(input.today);
  const latest = latestWeeklyReview(input.athleteId);
  const alreadyHaveLastWeek = latest?.periodEnd === lastWeek.end;

  if (weekday !== 0 || alreadyHaveLastWeek) {
    return {
      status: "waiting" as const,
      period: thisWeek,
      daysUntil: weekday === 0 ? 7 : daysUntilMonday(input.today),
    };
  }

  if (input.historyDays < WEEKLY_REVIEW_DAYS) {
    return {
      status: "waiting" as const,
      period: lastWeek,
      daysUntil: WEEKLY_REVIEW_DAYS - input.historyDays,
    };
  }

  return {
    status: "ready" as const,
    period: lastWeek,
    daysUntil: 0,
  };
}

export function todayInZone(timeZone: string) {
  return dateKeyInZone(new Date(), timeZone);
}
