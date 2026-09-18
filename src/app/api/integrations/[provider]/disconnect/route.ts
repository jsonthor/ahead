import { isOauthProvider } from "@/lib/oauth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  context: RouteContext<"/api/integrations/[provider]/disconnect">,
) {
  const { provider } = await context.params;
  if (!isOauthProvider(provider)) {
    return Response.json({ error: "unknown" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "auth" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("integrations")
    .update({
      status: "revoked",
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
      token_type: null,
      scope: null,
      cursor: null,
    })
    .eq("athlete_id", user.id)
    .eq("provider", provider);
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, keptHistory: true });
}
