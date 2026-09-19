import { gunzipSync, gzipSync } from "node:zlib";
import type { Client } from "@modelcontextprotocol/client";
import { fitBytesFromToolResult } from "@/lib/coros/fit";
import {
  collectRecords,
  flattenCorosRecord,
  mapCorosActivity,
  parseCorosFields,
  recordId,
  type MappedActivity,
} from "@/lib/coros/map";
import {
  argsForActivity,
  argsForDateRange,
  callToolJson,
  callToolResult,
  schemaKeys,
} from "@/lib/coros/mcp";
import { syncCorosRecovery } from "@/lib/coros/recovery";
import type { Json } from "@/lib/database.types";
import { parseFitFile, type FitSummary, type StreamPoint } from "@/lib/fit/parse";
import { activityStreamPath } from "@/lib/fit/stream";
import { recomputeDailyLoads } from "@/lib/load/banister";
import type { WorkoutSport } from "@/lib/workout";
import { linkActivitiesToCalendarItems } from "@/lib/calendar-event";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordIntegrationSync } from "@/lib/ingest/sync";
import { assignImportedRoute, upsertImportedMetrics } from "@/lib/ingest/persist";
import type { ImportProgress } from "@/lib/coros/progress";

export const HISTORY_DAYS = 365 * 8;
const INCREMENTAL_DAYS = 21;
const WINDOW_DAYS = 30;
const EMPTY_WINDOWS_TO_STOP = 4;
const FIT_PER_RUN = 6;
const FIT_DAILY_CAP = 50;
const LIST_LIMIT = 500;
const PAGE_CAP = 140;

type ProgressFn = (progress: ImportProgress) => void | Promise<void>;

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function utcDay(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

type FitCursor = { date: string; count: number };

function readFitCursor(raw: string | null): FitCursor {
  if (!raw) {
    return { date: utcDay(), count: 0 };
  }
  try {
    const parsed = JSON.parse(raw) as { fit?: FitCursor };
    if (parsed.fit?.date === utcDay()) {
      return parsed.fit;
    }
  } catch {
    /* start a new day */
  }
  return { date: utcDay(), count: 0 };
}

function overlayFitSummary(activity: MappedActivity, summary: FitSummary): MappedActivity {
  return {
    ...activity,
    subsport: activity.subsport ?? summary.subsport,
    elapsed_seconds: summary.elapsed_seconds ?? activity.elapsed_seconds,
    moving_seconds: summary.moving_seconds ?? activity.moving_seconds,
    duration_seconds:
      summary.moving_seconds ??
      summary.elapsed_seconds ??
      activity.duration_seconds,
    distance_m: summary.distance_m ?? activity.distance_m,
    elevation_m: summary.elevation_m ?? activity.elevation_m,
    avg_hr: summary.avg_hr ?? activity.avg_hr,
    max_hr: summary.max_hr ?? activity.max_hr,
    avg_power: summary.avg_power ?? activity.avg_power,
    max_power: summary.max_power ?? activity.max_power,
    normalized_power: summary.normalized_power ?? activity.normalized_power,
    avg_cadence: summary.avg_cadence ?? activity.avg_cadence,
    avg_speed_mps: summary.avg_speed_mps ?? activity.avg_speed_mps,
  };
}

async function listActivities(
  client: Client,
  query: { name: string; inputSchema?: unknown },
  onProgress?: ProgressFn,
  maxDays = HISTORY_DAYS,
) {
  console.info("COROS querySportRecords schema", schemaKeys(query.inputSchema));
  const unique = new Map<string, Record<string, unknown>>();
  let emptyStreak = 0;
  let loggedPreview = false;
  const maxWindows = Math.max(1, Math.ceil(maxDays / WINDOW_DAYS));
  const incremental = maxDays <= INCREMENTAL_DAYS;

  for (let window = 0; window < maxWindows; window += 1) {
    const endDaysAgo = window * WINDOW_DAYS;
    const startDaysAgo = Math.min(maxDays, (window + 1) * WINDOW_DAYS);
    if (endDaysAgo >= maxDays) {
      break;
    }
    const from = new Date();
    from.setUTCDate(from.getUTCDate() - startDaysAgo);
    const yearLabel = String(from.getUTCFullYear());
    await onProgress?.({
      phase: "listing",
      message: incremental
        ? "Checking COROS for new sessions…"
        : unique.size
          ? `Searching COROS history… ${unique.size} so far (${yearLabel})`
          : `Searching COROS history… ${yearLabel}`,
      processed: unique.size,
      total: 0,
      saved: 0,
    });

    let addedInWindow = 0;
    for (let page = 1; page <= 20; page += 1) {
      try {
        const args = argsForDateRange(query.inputSchema, startDaysAgo, endDaysAgo, {
          timezone: "Europe/London",
          limit: LIST_LIMIT,
          page,
          offset: (page - 1) * LIST_LIMIT,
        });
        const listed = await callToolJson(client, query.name, args);
        if (!loggedPreview) {
          loggedPreview = true;
          console.info("COROS querySportRecords preview", {
            args,
            preview: typeof listed === "string" ? listed.slice(0, 1200) : listed,
          });
        }
        const records = collectRecords(listed);
        if (records.length === 0) {
          break;
        }
        let newThisPage = 0;
        for (const record of records) {
          const id = recordId(record);
          if (id && !unique.has(id)) {
            unique.set(id, record);
            newThisPage += 1;
          }
        }
        addedInWindow += newThisPage;
        if (records.length < PAGE_CAP || newThisPage === 0) {
          break;
        }
      } catch (error) {
        console.error("COROS querySportRecords window failed", {
          startDaysAgo,
          endDaysAgo,
          page,
          error,
        });
        break;
      }
    }

    if (addedInWindow === 0) {
      emptyStreak += 1;
      if (unique.size > 0 && emptyStreak >= EMPTY_WINDOWS_TO_STOP) {
        break;
      }
    } else {
      emptyStreak = 0;
    }
  }

  return { records: [...unique.values()], days: unique.size };
}

async function storeOriginal(input: {
  athleteId: string;
  sourceActivityId: string;
  bytes: Buffer;
}) {
  const admin = createAdminClient();
  const path = `${input.athleteId}/${input.sourceActivityId}.fit`;
  const { error } = await admin.storage.from("activity-originals").upload(path, input.bytes, {
    contentType: "application/octet-stream",
    upsert: true,
  });
  if (error) {
    throw error;
  }
  return path;
}

async function storeStream(input: {
  athleteId: string;
  sourceActivityId: string;
  stream: StreamPoint[];
}) {
  const admin = createAdminClient();
  const path = activityStreamPath(input.athleteId, input.sourceActivityId);
  const body = gzipSync(Buffer.from(JSON.stringify(input.stream)));
  const { error } = await admin.storage.from("activity-streams").upload(path, body, {
    contentType: "application/gzip",
    upsert: true,
  });
  if (error) {
    throw error;
  }
  return path;
}

function decodeStreamBytes(bytes: Buffer): StreamPoint[] | null {
  try {
    const json = (
      bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes
    ).toString("utf8");
    const parsed = JSON.parse(json) as unknown;
    return Array.isArray(parsed) ? (parsed as StreamPoint[]) : null;
  } catch {
    return null;
  }
}

async function readStoredStream(path: string): Promise<StreamPoint[] | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("activity-streams").download(path);
  if (error || !data) {
    return null;
  }
  return decodeStreamBytes(Buffer.from(await data.arrayBuffer()));
}

async function readStoredOriginal(path: string): Promise<Buffer | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("activity-originals").download(path);
  if (error || !data) {
    return null;
  }
  return Buffer.from(await data.arrayBuffer());
}

function mappedFromRow(row: {
  source: string;
  source_activity_id: string;
  sport: string;
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
}): MappedActivity {
  const source =
    row.source === "fit" || row.source === "gpx" || row.source === "tcx"
      ? row.source
      : "coros";
  return {
    source,
    source_activity_id: row.source_activity_id,
    sport: row.sport as WorkoutSport,
    subsport: row.subsport,
    started_at: row.started_at,
    duration_seconds: row.duration_seconds,
    elapsed_seconds: row.elapsed_seconds,
    moving_seconds: row.moving_seconds,
    distance_m: row.distance_m,
    elevation_m: row.elevation_m,
    avg_hr: row.avg_hr,
    max_hr: row.max_hr,
    avg_power: row.avg_power,
    max_power: row.max_power,
    normalized_power: row.normalized_power,
    avg_cadence: row.avg_cadence,
    avg_speed_mps: row.avg_speed_mps,
    vendor: row.vendor,
  };
}

async function persistParsedFit(input: {
  athleteId: string;
  activityId: string;
  activity: MappedActivity;
  bytes: Buffer;
  rawFitKey: string;
}) {
  let activity = input.activity;
  let stream: StreamPoint[] = [];
  let providerProfileHrMax: number | null = null;
  let laps: {
    source_index: number;
    started_at: string | null;
    duration_seconds: number | null;
    distance_m: number | null;
    avg_hr: number | null;
    avg_power: number | null;
  }[] = [];
  try {
    const parsed = await parseFitFile(input.bytes);
    activity = overlayFitSummary(activity, parsed.summary);
    stream = parsed.stream;
    providerProfileHrMax = parsed.summary.profile_hr_max;
    laps = parsed.laps;
    if (stream.length > 0) {
      await storeStream({
        athleteId: input.athleteId,
        sourceActivityId: activity.source_activity_id,
        stream,
      });
    }
    await replaceLaps(input.activityId, input.athleteId, parsed.laps);
  } catch (error) {
    console.error("COROS FIT parse failed", {
      id: activity.source_activity_id,
      error,
    });
  }
  await upsertActivity(input.athleteId, activity, { raw_fit_key: input.rawFitKey });
  await upsertMetrics(input.athleteId, input.activityId, activity, stream.length ? stream : undefined, {
    providerProfileHrMax,
    hasFit: true,
    hasLaps: laps.length > 0,
    laps,
  });
  await assignImportedRoute({
    athleteId: input.athleteId,
    activityId: input.activityId,
    sport: activity.sport,
    distanceM: activity.distance_m,
    elevationM: activity.elevation_m,
    stream,
  });
  return stream;
}

async function tryFitTool(
  client: Client,
  tool: { name: string; inputSchema?: unknown } | undefined,
  record: Record<string, unknown>,
  id: string,
): Promise<Buffer | null> {
  if (!tool) {
    return null;
  }
  try {
    const args = argsForActivity(tool.inputSchema, record, id);
    const result = await callToolResult(client, tool.name, args, 1);
    return await fitBytesFromToolResult(result);
  } catch (error) {
    console.error("COROS FIT tool failed", { name: tool.name, id, error });
    return null;
  }
}

async function downloadCorosFit(input: {
  origin: string;
  athleteId: string;
  activityId: string;
  sourceActivityId: string;
  sport: string;
  subsport: string | null;
}): Promise<{ bytes: Buffer | null; unauthorized?: boolean }> {
  const { openCorosClient } = await import("@/lib/coros/connect");
  try {
    const session = await openCorosClient({
      origin: input.origin,
      athleteId: input.athleteId,
      returnPath: `/app/calendar?activity=${input.activityId}`,
    });
    if ("unauthorized" in session && session.unauthorized) {
      return { bytes: null, unauthorized: true };
    }
    try {
      const tools = await session.client.listTools();
      const fitTool = tools.tools.find((tool) => tool.name === "downloadActivityFitFiles");
      const fitUrlTool = tools.tools.find(
        (tool) => tool.name === "queryActivityFitFileDownloadUrls",
      );
      const sportType =
        input.sport === "ride"
          ? input.subsport === "indoor"
            ? 201
            : input.subsport === "gravel"
              ? 203
              : 200
          : input.sport === "run"
            ? 100
            : input.sport === "swim"
              ? 300
              : input.sport === "strength"
                ? 402
                : input.sport === "walk"
                  ? 900
                  : null;
      const record: Record<string, unknown> = {
        id: input.sourceActivityId,
        ...(sportType == null ? {} : { sportType }),
      };
      const embedded = await tryFitTool(
        session.client,
        fitTool,
        record,
        input.sourceActivityId,
      );
      if (embedded) {
        return { bytes: embedded };
      }
      const fromUrl = await tryFitTool(
        session.client,
        fitUrlTool,
        record,
        input.sourceActivityId,
      );
      return { bytes: fromUrl };
    } finally {
      await session.client.close();
    }
  } catch (error) {
    console.error("COROS FIT session failed", error);
    return { bytes: null };
  }
}

export async function ensureActivityStream(input: {
  origin: string;
  athleteId: string;
  activityId: string;
  source: string;
  sourceActivityId: string;
  rawFitKey: string | null;
  row: Parameters<typeof mappedFromRow>[0];
}): Promise<{ stream: StreamPoint[]; unauthorized?: boolean }> {
  const streamPath = activityStreamPath(input.athleteId, input.sourceActivityId);
  const stored = await readStoredStream(streamPath);
  if (stored && stored.length > 0) {
    return { stream: stored };
  }

  if (input.rawFitKey) {
    const original = await readStoredOriginal(input.rawFitKey);
    if (original) {
      const stream = await persistParsedFit({
        athleteId: input.athleteId,
        activityId: input.activityId,
        activity: mappedFromRow(input.row),
        bytes: original,
        rawFitKey: input.rawFitKey,
      });
      if (stream.length > 0) {
        return { stream };
      }
    }
  }

  if (stored && stored.length > 0) {
    return { stream: stored };
  }

  return { stream: [] };
}

async function upsertActivity(athleteId: string, activity: MappedActivity, extra: {
  raw_fit_key?: string | null;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("activities")
    .upsert(
      {
        athlete_id: athleteId,
        ...activity,
        ...(extra.raw_fit_key !== undefined ? { raw_fit_key: extra.raw_fit_key } : {}),
        status: "ready",
      },
      { onConflict: "athlete_id,source,source_activity_id" },
    )
    .select("id, raw_fit_key")
    .single();
  if (error) {
    throw error;
  }
  return data;
}

async function timeZoneFor(athleteId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("timezone")
    .eq("id", athleteId)
    .maybeSingle();
  return data?.timezone || "Europe/London";
}

async function upsertMetrics(
  athleteId: string,
  activityId: string,
  activity: MappedActivity,
  stream: StreamPoint[] | undefined,
  extra?: {
    providerProfileHrMax?: number | null;
    hasFit?: boolean;
    hasLaps?: boolean;
    rpe?: number | null;
    sessionType?: string | null;
    laps?: {
      duration_seconds: number | null;
      avg_hr: number | null;
      avg_power: number | null;
    }[];
  },
) {
  return upsertImportedMetrics(activityId, activity, stream, {
    athleteId,
    timeZone: await timeZoneFor(athleteId),
    providerProfileHrMax: extra?.providerProfileHrMax,
    hasFit: extra?.hasFit,
    hasLaps: extra?.hasLaps,
    rpe: extra?.rpe,
    sessionType: extra?.sessionType,
    laps: extra?.laps,
  });
}

async function replaceLaps(
  activityId: string,
  athleteId: string,
  laps: {
    source_index: number;
    started_at: string | null;
    duration_seconds: number | null;
    distance_m: number | null;
    avg_hr: number | null;
    avg_power: number | null;
  }[],
) {
  if (laps.length === 0) {
    return;
  }
  const admin = createAdminClient();
  await admin.from("activity_laps").delete().eq("activity_id", activityId);
  const { error } = await admin.from("activity_laps").insert(
    laps.map((lap) => ({
      activity_id: activityId,
      athlete_id: athleteId,
      ...lap,
    })),
  );
  if (error) {
    console.error("COROS lap insert failed", error);
  }
}

async function maybeDetail(
  client: Client,
  detail: { name: string; inputSchema?: unknown } | undefined,
  record: Record<string, unknown>,
  body: Record<string, unknown>,
) {
  const mapped = mapCorosActivity(body);
  if (mapped?.duration_seconds && mapped.started_at) {
    return { body, activity: mapped };
  }
  const id = recordId(record);
  if (!detail || !id) {
    return { body, activity: mapped };
  }
  try {
    const detailArgs = argsForActivity(detail.inputSchema, record, id);
    const raw = await callToolJson(client, detail.name, detailArgs);
    const detailed =
      typeof raw === "string"
        ? parseCorosFields(raw)
        : (collectRecords(raw)[0] ?? asObject(raw) ?? {});
    const next = flattenCorosRecord({ ...body, ...detailed });
    return { body: next, activity: mapCorosActivity(next) };
  } catch (error) {
    console.error("COROS getActivityDetail failed", { id, error });
    return { body, activity: mapped };
  }
}

export async function importRecentCorosActivities(input: {
  client: Client;
  athleteId: string;
  onProgress?: ProgressFn;
}) {
  const startedAt = new Date();
  const report: ProgressFn = async (progress) => {
    await input.onProgress?.(progress);
  };
  try {
    return await runCorosImport({ ...input, startedAt, report });
  } catch (error) {
    await recordIntegrationSync({
      athleteId: input.athleteId,
      provider: "coros",
      startedAt,
      status: "error",
      message: error instanceof Error ? error.message : "Import failed.",
    });
    throw error;
  }
}

async function runCorosImport(input: {
  client: Client;
  athleteId: string;
  startedAt: Date;
  report: ProgressFn;
}) {
  const { report } = input;
  const admin = createAdminClient();
  const { count: existingCount } = await admin
    .from("activities")
    .select("id", { count: "exact", head: true })
    .eq("athlete_id", input.athleteId)
    .eq("source", "coros");
  const incremental = (existingCount ?? 0) > 0;
  const historyDays = incremental ? INCREMENTAL_DAYS : HISTORY_DAYS;

  await report({
    phase: "listing",
    message: incremental
      ? "Checking COROS for new sessions…"
      : "Asking COROS for your full activity history…",
    processed: 0,
    total: 0,
    saved: 0,
  });

  const tools = await input.client.listTools();
  const query = tools.tools.find((tool) => tool.name === "querySportRecords");
  const detail = tools.tools.find((tool) => tool.name === "getActivityDetail");
  const fitTool = tools.tools.find((tool) => tool.name === "downloadActivityFitFiles");
  const fitUrlTool = tools.tools.find(
    (tool) => tool.name === "queryActivityFitFileDownloadUrls",
  );
  if (!query) {
    throw new Error("COROS MCP is missing querySportRecords.");
  }

  const listed = await listActivities(input.client, query, report, historyDays);
  const unique = new Map<string, Record<string, unknown>>();
  for (const record of listed.records) {
    const id = recordId(record);
    if (id && !unique.has(id)) {
      unique.set(id, record);
    }
  }

  const recent = [...unique.values()].sort((a, b) => {
    const left = String(a.startTimestamp ?? a.startedAt ?? a.startTime ?? a.start_time ?? "");
    const right = String(b.startTimestamp ?? b.startedAt ?? b.startTime ?? b.start_time ?? "");
    return right.localeCompare(left);
  });
  const total = recent.length;
  await report({
    phase: "activities",
    message: incremental
      ? total
        ? `Checking ${total} recent sessions for anything new…`
        : "COROS did not return any recent activities."
      : total
        ? `Found ${total} activities. Saving them now…`
        : "COROS did not return any activities in that window.",
    processed: 0,
    total,
    saved: 0,
  });

  const { data: profile } = await admin
    .from("profiles")
    .select("timezone")
    .eq("id", input.athleteId)
    .maybeSingle();
  const timeZone = profile?.timezone || "Europe/London";
  const { data: integration } = await admin
    .from("integrations")
    .select("cursor")
    .eq("athlete_id", input.athleteId)
    .eq("provider", "coros")
    .maybeSingle();
  const fitQuota = readFitCursor(integration?.cursor ?? null);
  let fitThisRun = 0;
  let saved = 0;
  let skipped = 0;
  let fitSaved = 0;

  const known = new Map<string, { id: string; raw_fit_key: string | null }>();
  if (incremental && recent.length > 0) {
    const listedIds = recent
      .map((record) => recordId(record))
      .filter((id): id is string => Boolean(id));
    for (let i = 0; i < listedIds.length; i += 100) {
      const chunk = listedIds.slice(i, i + 100);
      const { data: existing } = await admin
        .from("activities")
        .select("id, source_activity_id, raw_fit_key")
        .eq("athlete_id", input.athleteId)
        .eq("source", "coros")
        .in("source_activity_id", chunk);
      for (const row of existing ?? []) {
        if (row.source_activity_id) {
          known.set(row.source_activity_id, {
            id: row.id,
            raw_fit_key: row.raw_fit_key,
          });
        }
      }
    }
  }

  const mappedRows: {
    id: string;
    record: Record<string, unknown>;
    activity: MappedActivity;
    rawFitKey: string | null;
  }[] = [];

  for (const [index, record] of recent.entries()) {
    const id = recordId(record);
    const existing = id ? known.get(id) : undefined;
    if (existing) {
      skipped += 1;
      if (!existing.raw_fit_key) {
        const body = flattenCorosRecord(record);
        const activity = mapCorosActivity(body);
        if (activity) {
          mappedRows.push({
            id: existing.id,
            record: body,
            activity,
            rawFitKey: existing.raw_fit_key,
          });
        }
      }
      if (index === 0 || (index + 1) % 5 === 0 || index + 1 === total) {
        await report({
          phase: "activities",
          message: saved
            ? `Found ${saved} new ${saved === 1 ? "activity" : "activities"}…`
            : "Already have these sessions. Looking for anything new…",
          processed: index + 1,
          total,
          saved,
        });
      }
      continue;
    }

    const body = flattenCorosRecord(record);
    const resolved = await maybeDetail(input.client, detail, record, body);
    const activity = resolved.activity;
    if (!activity) {
      console.error("COROS map skipped activity", {
        id,
        keys: Object.keys(resolved.body),
      });
      continue;
    }
    try {
      const row = await upsertActivity(input.athleteId, activity, {});
      saved += 1;
      mappedRows.push({
        id: row.id,
        record: resolved.body,
        activity,
        rawFitKey: row.raw_fit_key,
      });
      await upsertMetrics(input.athleteId, row.id, activity, undefined);
    } catch (error) {
      console.error("COROS activity upsert failed", error);
    }
    if (index === 0 || (index + 1) % 5 === 0 || index + 1 === total) {
      await report({
        phase: "activities",
        message: incremental
          ? `Saving new ${activity.sport} · ${saved} new so far`
          : `Saving ${activity.sport} · ${index + 1} of ${total}`,
        processed: index + 1,
        total,
        saved,
      });
    }
  }

  if (mappedRows.length > 0) {
    try {
      await linkActivitiesToCalendarItems(admin, {
        athleteId: input.athleteId,
        timeZone,
        activities: mappedRows.map((row) => ({
          id: row.id,
          startedAt: row.activity.started_at,
          sport: row.activity.sport,
          durationSeconds: row.activity.duration_seconds,
        })),
      });
    } catch (error) {
      console.error("Calendar event matching failed", error);
    }
  }

  const fitCandidates = mappedRows.filter((row) => !row.rawFitKey).slice(0, FIT_PER_RUN);
  if (fitCandidates.length > 0 && (fitTool || fitUrlTool)) {
    await report({
      phase: "fit",
      message: "Downloading original FIT files for the newest sessions…",
      processed: saved,
      total,
      saved,
    });
  }

  for (const row of fitCandidates) {
    if (fitQuota.count >= FIT_DAILY_CAP || fitThisRun >= FIT_PER_RUN) {
      break;
    }
    let activity = row.activity;
    let stream: StreamPoint[] | undefined;
    let providerProfileHrMax: number | null = null;
    let laps: {
      duration_seconds: number | null;
      avg_hr: number | null;
      avg_power: number | null;
    }[] = [];
    fitThisRun += 1;
    fitQuota.count += 1;
    const tool = fitTool ?? fitUrlTool;
    if (!tool) {
      break;
    }
    try {
      const args = argsForActivity(tool.inputSchema, row.record, activity.source_activity_id);
      const result = await callToolResult(input.client, tool.name, args);
      if (fitThisRun === 1) {
        console.info("COROS FIT tool sample", {
          name: tool.name,
          args,
          types: (result.content ?? []).map((block) => block.type),
        });
      }
      let bytes = await fitBytesFromToolResult(result);
      if (!bytes && fitUrlTool && tool.name !== fitUrlTool.name) {
        const urlArgs = argsForActivity(
          fitUrlTool.inputSchema,
          row.record,
          activity.source_activity_id,
        );
        const urlResult = await callToolResult(input.client, fitUrlTool.name, urlArgs);
        bytes = await fitBytesFromToolResult(urlResult);
      }
      if (!bytes) {
        continue;
      }
      const rawFitKey = await storeOriginal({
        athleteId: input.athleteId,
        sourceActivityId: activity.source_activity_id,
        bytes,
      });
      try {
        const parsed = await parseFitFile(bytes);
        activity = overlayFitSummary(activity, parsed.summary);
        stream = parsed.stream;
        providerProfileHrMax = parsed.summary.profile_hr_max;
        laps = parsed.laps;
        if (stream.length > 0) {
          await storeStream({
            athleteId: input.athleteId,
            sourceActivityId: activity.source_activity_id,
            stream,
          });
        }
        await replaceLaps(row.id, input.athleteId, parsed.laps);
      } catch (error) {
        console.error("COROS FIT parse failed", {
          id: activity.source_activity_id,
          error,
        });
      }
      await upsertActivity(input.athleteId, activity, { raw_fit_key: rawFitKey });
      await upsertMetrics(input.athleteId, row.id, activity, stream, {
        providerProfileHrMax,
        hasFit: true,
        hasLaps: laps.length > 0,
        laps,
      });
      await assignImportedRoute({
        athleteId: input.athleteId,
        activityId: row.id,
        sport: activity.sport,
        distanceM: activity.distance_m,
        elevationM: activity.elevation_m,
        stream,
      });
      fitSaved += 1;
      await report({
        phase: "fit",
        message: `Stored FIT for ${activity.sport} (${fitSaved} this run)`,
        processed: saved,
        total,
        saved,
      });
    } catch (error) {
      console.error("COROS FIT download failed", {
        id: activity.source_activity_id,
        error,
      });
    }
  }

  await report({
    phase: "wellness",
    message: "Syncing daily recovery (sleep, HRV, resting HR, stress)…",
    processed: saved,
    total,
    saved,
  });
  const wellness = await syncCorosRecovery({
    client: input.client,
    athleteId: input.athleteId,
    tools: tools.tools,
    timeZone,
  });

  await report({
    phase: "load",
    message: "Calculating Fitness, Fatigue, and Form…",
    processed: saved,
    total,
    saved,
  });
  let daily = 0;
  try {
    daily = await recomputeDailyLoads(input.athleteId, timeZone);
  } catch (error) {
    console.error("Potential daily load recompute failed", error);
  }

  await admin
    .from("integrations")
    .update({
      last_sync_at: new Date().toISOString(),
      status: "connected",
      cursor: JSON.stringify({ fit: fitQuota }),
    })
    .eq("athlete_id", input.athleteId)
    .eq("provider", "coros");

  console.info("COROS import", {
    listed: unique.size,
    incremental,
    saved,
    skipped,
    fitSaved,
    wellness: wellness.saved,
    daily,
    fitQuota,
  });

  const done: ImportProgress = {
    phase: "done",
    message: incremental
      ? saved
        ? `Added ${saved} new ${saved === 1 ? "activity" : "activities"} from COROS.`
        : "Checked COROS. No new activities. Recovery updated."
      : saved
        ? `Imported ${saved} activities from COROS.`
        : "Connected. No new activities in that window.",
    processed: total,
    total,
    saved,
  };
  await recordIntegrationSync({
    athleteId: input.athleteId,
    provider: "coros",
    startedAt: input.startedAt,
    status: "ok",
    activitiesSaved: saved,
    recoveryDays: wellness.saved,
    message: done.message,
  });
  await report(done);
  return { listed: unique.size, saved, fitSaved };
}
