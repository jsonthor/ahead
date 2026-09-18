import { jsonResponse, optionsResponse } from "../_shared/cors.ts";
import { openaiKey, requireUser, userClient } from "../_shared/client.ts";
import { createMemoryResponse, outputText } from "../_shared/openai.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return optionsResponse();
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method" }, 405);
  }
  if (!openaiKey()) {
    return jsonResponse({ error: "missing_openai_key" }, 503);
  }

  let client;
  try {
    client = userClient(req);
  } catch {
    return jsonResponse({ error: "auth" }, 401);
  }
  let user;
  try {
    user = await requireUser(client);
  } catch {
    return jsonResponse({ error: "auth" }, 401);
  }

  const body = (await req.json().catch(() => null)) as { conversationId?: string } | null;
  const conversationId = body?.conversationId?.trim() ?? "";
  if (!conversationId) {
    return jsonResponse({ error: "conversation" }, 400);
  }

  const { data: conversation } = await client
    .from("conversations")
    .select("id, title")
    .eq("id", conversationId)
    .eq("athlete_id", user.id)
    .maybeSingle();
  if (!conversation) {
    return jsonResponse({ error: "not_found" }, 404);
  }

  const { data: rows } = await client
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(40);
  const transcript = (rows ?? [])
    .map((row) => `${row.role}: ${row.content}`)
    .join("\n")
    .slice(0, 12000);
  if (!transcript.trim()) {
    return jsonResponse({ ok: true, stored: 0 });
  }

  const response = await createMemoryResponse(
    `Extract durable memories from this Potential conversation.\n\n${transcript}`,
  );
  let parsed: {
    title?: string;
    memories?: {
      type: string;
      content: string;
      confidence: number;
      durability: string;
    }[];
  } = {};
  try {
    parsed = JSON.parse(outputText(response) || "{}") as typeof parsed;
  } catch {
    parsed = {};
  }

  if (parsed.title && parsed.title.trim() && !conversation.title) {
    await client
      .from("conversations")
      .update({ title: parsed.title.trim().slice(0, 80) })
      .eq("id", conversationId);
  }

  let stored = 0;
  for (const memory of parsed.memories ?? []) {
    if (memory.durability !== "long_term") {
      continue;
    }
    if (memory.confidence < 0.75) {
      continue;
    }
    if (!["fact", "preference", "constraint", "decision"].includes(memory.type)) {
      continue;
    }
    const content = memory.content.trim().slice(0, 800);
    if (!content) {
      continue;
    }
    const { data: existing } = await client
      .from("athlete_memories")
      .select("id")
      .eq("athlete_id", user.id)
      .is("superseded_at", null)
      .ilike("content", content)
      .maybeSingle();
    if (existing) {
      continue;
    }
    const { error } = await client.from("athlete_memories").insert({
      athlete_id: user.id,
      type: memory.type,
      content,
      confidence: Math.min(1, Math.max(0, memory.confidence)),
      importance: memory.type === "constraint" || memory.type === "decision" ? 0.8 : 0.55,
      source_conversation_id: conversationId,
    });
    if (!error) {
      stored += 1;
    }
  }

  await client
    .from("conversations")
    .update({ memory_extracted_at: new Date().toISOString() })
    .eq("id", conversationId);

  return jsonResponse({ ok: true, stored, title: parsed.title ?? null });
});
