import { GoogleHealthAuthError, syncGoogleHealthRecovery } from "@/lib/google-health/sync";
import type { ImportProgress } from "@/lib/coros/progress";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

function encodeLine(progress: ImportProgress) {
  return `${JSON.stringify(progress)}\n`;
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "auth" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .maybeSingle();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (progress: ImportProgress) => {
        controller.enqueue(encoder.encode(encodeLine(progress)));
      };
      try {
        await syncGoogleHealthRecovery({
          athleteId: user.id,
          timeZone: profile?.timezone ?? undefined,
          onProgress: send,
        });
      } catch (error) {
        if (error instanceof GoogleHealthAuthError) {
          send({
            phase: "error",
            message: error.message,
            processed: 0,
            total: 0,
            saved: 0,
            reauth: true,
          });
        } else {
          console.error("Google Health sync failed", error);
          send({
            phase: "error",
            message: error instanceof Error ? error.message : "Recovery sync failed.",
            processed: 0,
            total: 0,
            saved: 0,
          });
        }
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
