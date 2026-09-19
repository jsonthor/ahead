import type { Json } from "@/lib/database.types";
import type { HrModel } from "@/lib/hr-model/types";
import { createAdminClient } from "@/lib/supabase/admin";

export const ZONE_NOTICE_RISE_BPM = 3;

export type ZoneNoticeField = "hr_max" | "cycling_lthr" | "running_lthr";

export type ZoneNotice = {
  id: string;
  field: ZoneNoticeField;
  from: number | null;
  to: number;
  at: string;
  dismissed: boolean;
};

export function isZoneNotice(value: unknown): value is ZoneNotice {
  if (!value || typeof value !== "object") {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    (row.field === "hr_max" || row.field === "cycling_lthr" || row.field === "running_lthr") &&
    (row.from === null || typeof row.from === "number") &&
    typeof row.to === "number" &&
    typeof row.at === "string" &&
    typeof row.dismissed === "boolean"
  );
}

export function parseZoneNotices(value: unknown): ZoneNotice[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isZoneNotice);
}

export function fieldLabel(field: ZoneNoticeField) {
  if (field === "hr_max") {
    return "maximum heart rate";
  }
  if (field === "cycling_lthr") {
    return "cycling threshold";
  }
  return "running threshold";
}

export function noticeCopy(notice: ZoneNotice) {
  const label = fieldLabel(notice.field);
  if (notice.from == null) {
    return `Ahead estimated your ${label} at ${notice.to} bpm from your files.`;
  }
  return `Ahead thinks your ${label} has risen to ${notice.to} bpm, up from ${notice.from}.`;
}

export function riseNotice(input: {
  field: ZoneNoticeField;
  from: number | null;
  to: number | null;
  at: string;
}): ZoneNotice | null {
  if (input.to == null || input.from == null) {
    return null;
  }
  if (input.to < input.from + ZONE_NOTICE_RISE_BPM) {
    return null;
  }
  return {
    id: `${input.field}-${input.at}-${input.to}`,
    field: input.field,
    from: input.from,
    to: input.to,
    at: input.at,
    dismissed: false,
  };
}

export function mergeNotices(existing: ZoneNotice[], incoming: ZoneNotice[]) {
  const next = [...existing];
  for (const notice of incoming) {
    const open = next.find(
      (row) => row.field === notice.field && !row.dismissed && row.to === notice.to,
    );
    if (open) {
      continue;
    }
    next.unshift(notice);
  }
  return next.slice(0, 12);
}

export function noticesAsJson(notices: ZoneNotice[]): Json {
  return notices as unknown as Json;
}

export async function recordZoneRises(input: {
  athleteId: string;
  previous: HrModel;
  next: {
    hrMax: number | null;
    cyclingLthr: number | null;
    runningLthr: number | null;
  };
  at: string;
}) {
  const incoming = [
    riseNotice({
      field: "hr_max",
      from: input.previous.hrMax,
      to: input.next.hrMax,
      at: input.at,
    }),
    riseNotice({
      field: "cycling_lthr",
      from: input.previous.cyclingLthr,
      to: input.next.cyclingLthr,
      at: input.at,
    }),
    riseNotice({
      field: "running_lthr",
      from: input.previous.runningLthr,
      to: input.next.runningLthr,
      at: input.at,
    }),
  ].filter((row): row is ZoneNotice => row != null);
  if (incoming.length === 0) {
    return;
  }
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("hr_zone_notices")
    .eq("id", input.athleteId)
    .maybeSingle();
  const notices = mergeNotices(parseZoneNotices(data?.hr_zone_notices), incoming);
  await admin
    .from("profiles")
    .update({ hr_zone_notices: noticesAsJson(notices) })
    .eq("id", input.athleteId);
}

export async function dismissZoneNotice(athleteId: string, noticeId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("hr_zone_notices")
    .eq("id", athleteId)
    .maybeSingle();
  const notices = parseZoneNotices(data?.hr_zone_notices).map((notice) =>
    notice.id === noticeId ? { ...notice, dismissed: true } : notice,
  );
  await admin
    .from("profiles")
    .update({ hr_zone_notices: noticesAsJson(notices) })
    .eq("id", athleteId);
  return notices;
}
