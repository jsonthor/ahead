export function activityInsightEligible(input: {
  durationSeconds: number | null;
  linkedToPlan: boolean;
  race: boolean;
}) {
  if (input.race || input.linkedToPlan) {
    return true;
  }
  return (input.durationSeconds ?? 0) >= 10 * 60;
}

export function isRecentActivity(startedAt: string, now = new Date()) {
  const started = Date.parse(startedAt);
  if (!Number.isFinite(started)) {
    return false;
  }
  return now.getTime() - started <= 48 * 60 * 60 * 1000;
}
