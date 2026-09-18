import { importUploadedFiles } from "@/lib/ingest/files";
import type { ImportProgress } from "@/lib/coros/progress";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function encodeLine(progress: ImportProgress) {
  return `${JSON.stringify(progress)}\n`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "auth" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "form" }, { status: 400 });
  }

  const uploads: { name: string; bytes: Buffer }[] = [];
  for (const value of form.getAll("files")) {
    if (typeof value === "string" || !value) {
      continue;
    }
    const file = value as File;
    const bytes = Buffer.from(await file.arrayBuffer());
    uploads.push({ name: file.name || "upload", bytes });
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
          message: "Receiving files…",
          processed: 0,
          total: 0,
          saved: 0,
        });
        await importUploadedFiles({
          athleteId: user.id,
          files: uploads,
          onProgress: send,
        });
      } catch (error) {
        console.error("File upload failed", error);
        send({
          phase: "error",
          message: error instanceof Error ? error.message : "Upload failed.",
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
