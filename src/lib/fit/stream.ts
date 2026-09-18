import type { StreamPoint } from "@/lib/fit/parse";

export type StreamChannel = "hr" | "power" | "speed" | "cadence" | "elevation";

export function activityStreamPath(athleteId: string, sourceActivityId: string) {
  return `${athleteId}/${sourceActivityId}.json.gz`;
}

export function streamHasChannel(points: StreamPoint[], channel: StreamChannel) {
  return points.some((point) => point[channel] != null);
}

export function streamHasGps(points: StreamPoint[]) {
  return points.some((point) => point.lat != null && point.lng != null);
}

export function downsampleStream<T>(points: T[], maxPoints: number): T[] {
  if (points.length <= maxPoints) {
    return points;
  }
  const step = Math.ceil(points.length / maxPoints);
  const sampled = points.filter((_, index) => index % step === 0);
  const last = points[points.length - 1];
  if (last && sampled[sampled.length - 1] !== last) {
    sampled.push(last);
  }
  return sampled;
}

export function gpsTrack(points: StreamPoint[], maxPoints = 600) {
  const track = points.filter(
    (point): point is StreamPoint & { lat: number; lng: number } =>
      point.lat != null && point.lng != null,
  );
  return downsampleStream(track, maxPoints);
}

export function channelSeries(
  points: StreamPoint[],
  read: (point: StreamPoint) => number | null,
  maxPoints = 800,
) {
  const series: { t: number; y: number }[] = [];
  for (const point of points) {
    const y = read(point);
    if (y == null || !Number.isFinite(y)) {
      continue;
    }
    series.push({ t: point.t, y });
  }
  return downsampleStream(series, maxPoints);
}

export function seriesExtent(values: number[], pad = 0.06): [number, number] {
  if (values.length === 0) {
    return [0, 1];
  }
  const sorted = [...values].sort((a, b) => a - b);
  const low = sorted[Math.floor((sorted.length - 1) * 0.02)] ?? sorted[0];
  const high = sorted[Math.floor((sorted.length - 1) * 0.98)] ?? sorted[sorted.length - 1];
  if (low === high) {
    return [low - 1, high + 1];
  }
  const span = high - low;
  return [low - span * pad, high + span * pad];
}
