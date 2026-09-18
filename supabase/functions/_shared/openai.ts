import { STABLE_SYSTEM_PROMPT } from "./prompt.ts";
import { OPENAI_TOOLS } from "./tools.ts";

export const LUNA_MODEL = "gpt-5.6-luna";
export const TERRA_MODEL = "gpt-5.6-terra";
const MEMORY_MODEL = "gpt-5.6-luna";
const OPENAI_TIMEOUT_MS = 45_000;
const PROMPT_CACHE_PREFIX = "potential-ai-v1";

type ResponseOutput = {
  id?: string;
  type?: string;
  name?: string;
  call_id?: string;
  arguments?: string | Record<string, unknown>;
  content?: unknown;
  role?: string;
};

export type OpenAIResponse = {
  id: string;
  output_text?: string;
  output?: ResponseOutput[];
  error?: { message?: string } | null;
  status?: string;
  incomplete_details?: { reason?: string } | null;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    input_tokens_details?: {
      cached_tokens?: number;
      cache_write_tokens?: number;
    };
  };
  prompt_cache_diagnostics?: unknown;
};

async function openaiFetch(body: Record<string, unknown>) {
  const key = Deno.env.get("OPENAI_API_KEY")?.trim();
  if (!key) {
    throw new Error("OPENAI_API_KEY is not set on this Edge Function.");
  }
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`OpenAI ${response.status}: ${text.slice(0, 800)}`);
  }
  return JSON.parse(text) as OpenAIResponse;
}

function partText(part: unknown) {
  if (typeof part === "string") {
    return part;
  }
  if (!part || typeof part !== "object") {
    return "";
  }
  const row = part as { type?: string; text?: string };
  if (row.type === "output_text" || row.type === "text") {
    return typeof row.text === "string" ? row.text : "";
  }
  return typeof row.text === "string" ? row.text : "";
}

export function functionCalls(response: OpenAIResponse) {
  return (response.output ?? [])
    .filter((item) => item.type === "function_call" || item.type === "tool_call")
    .map((item) => ({
      ...item,
      arguments:
        typeof item.arguments === "string"
          ? item.arguments
          : JSON.stringify(item.arguments ?? {}),
    }));
}

export function outputText(response: OpenAIResponse) {
  if (response.output_text && response.output_text.trim()) {
    return response.output_text;
  }
  const chunks: string[] = [];
  for (const item of response.output ?? []) {
    if (item.type && item.type !== "message") {
      continue;
    }
    const content = item.content;
    if (typeof content === "string" && content.trim()) {
      chunks.push(content);
      continue;
    }
    if (!Array.isArray(content)) {
      continue;
    }
    for (const part of content) {
      const text = partText(part);
      if (text) {
        chunks.push(text);
      }
    }
  }
  return chunks.join("");
}

export function promptCacheKey(model: string) {
  return `${PROMPT_CACHE_PREFIX}:${model}`;
}

export function createChatResponse(input: {
  model: string;
  reasoning?: "low" | "medium";
  input: unknown;
  previousResponseId?: string | null;
  comparisonResponseId?: string | null;
}) {
  const model = input.model;
  return openaiFetch({
    model,
    reasoning: { effort: input.reasoning ?? (model === TERRA_MODEL ? "medium" : "low") },
    max_output_tokens: model === TERRA_MODEL ? 4000 : 3000,
    instructions: STABLE_SYSTEM_PROMPT,
    input: input.input,
    tools: OPENAI_TOOLS,
    store: true,
    prompt_cache_key: promptCacheKey(model),
    ...(input.comparisonResponseId
      ? {
          prompt_cache_options: {
            comparison_response_id: input.comparisonResponseId,
          },
        }
      : {}),
    ...(input.previousResponseId ? { previous_response_id: input.previousResponseId } : {}),
  });
}

export function createMemoryResponse(input: unknown) {
  return openaiFetch({
    model: MEMORY_MODEL,
    reasoning: { effort: "low" },
    max_output_tokens: 800,
    instructions:
      "Extract only durable athlete memories from this conversation. Transient one-off feelings are not memories. Return JSON only.",
    input,
    text: {
      format: {
        type: "json_schema",
        name: "memory_extract",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            memories: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  type: {
                    type: "string",
                    enum: ["fact", "preference", "constraint", "decision"],
                  },
                  content: { type: "string" },
                  confidence: { type: "number" },
                  durability: { type: "string", enum: ["long_term", "transient"] },
                },
                required: ["type", "content", "confidence", "durability"],
              },
            },
          },
          required: ["title", "memories"],
        },
      },
    },
  });
}
