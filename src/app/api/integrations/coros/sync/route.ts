import { syncCorosAthlete } from "@/lib/coros/auto-sync";
import type { ImportProgress } from "@/lib/coros/progress";
import { requestOrigin } from "@/lib/oauth";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function encodeLine(progress: ImportProgress) {
  return `${JSON.stringify(progress)}\n`;
}

export async function POST(request: Request) {
  const origin = requestOrigin(request);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "auth" }, { status: 401 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (progress: ImportProgress) => {
        controller.enqueue(encoder.encode(encodeLine(progress)));
      };
      try {
        send({
          phase: "listing",
          message: "Connecting to COROS…",
          processed: 0,
          total: 0,
          saved: 0,
        });
        const result = await syncCorosAthlete({
          origin,
          athleteId: user.id,
          onProgress: send,
        });
        if (result.status === "reauth") {
          send({
            phase: "error",
            message: "COROS needs permission again.",
            processed: 0,
            total: 0,
            saved: 0,
            reauth: true,
          });
        }
      } catch (error) {
        console.error("COROS sync failed", error);
        send({
          phase: "error",
          message: error instanceof Error ? error.message : "Import failed.",
          processed: 0,
          total: 0,
          saved: 0,
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
