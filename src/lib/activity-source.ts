/**
 * Every completed activity carries a source. Ask Ahead, Fitness /
 * Fatigue / Form, and any derived insight may only see sources that
 * are intelligence-eligible.
 *
 * Strava API Policy (effective 1 June 2026):
 * - §5.3  no Strava data (or derivatives) in the operation of an AI
 *         application, including a model context window
 * - §5.4  no analytics / customer insights; do not combine Strava data
 *         with other customer data
 * - §5.5  no persistent index; 7-day cache only
 * - §3.5  Strava MCP is personal use, not a Potential integration
 * - §5.10 no transfer of Strava data to an AI application provider,
 *         even with the athlete's consent
 *
 * Until Strava grants written approval, `strava` is display-only.
 */

export const ACTIVITY_SOURCES = [
  "manual",
  "fit",
  "gpx",
  "tcx",
  "coros",
  "garmin",
  "apple",
  "wahoo",
  "polar",
  "suunto",
  "strava",
] as const;

export type ActivitySource = (typeof ACTIVITY_SOURCES)[number];

const INTELLIGENCE_BLOCKED: ReadonlySet<ActivitySource> = new Set(["strava"]);

export function isIntelligenceSource(source: ActivitySource): boolean {
  return !INTELLIGENCE_BLOCKED.has(source);
}

export function forIntelligence<T extends { source: ActivitySource }>(
  items: T[],
): T[] {
  return items.filter((item) => isIntelligenceSource(item.source));
}
