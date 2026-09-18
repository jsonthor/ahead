import { sportFromLabel } from "@/lib/ingest/sport";
import {
  numberText,
  parseXmlDate,
  streamFromTrack,
  tagAttr,
  tagText,
  type TrackPoint,
} from "@/lib/ingest/track";
import type { ParsedLapSummary } from "@/lib/fit/parse";
import type { ParsedFileWorkout } from "@/lib/ingest/gpx";

function bpm(inner: string) {
  return numberText(tagText(inner, ["Value"])) ?? numberText(tagText(inner, ["value"]));
}

function trackpoints(xml: string): TrackPoint[] {
  const points: TrackPoint[] = [];
  const re = /<(?:[\w.-]+:)?Trackpoint\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?Trackpoint>/gi;
  for (const match of xml.matchAll(re)) {
    const inner = match[1] ?? "";
    const time = parseXmlDate(tagText(inner, ["Time"]));
    if (!time) {
      continue;
    }
    const lat = numberText(tagText(inner, ["LatitudeDegrees"]));
    const lng = numberText(tagText(inner, ["LongitudeDegrees"]));
    const hrBlock = inner.match(
      /<(?:[\w.-]+:)?HeartRateBpm\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?HeartRateBpm>/i,
    )?.[1];
    const power =
      numberText(tagText(inner, ["Watts"])) ??
      numberText(inner.match(/<(?:[\w.-]+:)?Watts>([^<]+)/i)?.[1] ?? null);
    points.push({
      at: time,
      ...(lat == null ? {} : { lat }),
      ...(lng == null ? {} : { lng }),
      elevation: numberText(tagText(inner, ["AltitudeMeters"])) ?? undefined,
      hr: hrBlock ? Math.round(bpm(hrBlock) ?? 0) || undefined : undefined,
      cadence: numberText(tagText(inner, ["Cadence"])) ?? undefined,
      power: power == null ? undefined : Math.round(power),
      distanceM: numberText(tagText(inner, ["DistanceMeters"])) ?? undefined,
    });
  }
  return points;
}

export function parseTcxFile(xml: string, fileName: string): ParsedFileWorkout | null {
  const activityOpen = xml.match(/<(?:[\w.-]+:)?Activity\b([^>]*)>/i)?.[1] ?? "";
  const sportAttr = tagAttr(activityOpen, "Sport");
  const points = trackpoints(xml);
  const idTime = parseXmlDate(tagText(xml, ["Id"]));
  const started = points[0]?.at ?? idTime;
  if (!started) {
    return null;
  }
  const stats = streamFromTrack(points);
  const lapTime = numberText(tagText(xml, ["TotalTimeSeconds"]));
  const lapDistance = numberText(tagText(xml, ["DistanceMeters"]));
  const avgHrBlock = xml.match(
    /<(?:[\w.-]+:)?AverageHeartRateBpm\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?AverageHeartRateBpm>/i,
  )?.[1];
  const maxHrBlock = xml.match(
    /<(?:[\w.-]+:)?MaximumHeartRateBpm\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?MaximumHeartRateBpm>/i,
  )?.[1];
  const laps: ParsedLapSummary[] = [];
  const lapRe = /<(?:[\w.-]+:)?Lap\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?Lap>/gi;
  let lapIndex = 0;
  for (const match of xml.matchAll(lapRe)) {
    const inner = match[2] ?? "";
    laps.push({
      source_index: lapIndex,
      started_at: parseXmlDate(tagAttr(match[1] ?? "", "StartTime"))?.toISOString() ?? null,
      duration_seconds: numberText(tagText(inner, ["TotalTimeSeconds"])),
      distance_m: numberText(tagText(inner, ["DistanceMeters"])),
      avg_hr: bpm(
        inner.match(
          /<(?:[\w.-]+:)?AverageHeartRateBpm\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?AverageHeartRateBpm>/i,
        )?.[1] ?? "",
      ),
      avg_power: numberText(tagText(inner, ["Watts"])),
    });
    lapIndex += 1;
  }
  const duration = stats.durationSeconds ?? (lapTime == null ? null : Math.round(lapTime));
  return {
    sport: sportFromLabel(sportAttr ?? fileName),
    startedAt: started.toISOString(),
    durationSeconds: duration,
    elapsedSeconds: duration,
    movingSeconds: duration,
    distanceM: stats.distanceM ?? lapDistance,
    elevationM: stats.elevationM,
    avgHr: stats.avgHr ?? (avgHrBlock ? bpm(avgHrBlock) : null),
    maxHr: stats.maxHr ?? (maxHrBlock ? bpm(maxHrBlock) : null),
    avgPower: stats.avgPower,
    maxPower: stats.maxPower,
    avgCadence: stats.avgCadence,
    avgSpeedMps: stats.avgSpeedMps,
    stream: stats.stream,
    laps,
  };
}
