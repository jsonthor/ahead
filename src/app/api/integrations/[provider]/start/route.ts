import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  buildAuthorizeUrl,
  hasOauthCredentials,
  isOauthProvider,
  OAUTH_PROVIDER_COOKIE,
  OAUTH_RETURN_COOKIE,
  OAUTH_STATE_COOKIE,
  safeReturnPath,
  type OauthProviderId,
} from "@/lib/oauth";
import { startCorosConnect } from "@/lib/coros/connect";

export const maxDuration = 30;

export async function GET(
  request: Request,
  context: RouteContext<"/api/integrations/[provider]/start">,
) {
  const { provider } = await context.params;
  if (!isOauthProvider(provider)) {
    return NextResponse.redirect(new URL("/onboarding?error=unknown", request.url));
  }

  const returnPath = safeReturnPath(
    new URL(request.url).searchParams.get("return") ?? undefined,
  );

  if (provider === "coros") {
    return startCorosConnect(request, returnPath);
  }

  const state = crypto.randomUUID();
  const origin = new URL(request.url).origin;
  const authorizeUrl = hasOauthCredentials(provider)
    ? buildAuthorizeUrl(provider as OauthProviderId, { origin, state })
    : null;

  const destination =
    authorizeUrl ??
    `${origin}/connect/${provider}/permission?state=${encodeURIComponent(state)}`;

  const cookie = {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600,
    secure: origin.startsWith("https://"),
  };
  const jar = await cookies();
  jar.set(OAUTH_STATE_COOKIE, state, cookie);
  jar.set(OAUTH_RETURN_COOKIE, returnPath, cookie);
  jar.set(OAUTH_PROVIDER_COOKIE, provider, cookie);

  return NextResponse.redirect(destination);
}
