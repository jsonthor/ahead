import { sportFromLabel } from "@/lib/ingest/sport";
import {
  numberText,
  parseXmlDate,
  streamFromTrack,
  tagAttr,
  tagText,
  type TrackPoint,
} from "@/lib/ingest/track";
import type { ParsedLapSummary, StreamPoint } from "@/lib/fit/parse";
import type { WorkoutSport } from "@/lib/workout";

export type ParsedFileWorkout = {
  sport: WorkoutSport;
  startedAt: string;
  durationSeconds: number | null;
  elapsedSeconds: number | null;
  movingSeconds: number | null;
  distanceM: number | null;
  elevationM: number | null;
  avgHr: number | null;
  maxHr: number | null;
  avgPower: number | null;
  maxPower: number | null;
  avgCadence: number | null;
  avgSpeedMps: number | null;
  stream: StreamPoint[];
  laps: ParsedLapSummary[];
};

function pointFromTrkpt(open: string, inner: string): TrackPoint | null {
  const lat = numberText(tagAttr(open, "lat"));
  const lng = numberText(tagAttr(open, "lon"));
  const time = parseXmlDate(tagText(inner, ["time"]));
  if (!time) {
    return null;
  }
  const hr =
    numberText(tagText(inner, ["hr"])) ??
    numberText(inner.match(/<(?:[\w.-]+:)?hr(?:ate)?>([^<]+)/i)?.[1] ?? null);
  return {
    at: time,
    ...(lat == null ? {} : { lat }),
    ...(lng == null ? {} : { lng }),
    elevation: numberText(tagText(inner, ["ele"])) ?? undefined,
    hr: hr == null ? undefined : Math.round(hr),
    cadence: numberText(tagText(inner, ["cad"])) ?? undefined,
    power: numberText(tagText(inner, ["power"])) ?? undefined,
  };
}

export function parseGpxFile(xml: string, fileName: string): ParsedFileWorkout | null {
  const points: TrackPoint[] = [];
  const trkpt = /<(?:[\w.-]+:)?trkpt\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?trkpt>/gi;
  for (const match of xml.matchAll(trkpt)) {
    const point = pointFromTrkpt(match[1] ?? "", match[2] ?? "");
    if (point) {
      points.push(point);
    }
  }
  const started =
    points[0]?.at ??
    parseXmlDate(tagText(xml, ["time"]));
  if (!started) {
    return null;
  }
  const stats = streamFromTrack(points);
  const type = tagText(xml, ["type", "sport"]);
  return {
    sport: sportFromLabel(type ?? fileName),
    startedAt: started.toISOString(),
    durationSeconds: stats.durationSeconds,
    elapsedSeconds: stats.durationSeconds,
    movingSeconds: stats.durationSeconds,
    distanceM: stats.distanceM,
    elevationM: stats.elevationM,
    avgHr: stats.avgHr,
    maxHr: stats.maxHr,
    avgPower: stats.avgPower,
    maxPower: stats.maxPower,
    avgCadence: stats.avgCadence,
    avgSpeedMps: stats.avgSpeedMps,
    stream: stats.stream,
    laps: [],
  };
}
