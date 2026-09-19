import { athleteAge } from "../_shared/age.ts";
import {
  DIRECTION_HISTORY_DAYS,
  fetchRouteAttempts,
  inferDirection,
  isDirectionCalibration,
} from "../_shared/direction.ts";
import { corsHeaders, jsonResponse, optionsResponse } from "../_shared/cors.ts";
import { openaiKey, requireUser, userClient } from "../_shared/client.ts";
import {
  createChatResponse,
  functionCalls,
  LUNA_MODEL,
  outputText,
  TERRA_MODEL,
} from "../_shared/openai.ts";
import {
  developerInputMessage,
  looksDurableMemory,
  shouldEscalateToTerra,
  turnContextText,
  userInputMessage,
} from "../_shared/prompt.ts";
import { executeTool } from "../_shared/tools.ts";

const HISTORY_CAP = 12;
const TOOL_ROUNDS = 6;

type UiContext = {
  route?: string;
  visibleDates?: string[];
  activityId?: string;
  directionDate?: string;
  direction?: {
    date: string;
    label: string;
    score: number | null;
    conclusion: string;
  };
};

function slimMemories(rows: unknown) {
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows.slice(0, 4).map((row) => {
    const memory = row as { type?: unknown; content?: unknown };
    return {
      type: typeof memory.type === "string" ? memory.type : "fact",
      content: typeof memory.content === "string" ? memory.content : "",
    };
  }).filter((row) => row.content);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return optionsResponse();
  }

  let client;
  try {
    client = userClient(req);
  } catch (error) {
    return jsonResponse({ error: "auth", message: error instanceof Error ? error.message : "auth" }, 401);
  }

  let user;
  try {
    user = await requireUser(client);
  } catch {
    return jsonResponse({ error: "auth" }, 401);
  }

  if (req.method === "GET") {
    return jsonResponse({ ready: Boolean(openaiKey()) });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "method" }, 405);
  }

  if (!openaiKey()) {
    return jsonResponse({
      error: "missing_openai_key",
      message: "Set OPENAI_API_KEY as a Supabase Edge Function secret.",
    }, 503);
  }

  const body = (await req.json().catch(() => null)) as {
    conversationId?: string | null;
    message?: string;
    uiContext?: UiContext;
  } | null;
  const message = body?.message?.trim() ?? "";
  if (!message) {
    return jsonResponse({ error: "empty" }, 400);
  }

  const { data: profile } = await client
    .from("profiles")
      .select("display_name, timezone, units, date_of_birth, potential_calibration")
    .eq("id", user.id)
    .maybeSingle();
  const timeZone = profile?.timezone || "Europe/London";

  let conversationId = body?.conversationId ?? null;
  let previousResponseId: string | null = null;
  if (conversationId) {
    const { data: owned } = await client
      .from("conversations")
      .select("id, openai_response_id")
      .eq("id", conversationId)
      .eq("athlete_id", user.id)
      .maybeSingle();
    if (!owned) {
      conversationId = null;
    } else {
      previousResponseId = owned.openai_response_id ?? null;
    }
  }
  if (!conversationId) {
    const { data: created, error } = await client
      .from("conversations")
      .insert({ athlete_id: user.id, title: message.slice(0, 80) })
      .select("id")
      .single();
    if (error || !created) {
      return jsonResponse({ error: "conversation", message: error?.message }, 500);
    }
    conversationId = created.id as string;
  }

  const { error: userMessageError } = await client.from("messages").insert({
    conversation_id: conversationId,
    athlete_id: user.id,
    role: "user",
    content: message,
  });
  if (userMessageError) {
    return jsonResponse({ error: "message", message: userMessageError.message }, 500);
  }

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const [{ data: memories }, { data: directionRows }] = await Promise.all([
    client.rpc("search_athlete_memory", {
      p_query: message,
      p_limit: 4,
    }),
    client
      .from("daily_loads")
      .select(
        "date, training_load, fitness, fatigue, form, potential, aerobic_reserve, specific_capacity, aerobic_raw, specific_raw",
      )
      .lte("date", today)
      .order("date", { ascending: false })
      .limit(DIRECTION_HISTORY_DAYS),
  ]);
  const attempts = await fetchRouteAttempts(client, today);
  const direction = inferDirection(
    [...(directionRows ?? [])].reverse(),
    today,
    attempts,
    isDirectionCalibration(profile?.potential_calibration) ? profile.potential_calibration : null,
  );

  const turnContext = {
    today,
    timezone: timeZone,
    athlete: {
      name: profile?.display_name ?? "Athlete",
      units: profile?.units ?? "metric",
      ...(athleteAge(profile?.date_of_birth, new Date(), timeZone) ?? {}),
    },
    direction: {
      state: direction.state,
      label: direction.label,
      score: direction.score,
      strain: direction.strain,
      summary: direction.summary,
      conclusion: direction.conclusion,
      confidence: direction.confidence,
      confidenceLabel: direction.confidenceLabel,
      performanceNote: direction.performanceNote,
      explanation: direction.explanation,
      evidence: direction.evidence,
      signals: direction.signals,
      windowLabel: direction.windowLabel,
      windowDays: direction.windowDays,
      trajectory: direction.trajectory,
      trajectoryLabel: direction.trajectoryLabel,
    },
    uiContext: body?.uiContext ?? null,
    relevantMemories: slimMemories(memories),
  };
  const userTurn = turnContextText(turnContext, message);
  const escalate = shouldEscalateToTerra(message);
  const model = escalate ? TERRA_MODEL : LUNA_MODEL;
  const reasoning = escalate ? "medium" : "low";

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      let reply = "";
      let proposal: unknown = null;
      let savedMemory = false;
      let responseId = previousResponseId;
      try {
        send({ type: "conversation", conversationId });

        let input: unknown = previousResponseId
          ? [userInputMessage(userTurn)]
          : await historyInput(client, conversationId, userTurn);

        for (let round = 0; round < TOOL_ROUNDS; round += 1) {
          let response;
          try {
            response = await createChatResponse({
              model,
              reasoning,
              input,
              previousResponseId: round === 0 ? previousResponseId : responseId,
              comparisonResponseId: round === 0 ? previousResponseId : responseId,
            });
          } catch (error) {
            if (round !== 0 || !previousResponseId) {
              throw error;
            }
            previousResponseId = null;
            input = await historyInput(client, conversationId, userTurn);
            response = await createChatResponse({
              model,
              reasoning,
              input,
              previousResponseId: null,
            });
          }
          responseId = response.id;
          const details = response.usage?.input_tokens_details;
          console.log(
            "potential-ai round",
            round,
            "model",
            model,
            "status",
            response.status,
            "types",
            (response.output ?? []).map((item) => item.type),
            "incomplete",
            response.incomplete_details ?? null,
            "tokens",
            {
              input: response.usage?.input_tokens ?? null,
              output: response.usage?.output_tokens ?? null,
              cached: details?.cached_tokens ?? null,
              cacheWrite: details?.cache_write_tokens ?? null,
            },
            "cacheDiagnostics",
            response.prompt_cache_diagnostics ?? null,
          );
          const calls = functionCalls(response);
          if (calls.length === 0) {
            reply = outputText(response);
            if (reply) {
              send({ type: "text", text: reply });
            } else if (response.incomplete_details?.reason) {
              throw new Error(
                `Ask Ahead stopped early (${response.incomplete_details.reason}). Try a shorter question.`,
              );
            }
            break;
          }
          const outputs: unknown[] = [];
          for (const call of calls) {
            let args: Record<string, unknown> = {};
            try {
              args = JSON.parse(call.arguments || "{}") as Record<string, unknown>;
            } catch {
              args = {};
            }
            if (call.name === "save_athlete_memory") {
              savedMemory = true;
            }
            const executed = await executeTool(client, {
              athleteId: user.id,
              timeZone,
              conversationId,
              name: call.name ?? "",
              args,
            });
            if (executed.proposal) {
              proposal = executed.proposal;
              send({ type: "proposal", proposal: executed.proposal });
            }
            outputs.push({
              type: "function_call_output",
              call_id: call.call_id,
              output: JSON.stringify(executed.result),
            });
          }
          input = outputs;
        }

        if (!reply && !proposal) {
          throw new Error("Ask Ahead returned an empty answer. Try again.");
        }

        const { data: saved } = await client
          .from("messages")
          .insert({
            conversation_id: conversationId,
            athlete_id: user.id,
            role: "assistant",
            content: reply || (proposal ? "I have a calendar change ready for you to apply." : ""),
            proposal,
            proposal_id: (proposal as { id?: string } | null)?.id ?? null,
          })
          .select("id")
          .single();

        await client
          .from("conversations")
          .update({
            updated_at: new Date().toISOString(),
            openai_response_id: responseId,
          })
          .eq("id", conversationId);

        send({
          type: "done",
          messageId: saved?.id ?? null,
          conversationId,
          extractMemory: !savedMemory && looksDurableMemory(message),
        });
      } catch (error) {
        console.error("potential-ai failed", error);
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
      ...corsHeaders,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
});

async function historyInput(
  client: ReturnType<typeof userClient>,
  conversationId: string,
  latestUserTurn: string,
) {
  const { data } = await client
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  const rows = (data ?? [])
    .filter((row) => row.role === "user" || row.role === "assistant")
    .slice(-HISTORY_CAP)
    .map((row) => ({
      role: row.role as "user" | "assistant",
      content: row.content,
    }));
  const last = rows[rows.length - 1];
  if (!last || last.role !== "user") {
    rows.push({ role: "user", content: latestUserTurn });
  } else {
    rows[rows.length - 1] = { role: "user", content: latestUserTurn };
  }
  return [developerInputMessage(), ...rows];
}
