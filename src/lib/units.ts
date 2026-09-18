export type Units = "metric" | "imperial";

export const METERS_PER_MILE = 1609.344;
const METERS_PER_FOOT = 0.3048;

export function metersFromUserDistance(value: number, units: Units): number {
  return units === "imperial" ? value * METERS_PER_MILE : value * 1000;
}

export function userDistanceFromMeters(meters: number, units: Units): number {
  const raw = units === "imperial" ? meters / METERS_PER_MILE : meters / 1000;
  return Math.round(raw * 100) / 100;
}

export function parseUnits(value: unknown): Units {
  return value === "imperial" ? "imperial" : "metric";
}

export function formatDistance(
  meters: number | null | undefined,
  units: Units,
): string | null {
  if (!meters) {
    return null;
  }
  if (units === "imperial") {
    const miles = meters / METERS_PER_MILE;
    if (miles >= 0.1) {
      return `${miles.toFixed(1)} mi`;
    }
    return `${Math.round(meters / METERS_PER_FOOT)} ft`;
  }
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
}

export function formatDuration(seconds: number | null | undefined): string | null {
  if (!seconds || seconds < 0) {
    return null;
  }
  const totalMinutes = Math.floor(seconds / 60);
  if (totalMinutes === 0) {
    return "<1m";
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) {
    return `${minutes}m`;
  }
  if (minutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${minutes}m`;
}

export function formatElevation(
  meters: number | null | undefined,
  units: Units,
): string | null {
  if (meters == null) {
    return null;
  }
  if (units === "imperial") {
    return `${Math.round(meters / METERS_PER_FOOT)} ft`;
  }
  return `${Math.round(meters)} m`;
}

export function formatHms(seconds: number | null | undefined): string | null {
  if (seconds == null || seconds < 0) {
    return null;
  }
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
  }
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function clockFromSeconds(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds >= 0 ? seconds : 0;
  const minutes = Math.floor(safe / 60);
  const rest = Math.round(safe % 60);
  if (rest === 60) {
    return `${minutes + 1}:00`;
  }
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

export function formatPace(
  mps: number | null | undefined,
  units: Units,
): string | null {
  if (!mps || mps < 0.4) {
    return null;
  }
  const meters = units === "imperial" ? METERS_PER_MILE : 1000;
  const seconds = meters / mps;
  if (seconds > 3600) {
    return null;
  }
  return `${clockFromSeconds(seconds)}${units === "imperial" ? "/mi" : "/km"}`;
}

export function formatSwimPace(mps: number | null | undefined): string | null {
  if (!mps || mps < 0.2) {
    return null;
  }
  const seconds = 100 / mps;
  if (seconds > 3600) {
    return null;
  }
  return `${clockFromSeconds(seconds)}/100m`;
}

export function formatSpeed(
  mps: number | null | undefined,
  units: Units,
): string | null {
  if (!mps || mps <= 0) {
    return null;
  }
  if (units === "imperial") {
    return `${((mps * 3600) / METERS_PER_MILE).toFixed(1)} mph`;
  }
  return `${(mps * 3.6).toFixed(1)} km/h`;
}

export function paceSecondsPerUnit(mps: number, units: Units): number | null {
  if (!Number.isFinite(mps) || mps < 0.4) {
    return null;
  }
  const meters = units === "imperial" ? METERS_PER_MILE : 1000;
  const seconds = meters / mps;
  return seconds > 3600 ? null : seconds;
}
