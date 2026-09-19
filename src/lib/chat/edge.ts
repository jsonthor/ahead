import { createClient } from "@/lib/supabase/client";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";

async function authHeaders() {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Not signed in.");
  }
  return {
    Authorization: `Bearer ${session.access_token}`,
    apikey: supabasePublishableKey(),
    "Content-Type": "application/json",
  };
}

function functionUrl(name: string) {
  return `${supabaseUrl()}/functions/v1/${name}`;
}

export async function potentialAiReady() {
  try {
    const headers = await authHeaders();
    const response = await fetch(functionUrl("potential-ai"), { headers });
    if (!response.ok) {
      return false;
    }
    const body = (await response.json()) as { ready?: boolean };
    return body.ready === true;
  } catch {
    return false;
  }
}

export async function invokePotentialAi(input: {
  conversationId: string | null;
  message: string;
  uiContext?: {
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
}) {
  const headers = await authHeaders();
  const response = await fetch(functionUrl("potential-ai"), {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });
  if (!response.ok || !response.body) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message || "Ask Ahead could not reply.");
  }
  return response;
}

export async function applyCalendarProposal(proposalId: string) {
  const headers = await authHeaders();
  const response = await fetch(functionUrl("apply-calendar-proposal"), {
    method: "POST",
    headers,
    body: JSON.stringify({ proposalId }),
  });
  const body = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;
  if (!response.ok) {
    throw new Error(body?.message || body?.error || "Could not apply that change.");
  }
}

export async function undoCalendarProposal(proposalId: string) {
  const headers = await authHeaders();
  const response = await fetch(functionUrl("undo-calendar-action"), {
    method: "POST",
    headers,
    body: JSON.stringify({ proposalId }),
  });
  const body = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;
  if (!response.ok) {
    throw new Error(body?.message || body?.error || "Could not undo that change.");
  }
}

export async function extractAiMemory(conversationId: string) {
  try {
    const headers = await authHeaders();
    await fetch(functionUrl("extract-ai-memory"), {
      method: "POST",
      headers,
      body: JSON.stringify({ conversationId }),
    });
  } catch {
    // Background job; the chat should not fail if extraction does.
  }
}
