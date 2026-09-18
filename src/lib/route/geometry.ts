export type LatLng = { lat: number; lng: number };

export type RouteBBox = {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
};

export const ROUTE_POINT_COUNT = 100;
export const CORRIDOR_M = 40;
export const OVERLAP_MIN = 0.9;
export const DIRECTION_M = 100;
export const CANDIDATE_NEAR_M = 500;
export const DISTANCE_TOLERANCE = 0.07;

const METERS_PER_DEG_LAT = 110540;

export function haversineMeters(a: LatLng, b: LatLng) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sin =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(Math.min(1, sin)));
}

export function bboxOf(points: LatLng[]): RouteBBox | null {
  const first = points[0];
  if (!first) {
    return null;
  }
  let minLat = first.lat;
  let maxLat = first.lat;
  let minLng = first.lng;
  let maxLng = first.lng;
  for (const point of points) {
    minLat = Math.min(minLat, point.lat);
    maxLat = Math.max(maxLat, point.lat);
    minLng = Math.min(minLng, point.lng);
    maxLng = Math.max(maxLng, point.lng);
  }
  return { minLat, minLng, maxLat, maxLng };
}

export function bboxOverlaps(a: RouteBBox, b: RouteBBox) {
  return a.minLat <= b.maxLat && a.maxLat >= b.minLat && a.minLng <= b.maxLng && a.maxLng >= b.minLng;
}

export function resampleByDistance(points: LatLng[], count = ROUTE_POINT_COUNT): LatLng[] {
  const clean = points.filter(
    (point) => Number.isFinite(point.lat) && Number.isFinite(point.lng),
  );
  if (clean.length < 2 || count < 2) {
    return [];
  }
  const cum = [0];
  for (let i = 1; i < clean.length; i += 1) {
    const prev = clean[i - 1];
    const next = clean[i];
    if (!prev || !next) {
      continue;
    }
    cum.push((cum[i - 1] ?? 0) + haversineMeters(prev, next));
  }
  const total = cum[cum.length - 1] ?? 0;
  if (total < 50) {
    return [];
  }
  const sampled: LatLng[] = [];
  let cursor = 0;
  for (let i = 0; i < count; i += 1) {
    const target = (total * i) / (count - 1);
    while (cursor < cum.length - 2 && (cum[cursor + 1] ?? 0) < target) {
      cursor += 1;
    }
    const startDist = cum[cursor] ?? 0;
    const endDist = cum[cursor + 1] ?? startDist;
    const start = clean[cursor];
    const end = clean[cursor + 1] ?? start;
    if (!start || !end) {
      continue;
    }
    const span = endDist - startDist;
    const t = span > 0 ? (target - startDist) / span : 0;
    sampled.push({
      lat: start.lat + (end.lat - start.lat) * t,
      lng: start.lng + (end.lng - start.lng) * t,
    });
  }
  return sampled.length === count ? sampled : [];
}

function metersPerDegLng(lat: number) {
  return Math.max(30, METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));
}

function pointToSegmentMeters(point: LatLng, a: LatLng, b: LatLng) {
  const mx = metersPerDegLng((a.lat + b.lat) / 2);
  const ax = a.lng * mx;
  const ay = a.lat * METERS_PER_DEG_LAT;
  const bx = b.lng * mx;
  const by = b.lat * METERS_PER_DEG_LAT;
  const px = point.lng * mx;
  const py = point.lat * METERS_PER_DEG_LAT;
  const dx = bx - ax;
  const dy = by - ay;
  const length2 = dx * dx + dy * dy;
  const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length2));
  const qx = ax + dx * t;
  const qy = ay + dy * t;
  return Math.hypot(px - qx, py - qy);
}

export function distanceToPolylineMeters(point: LatLng, line: LatLng[]) {
  let min = Infinity;
  for (let i = 1; i < line.length; i += 1) {
    const a = line[i - 1];
    const b = line[i];
    if (!a || !b) {
      continue;
    }
    min = Math.min(min, pointToSegmentMeters(point, a, b));
  }
  return min;
}

export function fractionWithinCorridor(route: LatLng[], other: LatLng[], corridorM = CORRIDOR_M) {
  if (route.length < 2 || other.length === 0) {
    return 0;
  }
  let inside = 0;
  for (const point of other) {
    if (distanceToPolylineMeters(point, route) <= corridorM) {
      inside += 1;
    }
  }
  return inside / other.length;
}

export function symmetricOverlap(a: LatLng[], b: LatLng[], corridorM = CORRIDOR_M) {
  return Math.min(fractionWithinCorridor(a, b, corridorM), fractionWithinCorridor(b, a, corridorM));
}

export function sameDirection(a: LatLng[], b: LatLng[], limitM = DIRECTION_M) {
  const a20 = a[20];
  const b20 = b[20];
  const a80 = a[80];
  const b80 = b[80];
  if (!a20 || !b20 || !a80 || !b80) {
    return false;
  }
  return haversineMeters(a20, b20) < limitM && haversineMeters(a80, b80) < limitM;
}

export function startsOrEndsNear(a: { start: LatLng; end: LatLng }, b: { start: LatLng; end: LatLng }, meters = CANDIDATE_NEAR_M) {
  return (
    haversineMeters(a.start, b.start) <= meters ||
    haversineMeters(a.start, b.end) <= meters ||
    haversineMeters(a.end, b.start) <= meters ||
    haversineMeters(a.end, b.end) <= meters
  );
}

export function distanceWithin(a: number, b: number, tolerance = DISTANCE_TOLERANCE) {
  if (!(a > 0) || !(b > 0)) {
    return false;
  }
  return Math.abs(a - b) / Math.max(a, b) <= tolerance;
}
