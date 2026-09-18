import type { Json } from "@/lib/database.types";
import type { WorkoutSport } from "@/lib/workout";

export type MappedActivity = {
  source: "coros" | "fit" | "gpx" | "tcx";
  source_activity_id: string;
  sport: WorkoutSport;
  subsport: string | null;
  started_at: string;
  duration_seconds: number | null;
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
  vendor: Json | null;
};

const SPORT_BY_CODE: Record<string, WorkoutSport> = {
  "1": "ride",
  "2": "ride",
  "8": "ride",
  "9": "ride",
  "900": "walk",
};

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    if (Number.isFinite(Number(value.trim()))) {
      return Number(value.trim());
    }
    const match = value.trim().match(/^(-?\d+(?:\.\d+)?)/);
    if (match) {
      return Number(match[1]);
    }
  }
  return null;
}

export function int(value: unknown): number | null {
  const n = num(value);
  return n === null ? null : Math.round(n);
}

export function str(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

export function pick(record: Record<string, unknown>, keys: string[]): unknown {
  const lower = new Map(
    Object.keys(record).map((key) => [key.toLowerCase(), record[key]]),
  );
  for (const key of keys) {
    const value = record[key] ?? lower.get(key.toLowerCase());
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return undefined;
}

const ISO_DATE =
  /20\d{2}[-/](?:0[1-9]|1[0-2])[-/](?:0[1-9]|[12]\d|3[01])(?:[ T](?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?)?/;

function camelLabel(label: string) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+([a-z0-9])/g, (_, char: string) => char.toUpperCase())
    .replace(/[^a-z0-9]/g, "");
}

function assignField(record: Record<string, unknown>, label: string, value: string) {
  record[label] = value;
  record[camelLabel(label)] = value;
}

export function parseCorosFields(text: string): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  const title = text.match(/^\s*(?:[^\w\n]{1,6}\s*)?(.+?)\s+Activity Details/im);
  if (title) {
    record.sportName = title[1].trim();
  }
  const listed = text.match(/\d+\.\s+(.+?)\s+—\s+20\d{2}/);
  if (listed && !record.sportName) {
    record.sportName = listed[1].trim();
  }
  for (const part of text.split(/\r?\n|\s\|\s/)) {
    const match = part.match(/^\s*([A-Za-z][A-Za-z0-9 /_-]{0,40}?)\s*:\s*(.+?)\s*$/);
    if (!match) {
      continue;
    }
    assignField(record, match[1].trim(), match[2].trim());
  }
  const avgHr = text.match(/Avg(?:erage)?\s*HR\s*:\s*(\d+)/i);
  if (avgHr) {
    record.avgHr = Number(avgHr[1]);
  }
  const maxHr = text.match(/Max(?:imum)?\s*HR\s*:\s*(\d+)/i);
  if (maxHr) {
    record.maxHr = Number(maxHr[1]);
  }
  const avgPower = text.match(/Avg(?:erage)?\s*Power\s*:\s*(\d+)/i);
  if (avgPower) {
    record.avgPower = Number(avgPower[1]);
  }
  const avgSpeed = text.match(/Average Speed\s*:\s*([\d.]+)\s*km\/h/i);
  if (avgSpeed) {
    record.avgSpeedMps = Number(avgSpeed[1]) / 3.6;
  }
  const avgSpeedMph = text.match(/Average Speed\s*:\s*([\d.]+)\s*mph/i);
  if (avgSpeedMph) {
    record.avgSpeedMps = Number(avgSpeedMph[1]) * 0.44704;
  }
  const startTs = text.match(/startTimestamp\s*=\s*(\d+)/i);
  if (startTs) {
    record.startTimestamp = Number(startTs[1]);
  }
  if (!record.startTimestamp) {
    const iso = extractIsoDate(text);
    if (iso) {
      record.startTime = iso;
    }
  }
  return record;
}

function parseCorosText(text: string): Record<string, unknown>[] {
  const chunks = text.split(/(?=\n\d+\.\s)/);
  const records: Record<string, unknown>[] = [];
  for (const chunk of chunks) {
    const id = chunk.match(
      /(?:LabelId|labelId|activityId|sportRecordId|recordId)\s*:\s*([0-9]+)/i,
    );
    if (!id) {
      continue;
    }
    const record = parseCorosFields(chunk);
    record.LabelId = id[1];
    record.labelId = id[1];
    if (recordId(record)) {
      records.push(record);
    }
  }
  return records;
}

export function extractIsoDate(text: string): string | null {
  const match = text.match(ISO_DATE);
  if (!match) {
    return null;
  }
  const parsed = Date.parse(match[0].replace(/\//g, "-"));
  if (Number.isNaN(parsed)) {
    return null;
  }
  return new Date(parsed).toISOString();
}

export function parseToolJson(result: {
  content?: Array<{ type: string; text?: string }>;
  structuredContent?: unknown;
}): unknown {
  if (result.structuredContent !== undefined) {
    return result.structuredContent;
  }
  const texts = (result.content ?? [])
    .filter((block) => block.type === "text" && block.text)
    .map((block) => block.text as string);
  if (texts.length === 0) {
    return result;
  }
  const joined = texts.join("\n");
  try {
    return JSON.parse(joined) as unknown;
  } catch {
    const fromText = parseCorosText(joined);
    return fromText.length > 0 ? fromText : joined;
  }
}

export function collectRecords(value: unknown): Record<string, unknown>[] {
  if (typeof value === "string") {
    return parseCorosText(value);
  }
  const found: Record<string, unknown>[] = [];
  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const record = asRecord(node);
    if (!record) {
      return;
    }
    const id = pick(record, [
      "id",
      "activityId",
      "activity_id",
      "labelId",
      "label_id",
      "sportRecordId",
      "recordId",
    ]);
    if (id !== undefined) {
      found.push(record);
      return;
    }
    Object.values(record).forEach(visit);
  };
  visit(value);
  if (found.length === 0 && typeof value === "string") {
    return parseCorosText(value);
  }
  return found;
}

export function recordId(record: Record<string, unknown>): string | null {
  return str(
    pick(record, [
      "id",
      "activityId",
      "activity_id",
      "labelId",
      "label_id",
      "sportRecordId",
      "recordId",
    ]),
  );
}

function sportFrom(record: Record<string, unknown>): WorkoutSport {
  const named = str(pick(record, ["sportName", "sport_name", "activityType"]));
  if (named) {
    const lower = named.toLowerCase();
    if (lower.includes("triathlon") || lower.includes("duathlon") || lower.includes("brick")) {
      return "triathlon";
    }
    if (lower.includes("run") || lower.includes("jog")) {
      return "run";
    }
    if (lower.includes("cycle") || lower.includes("bike") || lower.includes("ride")) {
      return "ride";
    }
    if (lower.includes("swim")) {
      return "swim";
    }
    if (lower.includes("walk") || lower.includes("hike")) {
      return "walk";
    }
    if (lower.includes("row") || lower.includes("erg")) {
      return "row";
    }
    if (lower.includes("ski")) {
      return "ski";
    }
    if (lower.includes("strength") || lower.includes("gym") || lower.includes("weight")) {
      return "strength";
    }
  }
  const code = str(
    pick(record, ["sportType", "sport_type", "mode", "sportCode"]),
  );
  if (!code) {
    return "other";
  }
  const lower = code.toLowerCase();
  if (lower.includes("triathlon") || lower.includes("duathlon") || lower.includes("brick")) {
    return "triathlon";
  }
  if (lower.includes("run")) {
    return "run";
  }
  if (lower.includes("ride") || lower.includes("cycle") || lower.includes("bike")) {
    return "ride";
  }
  if (lower.includes("swim")) {
    return "swim";
  }
  if (lower.includes("walk") || lower.includes("hike")) {
    return "walk";
  }
  if (lower.includes("row") || lower.includes("erg")) {
    return "row";
  }
  if (lower.includes("ski")) {
    return "ski";
  }
  if (lower.includes("strength") || lower.includes("gym")) {
    return "strength";
  }
  const n = Number(code);
  if (Number.isFinite(n)) {
    if (n >= 100 && n < 200) {
      return "run";
    }
    if ((n >= 200 && n < 300) || n === 2 || n === 8 || n === 9) {
      return "ride";
    }
    if (n >= 300 && n < 400) {
      return "swim";
    }
    if (n === 402) {
      return "strength";
    }
    if (n >= 900 && n < 1000) {
      return "walk";
    }
  }
  return SPORT_BY_CODE[code] ?? "other";
}

export function flattenCorosRecord(record: Record<string, unknown>): Record<string, unknown> {
  const duration = asRecord(record.duration);
  const heartRate = asRecord(record.heartRate);
  const cadence = asRecord(record.cadence);
  const speed = asRecord(record.speed);
  const elevation = asRecord(record.elevation);
  return {
    ...record,
    ...(duration
      ? {
          durationSeconds:
            duration.movingSeconds ??
            duration.elapsedSeconds ??
            duration.seconds ??
            record.durationSeconds,
        }
      : {}),
    ...(heartRate
      ? {
          avgHr: heartRate.average ?? heartRate.avg,
          maxHr: heartRate.max,
        }
      : {}),
    ...(cadence
      ? {
          avgCadence: cadence.average ?? cadence.avg,
          maxCadence: cadence.max,
        }
      : {}),
    ...(speed
      ? {
          averageMetersPerSecond: speed.averageMetersPerSecond,
          averageSpeed: speed.average ?? speed.avg,
          maxSpeedMps: speed.maxMetersPerSecond ?? speed.max,
        }
      : {}),
    ...(elevation
      ? {
          elevationGainMeters: elevation.gain ?? elevation.gainMeters,
        }
      : {}),
  };
}

function clockOrNumber(raw: unknown): number | null {
  const text = str(raw);
  if (text?.includes(":")) {
    const clock = text.match(/^(\d+):([0-5]\d):([0-5]\d)$/);
    if (clock) {
      return Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3]);
    }
    const minutesSeconds = text.match(/^(\d+):([0-5]\d)$/);
    if (minutesSeconds) {
      return Number(minutesSeconds[1]) * 60 + Number(minutesSeconds[2]);
    }
  }
  const n = num(raw);
  if (n !== null) {
    return n > 10000 ? Math.round(n / 1000) : Math.round(n);
  }
  if (!text) {
    return null;
  }
  const hours = text.match(/(\d+(?:\.\d+)?)\s*h/i);
  const minutes = text.match(/(\d+(?:\.\d+)?)\s*m/i);
  if (hours || minutes) {
    return Math.round((hours ? Number(hours[1]) * 3600 : 0) + (minutes ? Number(minutes[1]) * 60 : 0));
  }
  return null;
}

function durationSeconds(record: Record<string, unknown>): number | null {
  const raw = pick(record, [
    "workoutTime",
    "movingTime",
    "durationSeconds",
    "duration_seconds",
    "duration",
    "totalTime",
  ]);
  return clockOrNumber(raw);
}

function elapsedSeconds(record: Record<string, unknown>): number | null {
  return clockOrNumber(
    pick(record, [
      "elapsedTime",
      "elapsedSeconds",
      "elapsed_seconds",
      "totalElapsedTime",
      "totalTime",
    ]),
  );
}

function movingSeconds(record: Record<string, unknown>): number | null {
  return clockOrNumber(
    pick(record, ["workoutTime", "movingTime", "movingSeconds", "timerTime", "totalTimerTime"]),
  );
}

function distanceM(record: Record<string, unknown>): number | null {
  const raw = pick(record, ["distanceMeters", "distance_m", "distance", "totalDistance"]);
  const n = num(raw);
  if (n !== null) {
    return n > 0 && n < 200 ? n * 1000 : n;
  }
  const text = str(raw);
  if (!text) {
    return null;
  }
  const km = text.match(/([\d.]+)\s*km/i);
  if (km) {
    return Number(km[1]) * 1000;
  }
  const miles = text.match(/([\d.]+)\s*mi/i);
  if (miles) {
    return Number(miles[1]) * 1609.34;
  }
  return null;
}

export function extractTimestamp(value: unknown): string | null {
  if (typeof value === "number") {
    return startedFromRaw(value);
  }
  if (typeof value === "string") {
    if (!value.includes("\n") && value.length <= 32) {
      const direct = startedFromRaw(value);
      if (direct) {
        return direct;
      }
    }
    return extractIsoDate(value);
  }
  if (value && typeof value === "object") {
    return extractIsoDate(JSON.stringify(value));
  }
  return null;
}

function startedFromRaw(raw: unknown): string | null {
  if (typeof raw === "number") {
    const ms =
      raw > 1e14 ? NaN : raw > 1e12 ? raw : raw > 1e11 ? raw * 10 : raw > 1e9 ? raw * 1000 : NaN;
    if (Number.isFinite(ms)) {
      const date = new Date(ms);
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }
    return null;
  }
  const text = str(raw);
  if (!text) {
    return null;
  }
  const parsed = Date.parse(text);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString();
  }
  const compact = text.replace(/\D/g, "");
  if (compact.length === 10) {
    const seconds = Number(compact);
    if (seconds > 1e9 && seconds < 2e10) {
      return new Date(seconds * 1000).toISOString();
    }
  }
  if (compact.length === 8) {
    const year = Number(compact.slice(0, 4));
    const month = Number(compact.slice(4, 6));
    const day = Number(compact.slice(6, 8));
    if (year < 2018 || year > 2039 || month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }
    const date = new Date(`${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}T12:00:00.000Z`);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}

function startedAt(record: Record<string, unknown>): string | null {
  const raw = pick(record, [
    "startTimestamp",
    "startedAt",
    "startTime",
    "start_time",
    "beginTime",
    "begin_time",
    "happenTime",
    "date",
    "startDate",
    "happenDay",
  ]);
  return startedFromRaw(raw);
}

function subsportFrom(record: Record<string, unknown>, sport: WorkoutSport): string | null {
  const named = str(
    pick(record, ["sportName", "sport_name", "activityType", "subSport", "subsport"]),
  );
  if (named) {
    const lower = named.toLowerCase();
    if (lower.includes("cyclo") || /\bcx\b/.test(lower)) {
      return "cyclocross";
    }
    if (lower.includes("gravel")) {
      return "gravel";
    }
    if (lower.includes("indoor") || lower.includes("trainer") || lower.includes("spin")) {
      return "indoor";
    }
    if (lower.includes("treadmill")) {
      return "treadmill";
    }
    if (lower.includes("trail")) {
      return "trail";
    }
    if (lower.includes("mountain") || lower.includes("mtb")) {
      return "mountain";
    }
    if (sport === "ride" && lower.includes("road")) {
      return "road";
    }
  }
  const code = Number(
    str(pick(record, ["sportType", "sport_type", "mode", "sportCode"])),
  );
  if (code === 201) {
    return "indoor";
  }
  if (code === 203) {
    return "gravel";
  }
  return null;
}

function corosSpeedMps(record: Record<string, unknown>): number | null {
  const explicit = num(
    pick(record, ["avgSpeedMps", "avg_speed_mps", "averageMetersPerSecond"]),
  );
  if (explicit != null && explicit > 0 && explicit < 30) {
    return explicit;
  }
  const raw = pick(record, ["averageSpeed", "avgSpeed", "avg_speed"]);
  const text = str(raw);
  if (text && /mph/i.test(text)) {
    const miles = num(raw);
    return miles && miles > 0 ? miles * 0.44704 : null;
  }
  if (text && /m\/s/i.test(text)) {
    return num(raw);
  }
  const kph = num(raw);
  if (kph != null && kph > 0) {
    return kph / 3.6;
  }
  return null;
}

function vendorFrom(record: Record<string, unknown>): Json | null {
  const trainingLoad = pick(record, [
    "trainingLoad",
    "training_load",
    "corosTrainingLoad",
  ]);
  const recovery = pick(record, [
    "recovery",
    "recoveryScore",
    "corosRecovery",
  ]);
  const vo2 = pick(record, ["vo2max", "vo2Max", "vo2_max", "corosVo2max"]);
  if (trainingLoad === undefined && recovery === undefined && vo2 === undefined) {
    return null;
  }
  return {
    ...(trainingLoad === undefined ? {} : { coros_training_load: trainingLoad as Json }),
    ...(recovery === undefined ? {} : { coros_recovery: recovery as Json }),
    ...(vo2 === undefined ? {} : { coros_vo2max: vo2 as Json }),
  };
}

export function mapCorosActivity(record: Record<string, unknown>): MappedActivity | null {
  const flat = flattenCorosRecord(record);
  const id = recordId(flat);
  const started = startedAt(flat);
  if (!id || !started) {
    return null;
  }
  const sport = sportFrom(flat);
  const moving = movingSeconds(flat);
  const elapsed = elapsedSeconds(flat);
  const duration = moving ?? elapsed ?? durationSeconds(flat);
  const distance = distanceM(flat);
  const listedSpeed = corosSpeedMps(flat);
  return {
    source: "coros",
    source_activity_id: id,
    sport,
    subsport: subsportFrom(flat, sport),
    started_at: started,
    duration_seconds: duration,
    elapsed_seconds: elapsed,
    moving_seconds: moving,
    distance_m: distance,
    elevation_m: num(
      pick(flat, [
        "elevationGain",
        "elevation_m",
        "elevationGainMeters",
        "ascent",
        "totalAscent",
      ]),
    ),
    avg_hr: int(
      pick(flat, [
        "avgHr",
        "avg_hr",
        "averageHeartRate",
        "avgHeartRate",
        "heartRate",
        "hr",
      ]),
    ),
    max_hr: int(pick(flat, ["maxHr", "max_hr", "maxHeartRate"])),
    avg_power: int(pick(flat, ["avgPower", "avg_power", "averagePower", "power"])),
    max_power: int(pick(flat, ["maxPower", "max_power"])),
    normalized_power: int(pick(flat, ["normalizedPower", "normalized_power"])),
    avg_cadence: int(pick(flat, ["avgCadence", "avg_cadence", "averageCadence"])),
    avg_speed_mps:
      listedSpeed ??
      (distance && duration && duration > 0 ? distance / duration : null),
    vendor: vendorFrom(flat),
  };
}
