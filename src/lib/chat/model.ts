import { executeChatTool, CHAT_TOOLS } from "@/lib/chat/tools";
import type { CalendarProposal } from "@/lib/chat/proposal";
import type { Database } from "@/lib/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient<Database>;

export type ChatEvent =
  | { type: "text"; text: string }
  | { type: "proposal"; proposal: CalendarProposal }
  | { type: "error"; message: string };

type ToolCall = { id: string; name: string; json: string };

function anthropicKey() {
  return process.env.ANTHROPIC_API_KEY?.trim() || "";
}

function openaiKey() {
  return process.env.OPENAI_API_KEY?.trim() || "";
}

export function chatModelReady() {
  return Boolean(anthropicKey() || openaiKey());
}

export function coachReviewModel() {
  return (
    process.env.COACH_REVIEW_MODEL?.trim() ||
    process.env.CHAT_MODEL?.trim() ||
    (anthropicKey() ? "claude-sonnet-4-5" : "gpt-4.1")
  );
}

export async function completeJson(input: { system: string; user: string }) {
  if (anthropicKey()) {
    return completeAnthropicJson(input);
  }
  if (openaiKey()) {
    return completeOpenAIJson(input);
  }
  throw new Error("Coach Review needs ANTHROPIC_API_KEY or OPENAI_API_KEY on the server.");
}

function parseJsonObject(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced?.[1]?.trim() || trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("Coach Review did not return a review object.");
  }
  return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
}

async function completeAnthropicJson(input: { system: string; user: string }) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": anthropicKey(),
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: coachReviewModel(),
      max_tokens: 4096,
      system: input.system,
      messages: [{ role: "user", content: input.user }],
    }),
  });
  const body = (await response.json().catch(() => null)) as {
    content?: { type?: string; text?: string }[];
    error?: { message?: string };
  } | null;
  if (!response.ok) {
    throw new Error(body?.error?.message || `Model request failed (${response.status}).`);
  }
  const text = (body?.content ?? [])
    .filter((block) => block.type === "text" && block.text)
    .map((block) => block.text)
    .join("\n");
  return parseJsonObject(text);
}

async function completeOpenAIJson(input: { system: string; user: string }) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${openaiKey()}`,
    },
    body: JSON.stringify({
      model: coachReviewModel(),
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.user },
      ],
    }),
  });
  const body = (await response.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  } | null;
  if (!response.ok) {
    throw new Error(body?.error?.message || `Model request failed (${response.status}).`);
  }
  return parseJsonObject(body?.choices?.[0]?.message?.content ?? "");
}

export async function* runChatTurn(input: {
  client: Client;
  athleteId: string;
  timeZone: string;
  system: string;
  history: { role: "user" | "assistant"; content: string }[];
}): AsyncGenerator<ChatEvent> {
  if (anthropicKey()) {
    yield* runAnthropic(input);
    return;
  }
  if (openaiKey()) {
    yield* runOpenAI(input);
    return;
  }
  yield {
    type: "error",
    message: "Ask Ahead needs ANTHROPIC_API_KEY or OPENAI_API_KEY on the server.",
  };
}

async function executeCalls(
  input: {
    client: Client;
    athleteId: string;
    timeZone: string;
  },
  calls: ToolCall[],
) {
  let proposal: CalendarProposal | undefined;
  const results: { id: string; result: unknown }[] = [];
  for (const call of calls) {
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(call.json || "{}") as Record<string, unknown>;
    } catch {
      args = {};
    }
    const executed = await executeChatTool(input.client, {
      athleteId: input.athleteId,
      timeZone: input.timeZone,
      name: call.name,
      args,
    });
    if (executed.proposal) {
      proposal = executed.proposal;
    }
    results.push({ id: call.id, result: executed.result });
  }
  return { proposal, results };
}

async function* runAnthropic(input: {
  client: Client;
  athleteId: string;
  timeZone: string;
  system: string;
  history: { role: "user" | "assistant"; content: string }[];
}): AsyncGenerator<ChatEvent> {
  type Content =
    | { type: "text"; text: string }
    | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
    | { type: "tool_result"; tool_use_id: string; content: string };
  type Message =
    | { role: "user"; content: string | Content[] }
    | { role: "assistant"; content: string | Content[] };

  const messages: Message[] = input.history.map((row) =>
    row.role === "assistant"
      ? { role: "assistant" as const, content: row.content }
      : { role: "user" as const, content: row.content },
  );
  let proposal: CalendarProposal | undefined;

  for (let step = 0; step < 6; step += 1) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": anthropicKey(),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.CHAT_MODEL || "claude-sonnet-4-5",
        max_tokens: 4096,
        stream: true,
        system: input.system,
        tools: CHAT_TOOLS,
        messages,
      }),
    });
    if (!response.ok || !response.body) {
      const detail = await response.text().catch(() => "");
      yield {
        type: "error",
        message: detail.slice(0, 400) || `Model request failed (${response.status}).`,
      };
      return;
    }
    const collected = yield* streamAnthropic(response.body);
    const assistantContent: Content[] = [];
    if (collected.text) {
      assistantContent.push({ type: "text", text: collected.text });
    }
    for (const call of collected.tools) {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(call.json || "{}") as Record<string, unknown>;
      } catch {
        parsed = {};
      }
      assistantContent.push({
        type: "tool_use",
        id: call.id,
        name: call.name,
        input: parsed,
      });
    }
    if (assistantContent.length > 0) {
      messages.push({ role: "assistant", content: assistantContent });
    }
    if (collected.tools.length === 0) {
      if (proposal) {
        yield { type: "proposal", proposal };
      }
      return;
    }
    const executed = await executeCalls(input, collected.tools);
    if (executed.proposal) {
      proposal = executed.proposal;
    }
    messages.push({
      role: "user",
      content: executed.results.map((row) => ({
        type: "tool_result" as const,
        tool_use_id: row.id,
        content: JSON.stringify(row.result),
      })),
    });
  }
  if (proposal) {
    yield { type: "proposal", proposal };
  }
}

async function* streamAnthropic(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<ChatEvent, { text: string; tools: ToolCall[] }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  const tools: ToolCall[] = [];
  let current: ToolCall | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n");
    buffer = chunks.pop() ?? "";
    for (const line of chunks) {
      if (!line.startsWith("data:")) {
        continue;
      }
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") {
        continue;
      }
      let event: Record<string, unknown>;
      try {
        event = JSON.parse(payload) as Record<string, unknown>;
      } catch {
        continue;
      }
      if (event.type === "content_block_start") {
        const block = event.content_block as Record<string, unknown> | undefined;
        if (block?.type === "tool_use") {
          current = {
            id: String(block.id ?? ""),
            name: String(block.name ?? ""),
            json: "",
          };
        }
      } else if (event.type === "content_block_delta") {
        const delta = event.delta as Record<string, unknown> | undefined;
        if (delta?.type === "text_delta" && typeof delta.text === "string" && delta.text) {
          text += delta.text;
          yield { type: "text", text: delta.text };
        }
        if (delta?.type === "input_json_delta" && typeof delta.partial_json === "string" && current) {
          current.json += delta.partial_json;
        }
      } else if (event.type === "content_block_stop") {
        if (current) {
          tools.push(current);
          current = null;
        }
      } else if (event.type === "error") {
        const err = event.error as Record<string, unknown> | undefined;
        yield {
          type: "error",
          message: String(err?.message ?? "The model returned an error."),
        };
      }
    }
  }
  return { text, tools };
}

async function* runOpenAI(input: {
  client: Client;
  athleteId: string;
  timeZone: string;
  system: string;
  history: { role: "user" | "assistant"; content: string }[];
}): AsyncGenerator<ChatEvent> {
  type OpenAIMessage =
    | { role: "system" | "user" | "assistant"; content: string | null; tool_calls?: unknown }
    | { role: "tool"; tool_call_id: string; content: string };
  const messages: OpenAIMessage[] = [
    { role: "system", content: input.system },
    ...input.history.map((row) => ({ role: row.role, content: row.content })),
  ];
  let proposal: CalendarProposal | undefined;
  const tools = CHAT_TOOLS.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    },
  }));

  for (let step = 0; step < 6; step += 1) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${openaiKey()}`,
      },
      body: JSON.stringify({
        model: process.env.CHAT_MODEL || "gpt-4.1",
        stream: true,
        messages,
        tools,
      }),
    });
    if (!response.ok || !response.body) {
      const detail = await response.text().catch(() => "");
      yield {
        type: "error",
        message: detail.slice(0, 400) || `Model request failed (${response.status}).`,
      };
      return;
    }
    const collected = yield* streamOpenAI(response.body);
    if (collected.toolCalls.length === 0) {
      if (proposal) {
        yield { type: "proposal", proposal };
      }
      return;
    }
    messages.push({
      role: "assistant",
      content: collected.text || null,
      tool_calls: collected.toolCalls.map((call) => ({
        id: call.id,
        type: "function",
        function: { name: call.name, arguments: call.json },
      })),
    });
    const executed = await executeCalls(input, collected.toolCalls);
    if (executed.proposal) {
      proposal = executed.proposal;
    }
    for (const row of executed.results) {
      messages.push({
        role: "tool",
        tool_call_id: row.id,
        content: JSON.stringify(row.result),
      });
    }
  }
  if (proposal) {
    yield { type: "proposal", proposal };
  }
}

async function* streamOpenAI(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<ChatEvent, { text: string; toolCalls: ToolCall[] }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  const toolCalls: ToolCall[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n");
    buffer = chunks.pop() ?? "";
    for (const line of chunks) {
      if (!line.startsWith("data:")) {
        continue;
      }
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") {
        continue;
      }
      let event: Record<string, unknown>;
      try {
        event = JSON.parse(payload) as Record<string, unknown>;
      } catch {
        continue;
      }
      const choices = event.choices as Array<Record<string, unknown>> | undefined;
      const delta = choices?.[0]?.delta as Record<string, unknown> | undefined;
      if (!delta) {
        continue;
      }
      if (typeof delta.content === "string" && delta.content) {
        text += delta.content;
        yield { type: "text", text: delta.content };
      }
      const calls = delta.tool_calls as Array<Record<string, unknown>> | undefined;
      if (!calls) {
        continue;
      }
      for (const call of calls) {
        const index = typeof call.index === "number" ? call.index : toolCalls.length;
        if (!toolCalls[index]) {
          const fn = call.function as Record<string, unknown> | undefined;
          toolCalls[index] = {
            id: String(call.id ?? `call_${index}`),
            name: String(fn?.name ?? ""),
            json: "",
          };
        }
        const fn = call.function as Record<string, unknown> | undefined;
        if (typeof fn?.arguments === "string") {
          toolCalls[index]!.json += fn.arguments;
        }
        if (typeof fn?.name === "string" && fn.name) {
          toolCalls[index]!.name = fn.name;
        }
        if (typeof call.id === "string") {
          toolCalls[index]!.id = call.id;
        }
      }
    }
  }
  return { text, toolCalls: toolCalls.filter(Boolean) };
}
