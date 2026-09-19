import { gunzipSync } from "node:zlib";
import type { StreamPoint } from "@/lib/fit/parse";
import { activityStreamPath } from "@/lib/fit/stream";
import { createAdminClient } from "@/lib/supabase/admin";

export async function readActivityStream(input: {
  athleteId: string;
  sourceActivityId: string;
}): Promise<StreamPoint[] | null> {
  const admin = createAdminClient();
  const path = activityStreamPath(input.athleteId, input.sourceActivityId);
  const { data, error } = await admin.storage.from("activity-streams").download(path);
  if (error || !data) {
    return null;
  }
  try {
    const bytes = Buffer.from(await data.arrayBuffer());
    const json = (
      bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes
    ).toString("utf8");
    const parsed = JSON.parse(json) as unknown;
    return Array.isArray(parsed) ? (parsed as StreamPoint[]) : null;
  } catch {
    return null;
  }
}
