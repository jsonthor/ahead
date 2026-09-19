import { dateKeyInZone } from "@/lib/calendar";
import { dismissZoneNotice } from "@/lib/hr-model/notice";
import {
  loadZoneSnapshot,
  saveAthleteZones,
  type ZoneSaveProgress,
} from "@/lib/hr-model/profile";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

async function athlete() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .maybeSingle();
  return {
    id: user.id,
    timeZone: profile?.timezone || "Europe/London",
  };
}

export async function GET() {
  const session = await athlete();
  if (!session) {
    return Response.json({ error: "auth" }, { status: 401 });
  }
  const today = dateKeyInZone(new Date(), session.timeZone);
  const snapshot = await loadZoneSnapshot(session.id, today);
  return Response.json(snapshot);
}

export async function POST(request: Request) {
  const session = await athlete();
  if (!session) {
    return Response.json({ error: "auth" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    hrMax?: unknown;
    cyclingLthr?: unknown;
    runningLthr?: unknown;
  } | null;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (progress: ZoneSaveProgress) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(progress)}\n`));
      };
      try {
        await saveAthleteZones({
          athleteId: session.id,
          timeZone: session.timeZone,
          hrMax: body?.hrMax,
          cyclingLthr: body?.cyclingLthr,
          runningLthr: body?.runningLthr,
          onProgress: send,
        });
      } catch (error) {
        send({
          phase: "error",
          message: error instanceof Error ? error.message : "Could not save zones.",
          processed: 0,
          total: 0,
          error: error instanceof Error ? error.message : "Could not save zones.",
        });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function PATCH(request: Request) {
  const session = await athlete();
  if (!session) {
    return Response.json({ error: "auth" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { id?: string } | null;
  if (!body?.id) {
    return Response.json({ error: "id" }, { status: 400 });
  }
  const notices = await dismissZoneNotice(session.id, body.id);
  return Response.json({ notices });
}
