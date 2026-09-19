import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  COROS_AS_COOKIE,
  COROS_MCP_COOKIE,
  COROS_MCP_URLS,
  COROS_VERIFIER_COOKIE,
  CorosOAuthProvider,
  clearHandoff,
  connectCorosMcp,
  discoveryFromIssuer,
  finishCorosAuth,
  issuerFromMcpUrl,
  loadHandoff,
} from "@/lib/coros/oauth";
import { requestOrigin, safeReturnPath } from "@/lib/oauth";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

function corosCookie(origin: string) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600,
    secure: origin.startsWith("https://"),
  };
}

function setCorosHandoffCookies(
  response: NextResponse,
  origin: string,
  values: {
    authorizationServer: string;
    mcpUrl: string;
    codeVerifier: string | null;
  },
) {
  const cookie = corosCookie(origin);
  response.cookies.set(COROS_AS_COOKIE, values.authorizationServer, cookie);
  response.cookies.set(COROS_MCP_COOKIE, values.mcpUrl, cookie);
  if (values.codeVerifier) {
    response.cookies.set(COROS_VERIFIER_COOKIE, values.codeVerifier, cookie);
  }
  return response;
}

function clearCorosHandoffCookies(response: NextResponse, origin: string) {
  const cookie = { ...corosCookie(origin), maxAge: 0 };
  response.cookies.set(COROS_AS_COOKIE, "", cookie);
  response.cookies.set(COROS_MCP_COOKIE, "", cookie);
  response.cookies.set(COROS_VERIFIER_COOKIE, "", cookie);
  return response;
}

export function corosImportPath(returnPath: string) {
  return `/connect/coros?return=${encodeURIComponent(safeReturnPath(returnPath))}`;
}

export async function openCorosClient(input: {
  origin: string;
  athleteId: string;
  returnPath?: string;
}) {
  let lastError: unknown;
  for (const mcpUrl of COROS_MCP_URLS) {
    const provider = new CorosOAuthProvider({
      origin: input.origin,
      athleteId: input.athleteId,
      returnPath: safeReturnPath(input.returnPath),
      mcpUrl,
    });
    try {
      const result = await connectCorosMcp(provider, mcpUrl);
      if ("unauthorized" in result && result.unauthorized) {
        return {
          unauthorized: true as const,
          authorizationUrl: result.authorizationUrl,
          cookies: provider.handoffCookies(),
        };
      }
      return { client: result.client, mcpUrl };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("COROS MCP did not connect.");
}

export async function startCorosConnect(request: Request, returnPath: string) {
  const origin = requestOrigin(request);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const login = new URL("/login", origin);
    const next = `/api/integrations/coros/start?return=${encodeURIComponent(returnPath)}`;
    login.searchParams.set("next", next);
    return NextResponse.redirect(login);
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("integrations")
    .select("access_token")
    .eq("athlete_id", user.id)
    .eq("provider", "coros")
    .maybeSingle();
  if (existing?.access_token) {
    return NextResponse.redirect(new URL(corosImportPath(returnPath), origin));
  }

  try {
    const result = await openCorosClient({
      origin,
      athleteId: user.id,
      returnPath,
    });
    if ("unauthorized" in result && result.unauthorized) {
      if (!result.authorizationUrl) {
        throw new Error("COROS did not return an authorize URL.");
      }
      const dest = NextResponse.redirect(result.authorizationUrl);
      return setCorosHandoffCookies(dest, origin, result.cookies);
    }
    await result.client.close();
    return NextResponse.redirect(new URL(corosImportPath(returnPath), origin));
  } catch (error) {
    console.error("COROS MCP start failed", error);
    const dest = new URL(safeReturnPath(returnPath), origin);
    dest.searchParams.set("error", "coros");
    return NextResponse.redirect(dest);
  }
}

export async function finishCorosConnect(request: Request) {
  const url = new URL(request.url);
  const origin = requestOrigin(request);
  const params = url.searchParams;
  const state = params.get("state");
  const denied = params.get("error");

  if (!state) {
    return NextResponse.redirect(new URL("/onboarding?error=state", origin));
  }
  const handoff = await loadHandoff(state);
  const jar = await cookies();
  const returnPath = handoff?.returnPath ?? "/onboarding";
  function done(query: string) {
    return clearCorosHandoffCookies(
      NextResponse.redirect(new URL(`${returnPath}${query}`, origin)),
      origin,
    );
  }
  if (!handoff) {
    return done("?error=state");
  }
  if (denied) {
    await clearHandoff(state);
    return done("?error=denied");
  }

  const cookieDiscovery = discoveryFromIssuer(
    jar.get(COROS_AS_COOKIE)?.value,
    jar.get(COROS_MCP_COOKIE)?.value ?? handoff.mcpUrl,
  );
  const discovery =
    handoff.discovery ??
    cookieDiscovery ??
    discoveryFromIssuer(issuerFromMcpUrl(handoff.mcpUrl), handoff.mcpUrl);
  const codeVerifier =
    handoff.codeVerifier ?? jar.get(COROS_VERIFIER_COOKIE)?.value ?? null;

  const provider = new CorosOAuthProvider({
    origin,
    athleteId: handoff.athleteId,
    returnPath: handoff.returnPath,
    mcpUrl: handoff.mcpUrl,
    state,
    discovery,
    codeVerifier,
  });

  try {
    const session = await finishCorosAuth(provider, handoff.mcpUrl, params);
    await session.client.close();
    await clearHandoff(state);
    return clearCorosHandoffCookies(
      NextResponse.redirect(new URL(corosImportPath(returnPath), origin)),
      origin,
    );
  } catch (error) {
    console.error("COROS MCP callback failed", error);
    await clearHandoff(state);
    return done("?error=coros");
  }
}
