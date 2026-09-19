import { generateCoachReview } from "@/lib/coach-review/generate";
import { loadReviewPacket } from "@/lib/coach-review/packet";
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
    today?: string;
    historyDays?: number;
    periodStart?: string;
    periodEnd?: string;
    replaceId?: string;
    previous?: {
      title: string;
      periodStart: string;
      periodEnd: string;
      lessons: string;
      nextObjective: string;
      nextKeep: string[];
      nextChange: string[];
    } | null;
  } | null;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .maybeSingle();
  const timeZone = profile?.timezone || "Europe/London";
  const periodStart = body?.periodStart;
  const periodEnd = body?.periodEnd;
  if (!periodStart || !periodEnd) {
    return Response.json({ error: "period" }, { status: 400 });
  }

  try {
    const packet = await loadReviewPacket({
      athleteId: user.id,
      timeZone,
      periodStart,
      periodEnd,
      client: supabase,
    });
    const review = await generateCoachReview({
      athleteId: user.id,
      packet,
      previous: body?.previous ?? null,
      accessToken: session?.access_token,
    });
    if (body?.replaceId) {
      review.id = body.replaceId;
    }
    return Response.json({ review });
  } catch (error) {
    console.error("Coach Review failed", error);
    return Response.json(
      {
        error: "generate",
        message: error instanceof Error ? error.message : "Could not write the review.",
      },
      { status: 500 },
    );
  }
}
