import { buildContextPacket } from "@/lib/chat/context";
import { chatModelReady, runChatTurn } from "@/lib/chat/model";
import { systemPrompt } from "@/lib/chat/prompt";
import { parseProposal } from "@/lib/chat/proposal";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const HISTORY_CAP = 40;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "auth" }, { status: 401 });
  }
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, title, updated_at")
    .eq("athlete_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!conversation) {
    return Response.json({
      ready: chatModelReady(),
      conversationId: null,
      messages: [],
    });
  }
  const { data: rows } = await supabase
    .from("messages")
    .select("id, role, content, proposal, created_at")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true });
  return Response.json({
    ready: chatModelReady(),
    conversationId: conversation.id,
    messages: (rows ?? []).map((row) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      proposal: parseProposal(row.proposal),
      createdAt: row.created_at,
    })),
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "auth" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    conversationId?: string | null;
    content?: string;
  } | null;
  const content = body?.content?.trim() ?? "";
  if (!content) {
    return Response.json({ error: "empty" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .maybeSingle();
  const timeZone = profile?.timezone || "Europe/London";

  let conversationId = body?.conversationId ?? null;
  if (conversationId) {
    const { data: owned } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("athlete_id", user.id)
      .maybeSingle();
    if (!owned) {
      conversationId = null;
    }
  }
  if (!conversationId) {
    const { data: created, error } = await supabase
      .from("conversations")
      .insert({
        athlete_id: user.id,
        title: content.slice(0, 80),
      })
      .select("id")
      .single();
    if (error || !created) {
      return Response.json({ error: "conversation" }, { status: 500 });
    }
    conversationId = created.id;
  }

  const { error: userMessageError } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    athlete_id: user.id,
    role: "user",
    content,
  });
  if (userMessageError) {
    return Response.json({ error: "message" }, { status: 500 });
  }
  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  const { data: historyRows } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  const history = (historyRows ?? [])
    .filter((row) => row.role === "user" || row.role === "assistant")
    .map((row) => ({
      role: row.role as "user" | "assistant",
      content: row.content,
    }))
    .slice(-HISTORY_CAP);

  const context = await buildContextPacket(supabase, user.id, timeZone);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      let reply = "";
      let proposal = null as ReturnType<typeof parseProposal>;
      try {
        send({ type: "conversation", conversationId });
        for await (const event of runChatTurn({
          client: supabase,
          athleteId: user.id,
          timeZone,
          system: systemPrompt(context),
          history,
        })) {
          if (event.type === "text") {
            reply += event.text;
            send(event);
          } else if (event.type === "proposal") {
            proposal = event.proposal;
            send(event);
          } else {
            send(event);
          }
        }
        const { data: saved } = await supabase
          .from("messages")
          .insert({
            conversation_id: conversationId,
            athlete_id: user.id,
            role: "assistant",
            content: reply || (proposal ? "I have a calendar change ready for you to apply." : ""),
            proposal,
          })
          .select("id")
          .single();
        send({ type: "done", messageId: saved?.id ?? null });
      } catch (error) {
        console.error("Ask Ahead failed", error);
        send({
          type: "error",
          message: error instanceof Error ? error.message : "Ask Ahead failed.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
