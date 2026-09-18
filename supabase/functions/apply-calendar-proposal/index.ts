import { applyOperations } from "../_shared/apply.ts";
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

  const { data: proposal, error } = await client
    .from("calendar_proposals")
    .select("id, athlete_id, conversation_id, operations, snapshot, status, expires_at")
    .eq("id", proposalId)
    .maybeSingle();
  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }
  if (!proposal || proposal.athlete_id !== user.id) {
    return jsonResponse({ error: "not_found" }, 404);
  }
  if (proposal.status !== "pending") {
    return jsonResponse({ error: "not_pending", status: proposal.status }, 409);
  }
  if (proposal.expires_at && new Date(proposal.expires_at).getTime() < Date.now()) {
    await client.from("calendar_proposals").update({ status: "expired" }).eq("id", proposalId);
    return jsonResponse({ error: "expired" }, 409);
  }

  const operations = parseOperations(proposal.operations);
  if (operations.length === 0) {
    return jsonResponse({ error: "empty_ops" }, 400);
  }

  let result;
  try {
    result = await applyOperations(
      client,
      user.id,
      operations,
      (proposal.snapshot as ItemSnapshot[] | null) ?? [],
    );
  } catch (caught) {
    return jsonResponse({
      error: "apply_failed",
      message: caught instanceof Error ? caught.message : "Could not apply.",
    }, 409);
  }

  const now = new Date().toISOString();
  const { error: updateError } = await client
    .from("calendar_proposals")
    .update({ status: "applied", applied_at: now })
    .eq("id", proposalId);
  if (updateError) {
    return jsonResponse({ error: updateError.message }, 500);
  }

  const { data: action } = await client
    .from("agent_actions")
    .insert({
      athlete_id: user.id,
      proposal_id: proposalId,
      conversation_id: proposal.conversation_id,
      operations,
      result,
    })
    .select("id")
    .single();

  const appliedProposal = {
    id: proposalId,
    status: "applied",
    operations,
    snapshot: proposal.snapshot,
  };

  if (proposal.conversation_id) {
    await client
      .from("messages")
      .update({ proposal: appliedProposal })
      .eq("proposal_id", proposalId);
  }

  return jsonResponse({
    ok: true,
    proposalId,
    actionId: action?.id ?? null,
    createdIds: result.createdIds,
  });
});
