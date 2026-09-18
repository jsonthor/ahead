import { undoOperations } from "../_shared/apply.ts";
import { jsonResponse, optionsResponse } from "../_shared/cors.ts";
import { requireUser, userClient } from "../_shared/client.ts";
import { parseOperations, type ItemSnapshot } from "../_shared/operations.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return optionsResponse();
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method" }, 405);
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

  const body = (await req.json().catch(() => null)) as { proposalId?: string } | null;
  const proposalId = body?.proposalId?.trim() ?? "";
  if (!proposalId) {
    return jsonResponse({ error: "proposal" }, 400);
  }

  const { data: action, error } = await client
    .from("agent_actions")
    .select("id, athlete_id, proposal_id, operations, result, undone_at")
    .eq("proposal_id", proposalId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }
  if (!action || action.athlete_id !== user.id) {
    return jsonResponse({ error: "not_found" }, 404);
  }
  if (action.undone_at) {
    return jsonResponse({ error: "already_undone" }, 409);
  }

  const { data: proposal } = await client
    .from("calendar_proposals")
    .select("id, snapshot, conversation_id")
    .eq("id", proposalId)
    .maybeSingle();

  const operations = parseOperations(action.operations);
  const createdIds = Array.isArray((action.result as { createdIds?: unknown } | null)?.createdIds)
    ? ((action.result as { createdIds: string[] }).createdIds)
    : [];

  try {
    await undoOperations(
      client,
      user.id,
      operations,
      ((proposal?.snapshot as ItemSnapshot[] | null) ?? []),
      createdIds,
    );
  } catch (caught) {
    return jsonResponse({
      error: "undo_failed",
      message: caught instanceof Error ? caught.message : "Could not undo.",
    }, 409);
  }

  const now = new Date().toISOString();
  await client.from("agent_actions").update({ undone_at: now }).eq("id", action.id);
  await client.from("calendar_proposals").update({ status: "undone" }).eq("id", proposalId);

  if (proposal?.conversation_id) {
    await client
      .from("messages")
      .update({
        proposal: {
          id: proposalId,
          status: "undone",
          operations,
          snapshot: proposal.snapshot,
        },
      })
      .eq("proposal_id", proposalId);
  }

  return jsonResponse({ ok: true, proposalId });
});
