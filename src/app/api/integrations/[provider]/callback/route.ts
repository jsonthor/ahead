import {
  OAUTH,
  OAUTH_PROVIDER_COOKIE,
  OAUTH_RETURN_COOKIE,
  OAUTH_STATE_COOKIE,
  isOauthProvider,
  oauthCredentials,
  safeReturnPath,
  type OauthProviderId,
} from "@/lib/oauth";
import { finishCorosConnect } from "@/lib/coros/connect";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const maxDuration = 30;

export async function GET(
  request: Request,
  context: RouteContext<"/api/integrations/[provider]/callback">,
) {
  const { provider } = await context.params;
  if (provider === "coros") {
    return finishCorosConnect(request);
  }
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const denied = url.searchParams.get("error");
  const jar = await cookies();
  const returnPath = safeReturnPath(jar.get(OAUTH_RETURN_COOKIE)?.value);

  function finish(query: string) {
    const response = NextResponse.redirect(new URL(`${returnPath}${query}`, origin));
    response.cookies.set(OAUTH_STATE_COOKIE, "", { path: "/", maxAge: 0 });
    response.cookies.set(OAUTH_RETURN_COOKIE, "", { path: "/", maxAge: 0 });
    response.cookies.set(OAUTH_PROVIDER_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
  }

  if (!isOauthProvider(provider) || jar.get(OAUTH_PROVIDER_COOKIE)?.value !== provider) {
    return finish("?error=unknown");
  }
  if (denied) {
    return finish("?error=denied");
  }
  if (!state || jar.get(OAUTH_STATE_COOKIE)?.value !== state) {
    return finish("?error=state");
  }
  if (!code) {
    return finish("?error=code");
  }

  if (!code.startsWith("preview") && OAUTH[provider as OauthProviderId].tokenUrl) {
    const exchanged = await exchangeToken(provider as OauthProviderId, code, origin);
    if (!exchanged) {
      return finish("?error=token");
    }
  }

  return finish(`?connected=${provider}`);
}

async function exchangeToken(
  provider: OauthProviderId,
  code: string,
  origin: string,
): Promise<boolean> {
  const config = OAUTH[provider];
  if (!config.tokenUrl) {
    return false;
  }
  const { clientId, clientSecret } = oauthCredentials(provider);
  if (!clientId || !clientSecret) {
    return false;
  }
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: `${origin}/api/integrations/${provider}/callback`,
  });
  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  return response.ok;
}
