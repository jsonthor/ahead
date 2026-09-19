import { ensureActivityInsight } from "@/lib/activity-insight/ensure";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "auth" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    activityId?: string;
    regenerate?: boolean;
  } | null;
  if (!body?.activityId) {
    return Response.json({ error: "activity" }, { status: 400 });
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .maybeSingle();

  try {
    const result = await ensureActivityInsight({
      client: supabase,
      athleteId: user.id,
      activityId: body.activityId,
      timeZone: profile?.timezone || "Europe/London",
      accessToken: session?.access_token,
      regenerate: body.regenerate === true,
    });
    return Response.json(result);
  } catch (error) {
    console.error("Activity Insight failed", error);
    return Response.json(
      {
        error: "generate",
        message: error instanceof Error ? error.message : "Could not write the insight.",
      },
      { status: 500 },
    );
  }
}
