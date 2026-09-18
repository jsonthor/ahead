import { downsampleStream } from "@/lib/fit/stream";
import type { StreamPoint } from "@/lib/fit/parse";

export type TrackPoint = {
  at: Date;
  lat?: number;
  lng?: number;
  elevation?: number;
  hr?: number;
  power?: number;
  cadence?: number;
  distanceM?: number;
};

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(Math.min(1, a)));
}

export function streamFromTrack(points: TrackPoint[]): {
  stream: StreamPoint[];
  distanceM: number | null;
  elevationM: number | null;
  avgHr: number | null;
  maxHr: number | null;
  avgPower: number | null;
  maxPower: number | null;
  avgCadence: number | null;
  avgSpeedMps: number | null;
  durationSeconds: number | null;
} {
  if (points.length === 0) {
    return {
      stream: [],
      distanceM: null,
      elevationM: null,
      avgHr: null,
      maxHr: null,
      avgPower: null,
      maxPower: null,
      avgCadence: null,
      avgSpeedMps: null,
      durationSeconds: null,
    };
  }
  const origin = points[0].at.getTime();
  const stream: StreamPoint[] = [];
  let distance = 0;
  let climb = 0;
  let hrSum = 0;
  let hrCount = 0;
  let maxHr = 0;
  let powerSum = 0;
  let powerCount = 0;
  let maxPower = 0;
  let cadenceSum = 0;
  let cadenceCount = 0;
  let lastGps: { lat: number; lng: number } | null = null;
  let lastEle: number | null = null;
  for (const point of points) {
    if (point.distanceM != null && Number.isFinite(point.distanceM)) {
      distance = Math.max(distance, point.distanceM);
    } else if (
      point.lat != null &&
      point.lng != null &&
      lastGps
    ) {
      distance += haversine(lastGps.lat, lastGps.lng, point.lat, point.lng);
    }
    if (point.lat != null && point.lng != null) {
      lastGps = { lat: point.lat, lng: point.lng };
    }
    if (point.elevation != null && lastEle != null) {
      const delta = point.elevation - lastEle;
      if (delta > 0.4) {
        climb += delta;
      }
    }
    if (point.elevation != null) {
      lastEle = point.elevation;
    }
    if (point.hr != null) {
      hrSum += point.hr;
      hrCount += 1;
      maxHr = Math.max(maxHr, point.hr);
    }
    if (point.power != null) {
      powerSum += point.power;
      powerCount += 1;
      maxPower = Math.max(maxPower, point.power);
    }
    if (point.cadence != null) {
      cadenceSum += point.cadence;
      cadenceCount += 1;
    }
    const t = Math.max(0, Math.round((point.at.getTime() - origin) / 1000));
    stream.push({
      t,
      ...(point.hr == null ? {} : { hr: point.hr }),
      ...(point.power == null ? {} : { power: point.power }),
      ...(point.cadence == null ? {} : { cadence: point.cadence }),
      ...(point.elevation == null ? {} : { elevation: point.elevation }),
      ...(point.lat == null || point.lng == null ? {} : { lat: point.lat, lng: point.lng }),
    });
  }
  const durationSeconds = Math.max(
    0,
    Math.round((points[points.length - 1].at.getTime() - origin) / 1000),
  );
  return {
    stream: downsampleStream(stream, 4000),
    distanceM: distance > 0 ? Math.round(distance * 10) / 10 : null,
    elevationM: climb > 0 ? Math.round(climb) : null,
    avgHr: hrCount ? Math.round(hrSum / hrCount) : null,
    maxHr: hrCount ? maxHr : null,
    avgPower: powerCount ? Math.round(powerSum / powerCount) : null,
    maxPower: powerCount ? maxPower : null,
    avgCadence: cadenceCount ? Math.round(cadenceSum / cadenceCount) : null,
    avgSpeedMps:
      distance > 0 && durationSeconds > 0 ? distance / durationSeconds : null,
    durationSeconds: durationSeconds > 0 ? durationSeconds : null,
  };
}

export function parseXmlDate(value: string | null | undefined): Date | null {
  if (!value?.trim()) {
    return null;
  }
  const date = new Date(value.trim());
  return Number.isNaN(date.getTime()) ? null : date;
}

export function tagText(xml: string, names: string[]) {
  for (const name of names) {
    const match = xml.match(
      new RegExp(`<(?:[\\w.-]+:)?${name}(?:\\s[^>]*)?>([^<]*)<\\/(?:[\\w.-]+:)?${name}>`, "i"),
    );
    if (match?.[1]?.trim()) {
      return match[1].trim();
    }
  }
  return null;
}

export function tagAttr(open: string, name: string) {
  const match =
    open.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i")) ??
    open.match(new RegExp(`${name}\\s*=\\s*'([^']*)'`, "i"));
  return match?.[1] ?? null;
}

export function numberText(value: string | null) {
  if (!value) {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
