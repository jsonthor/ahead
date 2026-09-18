import FitParser from "fit-file-parser";
import type { ParsedFit } from "fit-file-parser";

export type StreamPoint = {
  t: number;
  hr?: number;
  power?: number;
  speed?: number;
  cadence?: number;
  elevation?: number;
  lat?: number;
  lng?: number;
};

export type ParsedLapSummary = {
  source_index: number;
  started_at: string | null;
  duration_seconds: number | null;
  distance_m: number | null;
  avg_hr: number | null;
  avg_power: number | null;
};

export type FitSummary = {
  sport: string | null;
  started_at: string | null;
  elapsed_seconds: number | null;
  moving_seconds: number | null;
  distance_m: number | null;
  elevation_m: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  avg_power: number | null;
  max_power: number | null;
  normalized_power: number | null;
  avg_cadence: number | null;
  avg_speed_mps: number | null;
  profile_hr_max: number | null;
  subsport: string | null;
};

export function looksLikeFit(bytes: Buffer) {
  return bytes.length >= 14 && bytes.subarray(8, 12).toString("ascii") === ".FIT";
}

export type ParsedActivityFit = {
  summary: FitSummary;
  stream: StreamPoint[];
  laps: ParsedLapSummary[];
};

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function roundInt(value: unknown): number | null {
  const n = finite(value);
  return n === null ? null : Math.round(n);
}

function isoFromDate(value: Date | undefined): string | null {
  if (!value || Number.isNaN(value.getTime())) {
    return null;
  }
  return value.toISOString();
}

function subsportName(session: ParsedFit["sessions"]): string | null {
  const raw = session?.[0]?.sub_sport;
  if (typeof raw === "string" && raw && raw !== "generic") {
    return raw;
  }
  return null;
}

function downsample(points: StreamPoint[], maxPoints = 4000): StreamPoint[] {
  if (points.length <= maxPoints) {
    return points;
  }
  const step = Math.ceil(points.length / maxPoints);
  return points.filter((_, index) => index % step === 0);
}

function toDegrees(value: unknown): number | null {
  const n = finite(value);
  if (n == null) {
    return null;
  }
  const degrees = Math.abs(n) <= 180 ? n : n * (180 / 2 ** 31);
  if (!Number.isFinite(degrees) || Math.abs(degrees) > 180) {
    return null;
  }
  return Math.round(degrees * 1e5) / 1e5;
}

function streamFromRecords(records: NonNullable<ParsedFit["records"]>): StreamPoint[] {
  const first = records.find((record) => record.timestamp)?.timestamp;
  const origin = first ? first.getTime() : 0;
  const points: StreamPoint[] = [];
  for (const record of records) {
    const ts = record.timestamp ? record.timestamp.getTime() : null;
    const t =
      ts != null && origin
        ? Math.max(0, Math.round((ts - origin) / 1000))
        : points.length;
    const hr = roundInt(record.heart_rate);
    const power = roundInt(record.power);
    const speed = finite(record.enhanced_speed ?? record.speed);
    const cadence = roundInt(record.cadence);
    const elevation = finite(record.enhanced_altitude ?? record.altitude);
    const lat = toDegrees(record.position_lat);
    const lng = toDegrees(record.position_long);
    if (
      hr == null &&
      power == null &&
      speed == null &&
      cadence == null &&
      elevation == null &&
      lat == null
    ) {
      continue;
    }
    points.push({
      t,
      ...(hr == null ? {} : { hr }),
      ...(power == null ? {} : { power }),
      ...(speed == null ? {} : { speed }),
      ...(cadence == null ? {} : { cadence }),
      ...(elevation == null ? {} : { elevation }),
      ...(lat == null || lng == null ? {} : { lat, lng }),
    });
  }
  return downsample(points);
}

function lapsFromFit(laps: ParsedFit["laps"]): ParsedLapSummary[] {
  return (laps ?? []).map((lap, index) => ({
    source_index: index,
    started_at: isoFromDate(lap.start_time),
    duration_seconds: roundInt(lap.total_timer_time ?? lap.total_elapsed_time),
    distance_m: finite(lap.total_distance),
    avg_hr: roundInt(lap.avg_heart_rate),
    avg_power: roundInt(lap.avg_power),
  }));
}

function asDate(value: unknown): Date | undefined {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  return undefined;
}

function summaryFromSession(fit: ParsedFit): FitSummary {
  const session = fit.sessions?.[0] as
    | (NonNullable<ParsedFit["sessions"]>[number] & {
        sport?: unknown;
        start_time?: unknown;
        total_elapsed_time?: unknown;
        total_timer_time?: unknown;
        total_distance?: unknown;
        total_ascent?: unknown;
        avg_heart_rate?: unknown;
        max_heart_rate?: unknown;
        avg_power?: unknown;
        max_power?: unknown;
        normalized_power?: unknown;
        avg_cadence?: unknown;
        enhanced_avg_speed?: unknown;
        avg_speed?: unknown;
      })
    | undefined;
  const profileMax = roundInt(fit.user_profile?.default_max_heart_rate);
  const firstRecord = fit.records?.find((record) => record.timestamp)?.timestamp;
  const sport =
    typeof session?.sport === "string" && session.sport.trim()
      ? session.sport
      : null;
  return {
    sport,
    started_at:
      isoFromDate(asDate(session?.start_time)) ??
      isoFromDate(asDate(firstRecord)),
    elapsed_seconds: roundInt(session?.total_elapsed_time),
    moving_seconds: roundInt(session?.total_timer_time),
    distance_m: finite(session?.total_distance),
    elevation_m: finite(session?.total_ascent),
    avg_hr: roundInt(session?.avg_heart_rate),
    max_hr: roundInt(session?.max_heart_rate),
    avg_power: roundInt(session?.avg_power),
    max_power: roundInt(session?.max_power),
    normalized_power: roundInt(session?.normalized_power),
    avg_cadence: roundInt(session?.avg_cadence),
    avg_speed_mps: finite(session?.enhanced_avg_speed ?? session?.avg_speed),
    profile_hr_max: profileMax,
    subsport: subsportName(fit.sessions),
  };
}

export async function parseFitFile(bytes: Buffer): Promise<ParsedActivityFit> {
  const parser = new FitParser({
    force: true,
    speedUnit: "m/s",
    lengthUnit: "m",
    elapsedRecordField: true,
    mode: "list",
  });
  const fit = await parser.parseAsync(bytes as Buffer<ArrayBuffer>);
  return {
    summary: summaryFromSession(fit),
    stream: streamFromRecords(fit.records ?? []),
    laps: lapsFromFit(fit.laps),
  };
}
