import { chatModelReady, coachReviewModel } from "@/lib/chat/model";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";
import {
  ACTIVITY_INSIGHT_PACKET_VERSION,
  ACTIVITY_INSIGHT_PROMPT_VERSION,
  type ActivityInsight,
  type ActivityInsightFinding,
  type ActivityInsightPacket,
  type InsightConfidence,
  type InsightFindingKind,
  type PlannedVerdict,
} from "@/lib/activity-insight/types";

export const ACTIVITY_INSIGHT_SYSTEM = `You are Ahead's post-activity coach.

Interpret the supplied activity evidence in the context of the athlete's plan, recent training and upcoming commitments.

All metrics in the evidence packet are canonical. Do not recalculate or replace them.

Prioritise:
1. whether the activity matched its intended purpose;
2. unusual or meaningful observations;
3. relevant historical comparison;
4. whether anything should change next.

Distinguish observed evidence from inference.
Do not treat Fitness or training load as proof of adaptation.
Do not infer zone intensity when HR classification is uncertain or unavailable.
Do not invent race results, power, laps, conditions, weather, or athlete feelings.
Missing data is unknown.
Do not fill output sections merely because they exist.
Prefer the smallest number of findings that materially change the athlete's understanding of the session. Two is often enough. Four is a maximum.
Be concise and specific to this athlete and session.
Do not mention Luna, Terra, models, tokens, or that you are an AI.

Return ONLY JSON with this shape:
{
  "headline": string,
  "summary": string,
  "findings": [{"title": string, "explanation": string, "kind": "performance"|"execution"|"recovery"|"context"|"data_quality"}],
  "implications": string | null,
  "nextAction": string | null,
  "plannedVsActual": {
    "verdict": "matched"|"partially_matched"|"missed"|"unknown",
    "duration": string | null,
    "intensity": string | null,
    "structure": string | null
  } | null,
  "confidence": "high"|"moderate"|"limited"
}`;

type GeneratedInsight = {
  headline: string;
  summary: string;
  findings: ActivityInsightFinding[];
  implications: string | null;
  nextAction: string | null;
  plannedVsActual: ActivityInsight["plannedVsActual"];
  confidence: InsightConfidence;
};

type Usage = {
  model: string;
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
};

function parseJsonObject(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced?.[1]?.trim() || trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("Activity Insight did not return an object.");
  }
  return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
}

function asFinding(row: unknown): ActivityInsightFinding | null {
  if (!row || typeof row !== "object") {
    return null;
  }
  const item = row as Record<string, unknown>;
  const kind = item.kind;
  if (typeof item.title !== "string" || typeof item.explanation !== "string") {
    return null;
  }
  if (
    kind !== "performance" &&
    kind !== "execution" &&
    kind !== "recovery" &&
    kind !== "context" &&
    kind !== "data_quality"
  ) {
    return null;
  }
  return {
    title: item.title.trim(),
    explanation: item.explanation.trim(),
    kind: kind as InsightFindingKind,
  };
}

function applyGenerated(row: Record<string, unknown>): GeneratedInsight {
  const findings = Array.isArray(row.findings)
    ? row.findings.map(asFinding).filter((item): item is ActivityInsightFinding => Boolean(item))
    : [];
  const planned = row.plannedVsActual;
  let plannedVsActual: ActivityInsight["plannedVsActual"] = null;
  if (planned && typeof planned === "object") {
    const value = planned as Record<string, unknown>;
    const verdict = value.verdict;
    if (
      verdict === "matched" ||
      verdict === "partially_matched" ||
      verdict === "missed" ||
      verdict === "unknown"
    ) {
      plannedVsActual = {
        verdict: verdict as PlannedVerdict,
        duration: typeof value.duration === "string" && value.duration.trim()
          ? value.duration.trim()
          : null,
        intensity: typeof value.intensity === "string" && value.intensity.trim()
          ? value.intensity.trim()
          : null,
        structure: typeof value.structure === "string" && value.structure.trim()
          ? value.structure.trim()
          : null,
      };
    }
  }
  const confidence =
    row.confidence === "moderate" || row.confidence === "limited" ? row.confidence : "high";
  return {
    headline: typeof row.headline === "string" ? row.headline.trim() : "This session",
    summary: typeof row.summary === "string" ? row.summary.trim() : "",
    findings: findings.slice(0, 4),
    implications:
      typeof row.implications === "string" && row.implications.trim()
        ? row.implications.trim()
        : null,
    nextAction:
      typeof row.nextAction === "string" && row.nextAction.trim()
        ? row.nextAction.trim()
        : null,
    plannedVsActual,
    confidence,
  };
}

function estimateCostUsd(usage: Usage) {
  if (usage.inputTokens == null || usage.outputTokens == null) {
    return null;
  }
  const cached = usage.cachedInputTokens ?? 0;
  const billed = Math.max(0, usage.inputTokens - cached);
  return Number(((billed * 0.4 + cached * 0.04 + usage.outputTokens * 1.6) / 1_000_000).toFixed(6));
}

function anthropicKey() {
  return process.env.ANTHROPIC_API_KEY?.trim() || "";
}

function openaiKey() {
  return process.env.OPENAI_API_KEY?.trim() || "";
}

async function completeLocal(packet: ActivityInsightPacket): Promise<{
  generated: GeneratedInsight;
  usage: Usage;
}> {
  const user = JSON.stringify({ packet });
  if (anthropicKey()) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": anthropicKey(),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: coachReviewModel(),
        max_tokens: 1200,
        system: ACTIVITY_INSIGHT_SYSTEM,
        messages: [{ role: "user", content: user }],
      }),
    });
    const body = (await response.json().catch(() => null)) as {
      content?: { type?: string; text?: string }[];
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
        cache_read_input_tokens?: number;
      };
      error?: { message?: string };
    } | null;
    if (!response.ok) {
      throw new Error(body?.error?.message || `Model request failed (${response.status}).`);
    }
    const text = (body?.content ?? [])
      .filter((block) => block.type === "text" && block.text)
      .map((block) => block.text)
      .join("\n");
    return {
      generated: applyGenerated(parseJsonObject(text)),
      usage: {
        model: coachReviewModel(),
        inputTokens: body?.usage?.input_tokens ?? null,
        cachedInputTokens: body?.usage?.cache_read_input_tokens ?? null,
        outputTokens: body?.usage?.output_tokens ?? null,
      },
    };
  }
  if (openaiKey()) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${openaiKey()}`,
      },
      body: JSON.stringify({
        model: process.env.CHAT_MODEL?.trim() || "gpt-4.1-mini",
        response_format: { type: "json_object" },
        max_tokens: 1200,
        messages: [
          { role: "system", content: ACTIVITY_INSIGHT_SYSTEM },
          { role: "user", content: user },
        ],
      }),
    });
    const body = (await response.json().catch(() => null)) as {
      choices?: { message?: { content?: string } }[];
      model?: string;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        prompt_tokens_details?: { cached_tokens?: number };
      };
      error?: { message?: string };
    } | null;
    if (!response.ok) {
      throw new Error(body?.error?.message || `Model request failed (${response.status}).`);
    }
    return {
      generated: applyGenerated(parseJsonObject(body?.choices?.[0]?.message?.content ?? "")),
      usage: {
        model: body?.model ?? process.env.CHAT_MODEL?.trim() ?? "gpt-4.1-mini",
        inputTokens: body?.usage?.prompt_tokens ?? null,
        cachedInputTokens: body?.usage?.prompt_tokens_details?.cached_tokens ?? null,
        outputTokens: body?.usage?.completion_tokens ?? null,
      },
    };
  }
  throw new Error("Activity Insight needs ANTHROPIC_API_KEY or OPENAI_API_KEY.");
}

async function completeViaPotentialAi(
  accessToken: string,
  packet: ActivityInsightPacket,
): Promise<{ generated: GeneratedInsight; usage: Usage }> {
  const response = await fetch(`${supabaseUrl()}/functions/v1/potential-ai`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      apikey: supabasePublishableKey(),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      mode: "activity-insight",
      packet,
    }),
  });
  const body = (await response.json().catch(() => null)) as {
    insight?: Record<string, unknown>;
    usage?: {
      model?: string;
      input_tokens?: number;
      cached_input_tokens?: number;
      output_tokens?: number;
    };
    message?: string;
  } | null;
  if (!response.ok || !body?.insight) {
    throw new Error(
      body?.message ||
        (body && "error" in body && typeof (body as { error?: unknown }).error === "string"
          ? String((body as { error?: string }).error)
          : `Could not write the activity insight (${response.status}).`),
    );
  }
  return {
    generated: applyGenerated(body.insight),
    usage: {
      model: body.usage?.model ?? "gpt-5.6-luna",
      inputTokens: body.usage?.input_tokens ?? null,
      cachedInputTokens: body.usage?.cached_input_tokens ?? null,
      outputTokens: body.usage?.output_tokens ?? null,
    },
  };
}

export async function generateActivityInsight(input: {
  athleteId: string;
  activityId: string;
  packet: ActivityInsightPacket;
  fingerprint: string;
  accessToken?: string;
}): Promise<Omit<ActivityInsight, "id" | "generatedAt">> {
  const started = Date.now();
  let generated: GeneratedInsight;
  let usage: Usage;
  if (input.accessToken) {
    try {
      ({ generated, usage } = await completeViaPotentialAi(input.accessToken, input.packet));
    } catch (error) {
      if (!chatModelReady()) {
        throw error;
      }
      ({ generated, usage } = await completeLocal(input.packet));
    }
  } else {
    ({ generated, usage } = await completeLocal(input.packet));
  }
  return {
    athleteId: input.athleteId,
    activityId: input.activityId,
    status: "ready",
    headline: generated.headline,
    summary: generated.summary,
    findings: generated.findings,
    implications: generated.implications,
    nextAction: generated.nextAction,
    plannedVsActual: generated.plannedVsActual,
    confidence: generated.confidence,
    fingerprint: input.fingerprint,
    model: usage.model,
    promptVersion: ACTIVITY_INSIGHT_PROMPT_VERSION,
    packetVersion: ACTIVITY_INSIGHT_PACKET_VERSION,
    inputTokens: usage.inputTokens,
    cachedInputTokens: usage.cachedInputTokens,
    outputTokens: usage.outputTokens,
    estimatedCost: estimateCostUsd(usage),
    latencyMs: Date.now() - started,
  };
}
