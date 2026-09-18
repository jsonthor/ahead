import { ensureActivityStream } from "@/lib/coros/import";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: RouteContext<"/api/activities/[id]/streams">,
) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "auth" }, { status: 401 });
  }

  const { data: row, error } = await supabase
    .from("activities")
    .select(
      "id, athlete_id, source, source_activity_id, sport, subsport, started_at, duration_seconds, elapsed_seconds, moving_seconds, distance_m, elevation_m, avg_hr, max_hr, avg_power, max_power, normalized_power, avg_cadence, avg_speed_mps, raw_fit_key, vendor",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("Activity stream lookup failed", error);
    return Response.json({ error: "lookup" }, { status: 500 });
  }
  if (!row || row.athlete_id !== user.id) {
    return Response.json({ error: "missing" }, { status: 404 });
  }

  try {
    const result = await ensureActivityStream({
      origin: new URL(request.url).origin,
      athleteId: user.id,
      activityId: row.id,
      source: row.source,
      sourceActivityId: row.source_activity_id,
      rawFitKey: row.raw_fit_key,
      row,
    });
    return Response.json({
      stream: result.stream,
      unauthorized: result.unauthorized ?? false,
    });
  } catch (error) {
    console.error("Activity stream failed", error);
    return Response.json({ stream: [] });
  }
}
