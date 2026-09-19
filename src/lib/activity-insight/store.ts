import type { Json } from "@/lib/database.types";
import type { Database } from "@/lib/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ActivityInsight,
  ActivityInsightContext,
  ActivityInsightFinding,
  InsightConfidence,
  InsightFindingKind,
  InsightStatus,
  PlannedVerdict,
} from "@/lib/activity-insight/types";

type Client = SupabaseClient<Database>;

let openInsight: ActivityInsight | null = null;

export function setOpenActivityInsight(insight: ActivityInsight | null) {
  openInsight = insight;
}

export function getOpenActivityInsight() {
  return openInsight;
}

function asFindings(value: unknown): ActivityInsightFinding[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((row) => {
    if (!row || typeof row !== "object") {
      return [];
    }
    const item = row as Record<string, unknown>;
    const kind = item.kind;
    if (
      typeof item.title !== "string" ||
      typeof item.explanation !== "string" ||
      (kind !== "performance" &&
        kind !== "execution" &&
        kind !== "recovery" &&
        kind !== "context" &&
        kind !== "data_quality")
    ) {
      return [];
    }
    return [
      {
        title: item.title,
        explanation: item.explanation,
        kind: kind as InsightFindingKind,
      },
    ];
  });
}

function asPlanned(value: unknown): ActivityInsight["plannedVsActual"] {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as Record<string, unknown>;
  const verdict = row.verdict;
  if (
    verdict !== "matched" &&
    verdict !== "partially_matched" &&
    verdict !== "missed" &&
    verdict !== "unknown"
  ) {
    return null;
  }
  return {
    verdict: verdict as PlannedVerdict,
    duration: typeof row.duration === "string" ? row.duration : null,
    intensity: typeof row.intensity === "string" ? row.intensity : null,
    structure: typeof row.structure === "string" ? row.structure : null,
  };
}

function asInsight(row: {
  id: string;
  athlete_id: string;
  activity_id: string;
  status: string;
  headline: string;
  summary: string;
  findings: Json;
  implications: string | null;
  next_action: string | null;
  planned_vs_actual: Json | null;
  confidence: string;
  fingerprint: string;
  model: string | null;
  prompt_version: number;
  packet_version: number;
  input_tokens: number | null;
  cached_input_tokens: number | null;
  output_tokens: number | null;
  estimated_cost: number | null;
  latency_ms: number | null;
  generated_at: string;
}): ActivityInsight {
  return {
    id: row.id,
    athleteId: row.athlete_id,
    activityId: row.activity_id,
    status: (row.status === "stale" || row.status === "failed" ? row.status : "ready") as InsightStatus,
    headline: row.headline,
    summary: row.summary,
    findings: asFindings(row.findings),
    implications: row.implications,
    nextAction: row.next_action,
    plannedVsActual: asPlanned(row.planned_vs_actual),
    confidence: (row.confidence === "moderate" || row.confidence === "limited"
      ? row.confidence
      : "high") as InsightConfidence,
    fingerprint: row.fingerprint,
    model: row.model,
    promptVersion: row.prompt_version,
    packetVersion: row.packet_version,
    inputTokens: row.input_tokens,
    cachedInputTokens: row.cached_input_tokens,
    outputTokens: row.output_tokens,
    estimatedCost: row.estimated_cost,
    latencyMs: row.latency_ms,
    generatedAt: row.generated_at,
  };
}

export function activityInsightContext(insight: ActivityInsight | null): ActivityInsightContext | null {
  if (!insight) {
    return null;
  }
  return {
    activityId: insight.activityId,
    insightId: insight.id,
    headline: insight.headline,
    summary: insight.summary,
    findings: insight.findings,
    implications: insight.implications,
    nextAction: insight.nextAction,
    plannedVsActual: insight.plannedVsActual,
    confidence: insight.confidence,
  };
}

export async function loadLatestActivityInsight(
  client: Client,
  activityId: string,
) {
  const { data, error } = await client
    .from("activity_insights")
    .select(
      "id, athlete_id, activity_id, status, headline, summary, findings, implications, next_action, planned_vs_actual, confidence, fingerprint, model, prompt_version, packet_version, input_tokens, cached_input_tokens, output_tokens, estimated_cost, latency_ms, generated_at",
    )
    .eq("activity_id", activityId)
    .is("superseded_at", null)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data ? asInsight(data) : null;
}

export async function markInsightStale(client: Client, insightId: string) {
  const { error } = await client
    .from("activity_insights")
    .update({ status: "stale" })
    .eq("id", insightId);
  if (error) {
    throw error;
  }
}

export async function saveActivityInsight(
  client: Client,
  insight: Omit<ActivityInsight, "id" | "generatedAt"> & { generatedAt?: string },
) {
  const latest = await loadLatestActivityInsight(client, insight.activityId);
  if (latest) {
    await client
      .from("activity_insights")
      .update({ superseded_at: new Date().toISOString(), status: "stale" })
      .eq("id", latest.id);
  }
  const { data, error } = await client
    .from("activity_insights")
    .insert({
      athlete_id: insight.athleteId,
      activity_id: insight.activityId,
      status: insight.status,
      headline: insight.headline,
      summary: insight.summary,
      findings: insight.findings as unknown as Json,
      implications: insight.implications,
      next_action: insight.nextAction,
      planned_vs_actual: insight.plannedVsActual as unknown as Json,
      confidence: insight.confidence,
      fingerprint: insight.fingerprint,
      model: insight.model,
      prompt_version: insight.promptVersion,
      packet_version: insight.packetVersion,
      input_tokens: insight.inputTokens,
      cached_input_tokens: insight.cachedInputTokens,
      output_tokens: insight.outputTokens,
      estimated_cost: insight.estimatedCost,
      latency_ms: insight.latencyMs,
    })
    .select(
      "id, athlete_id, activity_id, status, headline, summary, findings, implications, next_action, planned_vs_actual, confidence, fingerprint, model, prompt_version, packet_version, input_tokens, cached_input_tokens, output_tokens, estimated_cost, latency_ms, generated_at",
    )
    .single();
  if (error || !data) {
    throw error ?? new Error("Could not save activity insight.");
  }
  return asInsight(data);
}
