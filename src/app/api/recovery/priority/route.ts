import {
  parseRecoveryPriority,
  recastRecoveryHistory,
  saveRecoveryPriority,
  withConnectedSources,
  type RecoverySourcePriority,
} from "@/lib/recovery/source";
import { PROVIDERS } from "@/lib/integrations";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function athlete() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

function connectedRecoverySources(providers: string[]) {
  return PROVIDERS.filter(
    (provider) => provider.capabilities.recovery && providers.includes(provider.id),
  ).map((provider) => provider.id);
}

export async function GET() {
  const user = await athlete();
  if (!user) {
    return Response.json({ error: "auth" }, { status: 401 });
  }
  const admin = createAdminClient();
  const [{ data: profile }, { data: integrations }] = await Promise.all([
    admin
      .from("profiles")
      .select("recovery_source_preference")
      .eq("id", user.id)
      .maybeSingle(),
    admin
      .from("integrations")
      .select("provider")
      .eq("athlete_id", user.id)
      .eq("status", "connected"),
  ]);
  const connected = connectedRecoverySources(
    (integrations ?? []).map((row) => row.provider),
  );
  const stored = parseRecoveryPriority(profile?.recovery_source_preference);
  const priority = withConnectedSources(stored, connected);
  return Response.json({
    connected,
    priority,
  });
}

export async function PUT(request: Request) {
  const user = await athlete();
  if (!user) {
    return Response.json({ error: "auth" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as RecoverySourcePriority | null;
  if (!body) {
    return Response.json({ error: "body" }, { status: 400 });
  }
  const current = await saveRecoveryPriority(user.id, {
    sleep: body.sleep ?? [],
    hrv: body.hrv ?? [],
    resting_hr: body.resting_hr ?? [],
    pending: [],
  });
  return Response.json({ priority: current });
}

export async function POST(request: Request) {
  const user = await athlete();
  if (!user) {
    return Response.json({ error: "auth" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { recast?: boolean };
  if (!body.recast) {
    return Response.json({ error: "recast" }, { status: 400 });
  }
  const days = await recastRecoveryHistory(user.id);
  return Response.json({ ok: true, days });
}
