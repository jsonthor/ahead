import type { Client } from "@modelcontextprotocol/client";
import { asRecord, num, pick, str } from "@/lib/coros/map";
import { argsForDateRange, callToolJson, schemaProps } from "@/lib/coros/mcp";
import {
  MAX_OVERNIGHT_SLEEP_MINUTES,
  MIN_OVERNIGHT_SLEEP_MINUTES,
  overnightSleepMinutes,
} from "@/lib/recovery";
import { createAdminClient } from "@/lib/supabase/admin";

export {
  MAX_OVERNIGHT_SLEEP_MINUTES,
  MIN_OVERNIGHT_SLEEP_MINUTES,
  overnightSleepMinutes,
};

export const RECOVERY_BACKFILL_DAYS = 42;
export const RECOVERY_SYNC_DAYS = 14;

export type RecoveryDay = {
  date: string;
  resting_hr?: number;
  sleep_hrv_ms?: number;
  sleep_minutes?: number;
  sleep_score?: number;
  stress_avg?: number;
};

const ISO_DAY = /20\d{2}-\d{2}-\d{2}/;
const RECOVERY_TOOLS = [
  "queryDailyHealthData",
  "querySleepData",
  "querySleepHrv",
  "queryRestingHeartRate",
  "queryStressLevel",
] as const;

const HRV_KEYS = [
  "sleepHrv",
  "sleepHrvMs",
  "avgSleepHrv",
  "avgHrv",
  "hrvAvg",
  "hrvAverage",
  "averageHrv",
  "avgRmssd",
  "rmssd",
  "overnightHrv",
  "hrvMs",
  "hrv",
];

const RHR_KEYS = [
  "restingHr",
  "restingHR",
  "resting_hr",
  "restHr",
  "rhr",
  "restingHeartRate",
  "restHeartRate",
];

const SLEEP_MINUTE_KEYS = [
  "sleepMinutes",
  "sleep_minutes",
  "totalSleepMinutes",
  "mainSleepMinutes",
  "sleepDurationMinutes",
  "sleepTimeMinutes",
  "tib",
];

const SLEEP_DURATION_KEYS = [
  "sleepDuration",
  "totalSleepTime",
  "totalSleepDuration",
  "mainSleepDuration",
];

const SLEEP_START_KEYS = [
  "sleepStartTime",
  "sleepStart",
  "fellAsleepTime",
  "startTime",
  "beginTime",
];

const SLEEP_END_KEYS = ["sleepEndTime", "sleepEnd", "wakeTime", "gotUpTime", "endTime"];

const SLEEP_HOUR_KEYS = ["sleepHours", "sleep_hours", "totalSleepHours"];

const SLEEP_SCORE_KEYS = ["sleepScore", "sleep_score", "sleepQualityScore"];

const STRESS_KEYS = [
  "avgStress",
  "averageStress",
  "stressAvg",
  "stressAverage",
  "dailyStress",
  "stressLevel",
  "stress",
];

function dayKey(value: unknown): string | null {
  const text = str(value) ?? (typeof value === "number" ? String(value) : null);
  if (!text) {
    return null;
  }
  const iso = text.match(ISO_DAY);
  if (iso) {
    return iso[0];
  }
  const compact = text.replace(/\D/g, "");
  if (compact.length >= 8) {
    const ymd = compact.slice(0, 8);
    const year = Number(ymd.slice(0, 4));
    const month = Number(ymd.slice(4, 6));
    const day = Number(ymd.slice(6, 8));
    if (year >= 2018 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
    }
  }
  return null;
}

function recordDate(record: Record<string, unknown>): string | null {
  return dayKey(
    pick(record, [
      "date",
      "day",
      "happenDay",
      "happen_day",
      "dataDate",
      "statisticDate",
      "sleepDate",
      "recordDate",
      "startDate",
      "theDate",
    ]),
  );
}

function isTimeSeriesPoint(record: Record<string, unknown>) {
  const timed = pick(record, ["time", "timestamp", "second", "offsetSeconds", "index"]);
  if (timed == null) {
    return false;
  }
  return (
    pick(record, [
      "sleepScore",
      "avgHrv",
      "sleepHrv",
      "restingHr",
      "restingHR",
      "sleepMinutes",
      "avgStress",
    ]) == null
  );
}

function looksLikeRecoveryPercent(key: string, value: number) {
  const lower = key.toLowerCase();
  if (lower.includes("base") || lower.includes("interval") || lower.includes("range")) {
    return true;
  }
  if (lower.includes("recovery") && !lower.includes("hrv")) {
    return true;
  }
  if ((lower.includes("evaluation") || lower.includes("status")) && value <= 100) {
    return true;
  }
  return false;
}

function epochMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 1e12) {
      return value;
    }
    if (value > 1e9) {
      return value * 1000;
    }
    return null;
  }
  const text = str(value);
  if (!text) {
    return null;
  }
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function sleepFromWindow(record: Record<string, unknown>): number | null {
  const start = epochMs(pick(record, SLEEP_START_KEYS));
  const end = epochMs(pick(record, SLEEP_END_KEYS));
  if (start == null || end == null || end <= start) {
    return null;
  }
  return overnightSleepMinutes((end - start) / 60000);
}

function isSleepStage(record: Record<string, unknown>) {
  const kind = str(pick(record, ["stage", "sleepStage", "sleepType", "type"]));
  return kind != null && /rem|light|deep|awake|stage|nap/i.test(kind);
}

function hrvMsFrom(key: string, value: number): number | null {
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  if (looksLikeRecoveryPercent(key, value)) {
    return null;
  }
  if (value < 15 || value > 250) {
    return null;
  }
  return Math.round(value * 10) / 10;
}

function rhrFrom(value: number): number | null {
  if (!Number.isFinite(value)) {
    return null;
  }
  const bpm = Math.round(value);
  if (bpm < 30 || bpm > 100) {
    return null;
  }
  return bpm;
}

function stressFrom(value: number): number | null {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    return null;
  }
  return Math.round(value * 10) / 10;
}

function scoreFrom(value: number): number | null {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    return null;
  }
  return Math.round(value);
}

function firstNumber(record: Record<string, unknown>, keys: string[]): { key: string; value: number } | null {
  for (const key of keys) {
    const value = num(pick(record, [key]));
    if (value != null) {
      return { key, value };
    }
  }
  return null;
}

function patchFromRecord(record: Record<string, unknown>): Omit<RecoveryDay, "date"> {
  if (isSleepStage(record)) {
    return {};
  }
  const hrv = firstNumber(record, HRV_KEYS);
  const rhr = firstNumber(record, RHR_KEYS);
  const sleepMin = firstNumber(record, SLEEP_MINUTE_KEYS);
  const sleepDur = firstNumber(record, SLEEP_DURATION_KEYS);
  const sleepHours = firstNumber(record, SLEEP_HOUR_KEYS);
  const score = firstNumber(record, SLEEP_SCORE_KEYS);
  const stress = firstNumber(record, STRESS_KEYS);
  const minutes =
    sleepFromWindow(record) ??
    (sleepMin != null
      ? overnightSleepMinutes(sleepMin.value)
      : sleepDur != null
        ? overnightSleepMinutes(sleepDur.value)
        : sleepHours != null
          ? overnightSleepMinutes(sleepHours.value)
          : null);
  return {
    ...(rhr != null && rhrFrom(rhr.value) != null ? { resting_hr: rhrFrom(rhr.value)! } : {}),
    ...(hrv != null && hrvMsFrom(hrv.key, hrv.value) != null
      ? { sleep_hrv_ms: hrvMsFrom(hrv.key, hrv.value)! }
      : {}),
    ...(minutes != null ? { sleep_minutes: minutes } : {}),
    ...(score != null && scoreFrom(score.value) != null ? { sleep_score: scoreFrom(score.value)! } : {}),
    ...(stress != null && stressFrom(stress.value) != null ? { stress_avg: stressFrom(stress.value)! } : {}),
  };
}

function isPlausibleOvernight(minutes: number | null | undefined): minutes is number {
  return (
    minutes != null &&
    minutes >= MIN_OVERNIGHT_SLEEP_MINUTES &&
    minutes <= MAX_OVERNIGHT_SLEEP_MINUTES
  );
}

function preferOvernight(a?: number, b?: number): number | undefined {
  const left = isPlausibleOvernight(a) ? a : undefined;
  const right = isPlausibleOvernight(b) ? b : undefined;
  return left ?? right;
}

function mergeDay(into: Map<string, RecoveryDay>, date: string, patch: Omit<RecoveryDay, "date">) {
  const current = into.get(date) ?? { date };
  into.set(date, {
    date,
    resting_hr: patch.resting_hr ?? current.resting_hr,
    sleep_hrv_ms: patch.sleep_hrv_ms ?? current.sleep_hrv_ms,
    sleep_minutes: preferOvernight(patch.sleep_minutes, current.sleep_minutes),
    sleep_score: patch.sleep_score ?? current.sleep_score,
    stress_avg: patch.stress_avg ?? current.stress_avg,
  });
}

function clockToMinutes(text: string): number | null {
  const hm = text.match(/(\d+)\s*h(?:ou)?r?s?\s*(\d+)\s*m/i);
  if (hm) {
    return Number(hm[1]) * 60 + Number(hm[2]);
  }
  const hours = text.match(/(\d+)\s*h(?:ou)?r?s?\b/i);
  if (hours) {
    return Number(hours[1]) * 60;
  }
  const mins = text.match(/(\d+)\s*min(?:ute)?s?\b/i);
  if (mins) {
    return Number(mins[1]);
  }
  return null;
}

export function parseHealthReport(text: string, into: Map<string, RecoveryDay>) {
  let current: string | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      continue;
    }
    if (/sleep window|timestamp=|hrv baseline|^naps\s+total/i.test(line)) {
      continue;
    }
    const compact = line.match(/^---\s*(20\d{2})(\d{2})(\d{2})\s*---/);
    const iso = line.match(/^(20\d{2}-\d{2}-\d{2})(?:\s*:)?(?:\s*(?:(\d{2,3})\s*bpm|no data))?/i);
    if (compact) {
      current = `${compact[1]}-${compact[2]}-${compact[3]}`;
    } else if (iso) {
      current = iso[1];
      if (iso[2] && current) {
        mergeDay(into, current, { resting_hr: rhrFrom(Number(iso[2])) ?? undefined });
      }
    }
    if (!current) {
      continue;
    }
    const rhr =
      line.match(/resting\s*hr\s*:\s*(\d{2,3})/i) ??
      (!compact && !iso ? line.match(/^(\d{2,3})\s*bpm$/i) : null);
    const hrv = line.match(/hrv\s*avg\s*:\s*(\d+(?:\.\d+)?)/i);
    const stress =
      line.match(/stress:\s*avg\s*(\d+(?:\.\d+)?)/i) ??
      line.match(/average\s*stress:\s*(\d+(?:\.\d+)?)/i);
    const score = line.match(/sleep\s*score:\s*(\d+(?:\.\d+)?)/i);
    const sleepText =
      line.match(/main\s*sleep:\s*(.+)$/i)?.[1] ?? line.match(/^total:\s*(.+)$/i)?.[1] ?? null;
    mergeDay(into, current, {
      ...(rhr ? { resting_hr: rhrFrom(Number(rhr[1])) ?? undefined } : {}),
      ...(hrv ? { sleep_hrv_ms: hrvMsFrom("hrvAvg", Number(hrv[1])) ?? undefined } : {}),
      ...(stress ? { stress_avg: stressFrom(Number(stress[1])) ?? undefined } : {}),
      ...(score ? { sleep_score: scoreFrom(Number(score[1])) ?? undefined } : {}),
      ...(sleepText
        ? { sleep_minutes: overnightSleepMinutes(clockToMinutes(sleepText) ?? undefined) ?? undefined }
        : {}),
    });
  }
}

function parseRecoveryPayload(value: unknown, into: Map<string, RecoveryDay>) {
  if (typeof value === "string") {
    parseHealthReport(value, into);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => parseRecoveryPayload(item, into));
    return;
  }
  const record = asRecord(value);
  if (!record) {
    return;
  }
  if (!isTimeSeriesPoint(record)) {
    const date = recordDate(record);
    if (date) {
      mergeDay(into, date, patchFromRecord(record));
    }
  }
  for (const item of Object.values(record)) {
    if (item && typeof item === "object") {
      parseRecoveryPayload(item, into);
    }
  }
}

function toolWindowDays(schema: unknown, fallback: number) {
  const hint = `${schemaProps(schema).days?.description ?? ""}`.toLowerCase();
  const max = hint.match(/maximum\s+(\d+)/);
  if (max) {
    return Math.min(fallback, Number(max[1]));
  }
  return fallback;
}

async function pullRecoveryWindow(
  client: Client,
  tool: { name: string; inputSchema?: unknown },
  startDaysAgo: number,
  endDaysAgo: number,
  timezone: string,
) {
  const into = new Map<string, RecoveryDay>();
  for (const compactDates of [true, false]) {
    try {
      const args = argsForDateRange(tool.inputSchema, startDaysAgo, endDaysAgo, {
        timezone,
        compactDates,
      });
      const payload = await callToolJson(client, tool.name, args);
      parseRecoveryPayload(payload, into);
      if ([...into.values()].some((day) => day.sleep_minutes || day.sleep_hrv_ms || day.resting_hr || day.stress_avg || day.sleep_score)) {
        return into;
      }
    } catch (error) {
      console.error(`COROS ${tool.name} failed`, { compactDates, startDaysAgo, endDaysAgo, error });
    }
  }
  return into;
}

async function pullRecoveryTool(
  client: Client,
  tools: { name: string; inputSchema?: unknown }[],
  name: string,
  daysAgo: number,
  timezone: string,
) {
  const tool = tools.find((entry) => entry.name === name);
  const into = new Map<string, RecoveryDay>();
  if (!tool) {
    return into;
  }
  const window = Math.max(1, toolWindowDays(tool.inputSchema, daysAgo));
  for (let endAgo = 0; endAgo < daysAgo; endAgo += window) {
    const startAgo = Math.min(daysAgo - 1, endAgo + window - 1);
    const pulled = await pullRecoveryWindow(client, tool, startAgo, endAgo, timezone);
    for (const day of pulled.values()) {
      mergeDay(into, day.date, day);
    }
  }
  return into;
}

function sameNumber(a: number | null | undefined, b: number | null | undefined) {
  if (a == null && b == null) {
    return true;
  }
  if (a == null || b == null) {
    return false;
  }
  return Math.abs(a - b) < 0.05;
}

function usableRhr(value: number | null | undefined) {
  return value == null ? null : rhrFrom(value);
}

function usableHrv(value: number | null | undefined) {
  return value == null ? null : hrvMsFrom("hrv", value);
}

function usableSleep(value: number | null | undefined) {
  return overnightSleepMinutes(value);
}

function usableScore(value: number | null | undefined) {
  return value == null ? null : scoreFrom(value);
}

function usableStress(value: number | null | undefined) {
  return value == null ? null : stressFrom(value);
}

export async function syncCorosRecovery(input: {
  client: Client;
  athleteId: string;
  tools: { name: string; inputSchema?: unknown }[];
  timeZone?: string;
  daysAgo?: number;
}) {
  const admin = createAdminClient();
  const timezone = input.timeZone || "Europe/London";
  const [{ count }, { count: hrvCount }, { count: rhrCount }] = await Promise.all([
    admin
      .from("daily_recovery")
      .select("date", { count: "exact", head: true })
      .eq("athlete_id", input.athleteId),
    admin
      .from("daily_recovery")
      .select("date", { count: "exact", head: true })
      .eq("athlete_id", input.athleteId)
      .not("sleep_hrv_ms", "is", null),
    admin
      .from("daily_recovery")
      .select("date", { count: "exact", head: true })
      .eq("athlete_id", input.athleteId)
      .not("resting_hr", "is", null),
  ]);
  const thinSignals = (hrvCount ?? 0) < 14 || (rhrCount ?? 0) < 7;
  const daysAgo =
    input.daysAgo ?? ((count ?? 0) < 21 || thinSignals ? RECOVERY_BACKFILL_DAYS : RECOVERY_SYNC_DAYS);

  const days = new Map<string, RecoveryDay>();
  for (const name of RECOVERY_TOOLS) {
    const pulled = await pullRecoveryTool(input.client, input.tools, name, daysAgo, timezone);
    for (const day of pulled.values()) {
      mergeDay(days, day.date, day);
    }
  }

  const dates = [...days.keys()].sort();
  const existingByDate = new Map<
    string,
    {
      resting_hr: number | null;
      sleep_hrv_ms: number | null;
      sleep_minutes: number | null;
      sleep_score: number | null;
      stress_avg: number | null;
    }
  >();
  if (dates.length > 0) {
    const { data: existing } = await admin
      .from("daily_recovery")
      .select("date, resting_hr, sleep_hrv_ms, sleep_minutes, sleep_score, stress_avg")
      .eq("athlete_id", input.athleteId)
      .gte("date", dates[0])
      .lte("date", dates[dates.length - 1]);
    for (const row of existing ?? []) {
      existingByDate.set(row.date, row);
    }
  }

  let saved = 0;
  let earliestChanged: string | null = null;
  for (const day of days.values()) {
    const previous = existingByDate.get(day.date);
    const resting_hr = day.resting_hr ?? usableRhr(previous?.resting_hr);
    const sleep_hrv_ms = day.sleep_hrv_ms ?? usableHrv(previous?.sleep_hrv_ms);
    const sleep_minutes = usableSleep(day.sleep_minutes) ?? usableSleep(previous?.sleep_minutes);
    const sleep_score = day.sleep_score ?? usableScore(previous?.sleep_score);
    const stress_avg = day.stress_avg ?? usableStress(previous?.stress_avg);
    const { error } = await admin.from("daily_recovery").upsert(
      {
        athlete_id: input.athleteId,
        date: day.date,
        source: "coros",
        resting_hr,
        sleep_hrv_ms,
        sleep_minutes,
        sleep_score,
        stress_avg,
      },
      { onConflict: "athlete_id,date" },
    );
    if (error) {
      console.error("COROS recovery upsert failed", error);
      continue;
    }
    saved += 1;
    const changed =
      !previous ||
      !sameNumber(previous.resting_hr, resting_hr) ||
      !sameNumber(previous.sleep_hrv_ms, sleep_hrv_ms) ||
      !sameNumber(previous.sleep_minutes, sleep_minutes) ||
      !sameNumber(previous.sleep_score, sleep_score) ||
      !sameNumber(previous.stress_avg, stress_avg);
    if (changed && (earliestChanged == null || day.date < earliestChanged)) {
      earliestChanged = day.date;
    }
    await admin.from("wellness_days").upsert(
      {
        athlete_id: input.athleteId,
        date: day.date,
        resting_hr,
        sleep_minutes,
        hrv_ms: sleep_hrv_ms,
        stress: stress_avg,
        source: "coros",
      },
      { onConflict: "athlete_id,date" },
    );
  }

  const withHrv = [...days.values()].filter((day) => day.sleep_hrv_ms != null).length;
  const withRhr = [...days.values()].filter((day) => day.resting_hr != null).length;
  const withSleep = [...days.values()].filter((day) => day.sleep_minutes != null).length;
  const withStress = [...days.values()].filter((day) => day.stress_avg != null).length;
  console.info("COROS recovery", {
    windowDays: daysAgo,
    listed: days.size,
    saved,
    withHrv,
    withRhr,
    withSleep,
    withStress,
    earliestChanged,
  });

  return { listed: days.size, saved, earliestChanged, windowDays: daysAgo };
}

export async function importCorosWellness(input: {
  client: Client;
  athleteId: string;
  tools: { name: string; inputSchema?: unknown }[];
}) {
  return syncCorosRecovery(input);
}
