import { createClient } from "@/lib/supabase/server";
import {
  saveGoogleHealthTokens,
} from "@/lib/google-health/client";
import { GOOGLE_HEALTH_ACTIVITY_SCOPE } from "@/lib/google-health/types";
import { registerRecoverySource } from "@/lib/recovery/source";
import { OAUTH, oauthCredentials, requestOrigin } from "@/lib/oauth";
import { NextResponse } from "next/server";

export async function finishGoogleHealthConnect(
  request: Request,
  returnPath: string,
) {
  const origin = requestOrigin(request);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const denied = url.searchParams.get("error");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  function redirect(path: string) {
    return NextResponse.redirect(new URL(path, origin));
  }

  if (!user) {
    return redirect("/login?next=/app/connect");
  }
  if (denied) {
    return redirect(`${returnPath}?error=denied`);
  }
  if (!code) {
    return redirect(`${returnPath}?error=code`);
  }
  if (code.startsWith("preview")) {
    return redirect(`${returnPath}?connected=google_health`);
  }

  const { clientId, clientSecret } = oauthCredentials("google_health");
  const tokenUrl = OAUTH.google_health.tokenUrl;
  if (!clientId || !clientSecret || !tokenUrl) {
    return redirect(`${returnPath}?error=token`);
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: `${origin}/api/integrations/google_health/callback`,
  });
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
    scope?: string;
  };
  if (!response.ok || !payload.access_token) {
    return redirect(`${returnPath}?error=token`);
  }
  if (payload.scope?.includes(GOOGLE_HEALTH_ACTIVITY_SCOPE)) {
    return redirect(`${returnPath}?error=scope`);
  }

  await saveGoogleHealthTokens(user.id, {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? null,
    tokenType: payload.token_type ?? "Bearer",
    scope: payload.scope ?? null,
    expiresAt: payload.expires_in
      ? new Date(Date.now() + payload.expires_in * 1000).toISOString()
      : null,
  });
  await registerRecoverySource(user.id, "google_health");
  return redirect(
    `/connect/google_health?return=${encodeURIComponent(returnPath)}`,
  );
}
