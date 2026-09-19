import { createHash } from "node:crypto";
import type { MappedActivity } from "@/lib/coros/map";
import type { ImportProgress } from "@/lib/coros/progress";
import { parseGpxFile } from "@/lib/ingest/gpx";
import {
  assignImportedRoute,
  replaceImportedLaps,
  storeActivityStream,
  storeOriginalFile,
  upsertImportedActivity,
  upsertImportedMetrics,
} from "@/lib/ingest/persist";
import { recordIntegrationSync } from "@/lib/ingest/sync";
import { sportFromLabel } from "@/lib/ingest/sport";
import { parseTcxFile } from "@/lib/ingest/tcx";
import { looksLikeZip, unzipEntries } from "@/lib/ingest/zip";
import { looksLikeFit, parseFitFile } from "@/lib/fit/parse";
import { linkActivitiesToCalendarItems } from "@/lib/calendar-event";
import { recomputeDailyLoads } from "@/lib/load/banister";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_TOP_LEVEL = 40;
const MAX_ACTIVITIES = 250;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_TOTAL_BYTES = 80 * 1024 * 1024;

type ProgressFn = (progress: ImportProgress) => void | Promise<void>;

export type UploadedFile = {
  name: string;
  bytes: Buffer;
};

type WorkItem = {
  name: string;
  source: "fit" | "gpx" | "tcx";
  bytes: Buffer;
};

function extensionOf(name: string) {
  const base = name.split("/").pop()?.split("\\").pop() ?? name;
  const lower = base.toLowerCase();
  if (lower.endsWith(".fit")) {
    return "fit" as const;
  }
  if (lower.endsWith(".gpx")) {
    return "gpx" as const;
  }
  if (lower.endsWith(".tcx")) {
    return "tcx" as const;
  }
  if (lower.endsWith(".zip")) {
    return "zip" as const;
  }
  return null;
}

function sourceId(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex").slice(0, 24);
}

function expand(files: UploadedFile[]): WorkItem[] {
  const items: WorkItem[] = [];
  for (const file of files) {
    const kind = extensionOf(file.name);
    if (kind === "zip" || looksLikeZip(file.bytes)) {
      const entries = unzipEntries(file.bytes);
      for (const entry of entries) {
        const inner = extensionOf(entry.name);
        if (inner === "fit" || inner === "gpx" || inner === "tcx") {
          items.push({ name: entry.name, source: inner, bytes: entry.data });
        } else if (looksLikeFit(entry.data)) {
          items.push({ name: entry.name, source: "fit", bytes: entry.data });
        }
      }
      continue;
    }
    if (kind === "fit" || looksLikeFit(file.bytes)) {
      items.push({ name: file.name, source: "fit", bytes: file.bytes });
      continue;
    }
    if (kind === "gpx") {
      items.push({ name: file.name, source: "gpx", bytes: file.bytes });
      continue;
    }
    if (kind === "tcx") {
      items.push({ name: file.name, source: "tcx", bytes: file.bytes });
    }
  }
  return items;
}

function asActivity(
  source: WorkItem["source"],
  sourceActivityId: string,
  parsed: {
    sport: MappedActivity["sport"];
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
    fileName: string;
    normalizedPower?: number | null;
    subsport?: string | null;
  },
): MappedActivity {
  return {
    source,
    source_activity_id: sourceActivityId,
    sport: parsed.sport,
    subsport: parsed.subsport ?? null,
    started_at: parsed.startedAt,
    duration_seconds: parsed.durationSeconds,
    elapsed_seconds: parsed.elapsedSeconds,
    moving_seconds: parsed.movingSeconds,
    distance_m: parsed.distanceM,
    elevation_m: parsed.elevationM,
    avg_hr: parsed.avgHr,
    max_hr: parsed.maxHr,
    avg_power: parsed.avgPower,
    max_power: parsed.maxPower,
    normalized_power: parsed.normalizedPower ?? null,
    avg_cadence: parsed.avgCadence,
    avg_speed_mps: parsed.avgSpeedMps,
    vendor: { file_name: parsed.fileName },
  };
}

async function parseItem(item: WorkItem) {
  if (item.source === "fit") {
    if (!looksLikeFit(item.bytes)) {
      throw new Error("Not a FIT file.");
    }
    const parsed = await parseFitFile(item.bytes);
    if (!parsed.summary.started_at) {
      throw new Error("FIT file has no start time.");
    }
    return {
      activity: asActivity("fit", sourceId(item.bytes), {
        sport: sportFromLabel(parsed.summary.sport ?? item.name),
        startedAt: parsed.summary.started_at,
        durationSeconds:
          parsed.summary.moving_seconds ?? parsed.summary.elapsed_seconds,
        elapsedSeconds: parsed.summary.elapsed_seconds,
        movingSeconds: parsed.summary.moving_seconds,
        distanceM: parsed.summary.distance_m,
        elevationM: parsed.summary.elevation_m,
        avgHr: parsed.summary.avg_hr,
        maxHr: parsed.summary.max_hr,
        avgPower: parsed.summary.avg_power,
        maxPower: parsed.summary.max_power,
        avgCadence: parsed.summary.avg_cadence,
        avgSpeedMps: parsed.summary.avg_speed_mps,
        normalizedPower: parsed.summary.normalized_power,
        subsport: parsed.summary.subsport,
        fileName: item.name,
      }),
      stream: parsed.stream,
      laps: parsed.laps,
      providerProfileHrMax: parsed.summary.profile_hr_max,
    };
  }
  const xml = item.bytes.toString("utf8");
  const parsed =
    item.source === "gpx" ? parseGpxFile(xml, item.name) : parseTcxFile(xml, item.name);
  if (!parsed) {
    throw new Error(`Could not read ${item.source.toUpperCase()} file.`);
  }
  return {
    activity: asActivity(item.source, sourceId(item.bytes), {
      sport: parsed.sport,
      startedAt: parsed.startedAt,
      durationSeconds: parsed.durationSeconds,
      elapsedSeconds: parsed.elapsedSeconds,
      movingSeconds: parsed.movingSeconds,
      distanceM: parsed.distanceM,
      elevationM: parsed.elevationM,
      avgHr: parsed.avgHr,
      maxHr: parsed.maxHr,
      avgPower: parsed.avgPower,
      maxPower: parsed.maxPower,
      avgCadence: parsed.avgCadence,
      avgSpeedMps: parsed.avgSpeedMps,
      fileName: item.name,
    }),
    stream: parsed.stream,
    laps: parsed.laps,
    providerProfileHrMax: null,
  };
}

export async function importUploadedFiles(input: {
  athleteId: string;
  files: UploadedFile[];
  onProgress?: ProgressFn;
}) {
  const startedAt = new Date();
  const report: ProgressFn = async (progress) => {
    await input.onProgress?.(progress);
  };
  try {
    if (input.files.length === 0) {
      throw new Error("Choose a FIT, GPX, TCX, or zip file.");
    }
    if (input.files.length > MAX_TOP_LEVEL) {
      throw new Error(`Upload up to ${MAX_TOP_LEVEL} files at a time.`);
    }
    const totalBytes = input.files.reduce((sum, file) => sum + file.bytes.length, 0);
    if (totalBytes > MAX_TOTAL_BYTES) {
      throw new Error("That upload is too large. Try a smaller zip or fewer files.");
    }
    for (const file of input.files) {
      if (file.bytes.length > MAX_FILE_BYTES) {
        throw new Error(`${file.name} is larger than 50 MB.`);
      }
    }

    await report({
      phase: "listing",
      message: "Unpacking files…",
      processed: 0,
      total: 0,
      saved: 0,
    });
    const items = expand(input.files).slice(0, MAX_ACTIVITIES);
    if (items.length === 0) {
      throw new Error("No FIT, GPX, or TCX files in that upload.");
    }

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("timezone")
      .eq("id", input.athleteId)
      .maybeSingle();
    const timeZone = profile?.timezone || "Europe/London";

    const total = items.length;
    let saved = 0;
    let failed = 0;
    const mappedRows: {
      id: string;
      startedAt: string;
      sport: MappedActivity["sport"];
      durationSeconds: number | null;
    }[] = [];

    for (const [index, item] of items.entries()) {
      await report({
        phase: "activities",
        message: `Reading ${item.name.split("/").pop()}…`,
        processed: index,
        total,
        saved,
      });
      try {
        const parsed = await parseItem(item);
        const rawKey = await storeOriginalFile({
          athleteId: input.athleteId,
          sourceActivityId: parsed.activity.source_activity_id,
          bytes: item.bytes,
          extension: item.source,
        });
        await storeActivityStream({
          athleteId: input.athleteId,
          sourceActivityId: parsed.activity.source_activity_id,
          stream: parsed.stream,
        });
        const row = await upsertImportedActivity(input.athleteId, parsed.activity, {
          raw_fit_key: rawKey,
        });
        await upsertImportedMetrics(row.id, parsed.activity, parsed.stream, {
          athleteId: input.athleteId,
          timeZone,
          providerProfileHrMax: parsed.providerProfileHrMax,
          hasFit: item.source === "fit",
          hasLaps: parsed.laps.length > 0,
          laps: parsed.laps,
        });
        await replaceImportedLaps(row.id, input.athleteId, parsed.laps);
        await assignImportedRoute({
          athleteId: input.athleteId,
          activityId: row.id,
          sport: parsed.activity.sport,
          distanceM: parsed.activity.distance_m,
          elevationM: parsed.activity.elevation_m,
          stream: parsed.stream,
        });
        saved += 1;
        mappedRows.push({
          id: row.id,
          startedAt: parsed.activity.started_at,
          sport: parsed.activity.sport,
          durationSeconds: parsed.activity.duration_seconds,
        });
      } catch (error) {
        failed += 1;
        console.error("File upload parse failed", { name: item.name, error });
      }
    }

    if (mappedRows.length > 0) {
      try {
        await linkActivitiesToCalendarItems(admin, {
          athleteId: input.athleteId,
          timeZone,
          activities: mappedRows,
        });
      } catch (error) {
        console.error("Calendar event matching failed", error);
      }
    }

    await report({
      phase: "load",
      message: "Calculating Fitness, Fatigue, and Form…",
      processed: total,
      total,
      saved,
    });
    try {
      await recomputeDailyLoads(input.athleteId, timeZone);
    } catch (error) {
      console.error("Uploaded file load recompute failed", error);
    }

    await admin.from("integrations").upsert(
      {
        athlete_id: input.athleteId,
        provider: "fit",
        status: "connected",
        last_sync_at: new Date().toISOString(),
      },
      { onConflict: "athlete_id,provider" },
    );

    const done: ImportProgress = {
      phase: "done",
      message:
        saved === 0
          ? "None of those files could be imported."
          : failed
            ? `Imported ${saved} ${saved === 1 ? "activity" : "activities"}. ${failed} could not be read.`
            : `Imported ${saved} ${saved === 1 ? "activity" : "activities"} from your files.`,
      processed: total,
      total,
      saved,
    };
    await recordIntegrationSync({
      athleteId: input.athleteId,
      provider: "fit",
      startedAt,
      status: saved > 0 ? "ok" : "error",
      activitiesSaved: saved,
      message: done.message,
    });
    await report(done);
    return { saved, failed, listed: total };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    await recordIntegrationSync({
      athleteId: input.athleteId,
      provider: "fit",
      startedAt,
      status: "error",
      message,
    });
    const failed: ImportProgress = {
      phase: "error",
      message,
      processed: 0,
      total: 0,
      saved: 0,
    };
    await report(failed);
    return { saved: 0, failed: 1, listed: 0 };
  }
}