import {
  Client,
  StreamableHTTPClientTransport,
  UnauthorizedError,
  discoverOAuthServerInfo,
  type OAuthClientProvider,
  type OAuthDiscoveryState,
  type StoredOAuthClientInformation,
  type StoredOAuthTokens,
} from "@modelcontextprotocol/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeReturnPath } from "@/lib/oauth";
import type { Json } from "@/lib/database.types";

export const COROS_MCP_URLS = [
  "https://mcpeu.coros.com/mcp",
  "https://mcp.coros.com/mcp",
] as const;

export const COROS_AS_COOKIE = "potential_coros_as";
export const COROS_MCP_COOKIE = "potential_coros_mcp";
export const COROS_VERIFIER_COOKIE = "potential_coros_pkce";

export function issuerFromMcpUrl(mcpUrl: string) {
  return new URL(mcpUrl).origin;
}

export function mcpUrlFromDiscovery(
  discovery: OAuthDiscoveryState | undefined,
  fallback: string,
) {
  const resource = discovery?.resourceMetadata?.resource;
  if (typeof resource === "string" && resource.length > 0) {
    return resource.includes("/mcp")
      ? resource
      : `${resource.replace(/\/$/, "")}/mcp`;
  }
  const issuer = discovery?.authorizationServerUrl;
  if (issuer) {
    const base = issuer.replace(/\/$/, "");
    return base.endsWith("/mcp") ? base : `${base}/mcp`;
  }
  return fallback;
}

export function discoveryFromIssuer(
  authorizationServerUrl: string | null | undefined,
  mcpUrl?: string | null,
): OAuthDiscoveryState | undefined {
  if (!authorizationServerUrl) {
    return undefined;
  }
  const resource = mcpUrl?.trim();
  return {
    authorizationServerUrl,
    ...(resource ? { resourceMetadata: { resource } } : {}),
  };
}

function jsonDiscovery(state: OAuthDiscoveryState): Json {
  return JSON.parse(JSON.stringify(state)) as Json;
}

export function corosRedirectUrl(origin: string) {
  return `${origin}/api/integrations/coros/callback`;
}

export class CorosOAuthProvider implements OAuthClientProvider {
  authorizationUrl: URL | null = null;
  lastState: string | null = null;
  private pendingVerifier: string | null = null;
  private pendingDiscovery: OAuthDiscoveryState | null = null;

  private mcpUrl: string;

  constructor(
    private readonly input: {
      origin: string;
      athleteId: string;
      returnPath: string;
      mcpUrl: string;
      state?: string;
      discovery?: OAuthDiscoveryState;
      codeVerifier?: string | null;
    },
  ) {
    this.mcpUrl = input.mcpUrl;
    this.lastState = input.state ?? null;
    this.pendingDiscovery = input.discovery ?? null;
    this.pendingVerifier = input.codeVerifier ?? null;
    if (input.discovery) {
      this.mcpUrl = mcpUrlFromDiscovery(input.discovery, input.mcpUrl);
    }
  }

  handoffCookies() {
    const discovery = this.pendingDiscovery;
    const mcpUrl = mcpUrlFromDiscovery(discovery ?? undefined, this.mcpUrl);
    return {
      authorizationServer:
        discovery?.authorizationServerUrl ?? issuerFromMcpUrl(mcpUrl),
      mcpUrl,
      codeVerifier: this.pendingVerifier,
    };
  }

  get redirectUrl() {
    return corosRedirectUrl(this.input.origin);
  }

  get clientMetadata() {
    return {
      client_name: "Ahead",
      redirect_uris: [this.redirectUrl],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      application_type: "web" as const,
    };
  }

  state() {
    if (!this.lastState) {
      this.lastState = crypto.randomUUID();
    }
    return this.lastState;
  }

  async clientInformation(ctx?: { issuer?: string }) {
    const admin = createAdminClient();
    const candidates = [ctx?.issuer, this.mcpUrl, issuerFromMcpUrl(this.mcpUrl)].filter(
      (value, index, list): value is string => Boolean(value) && list.indexOf(value) === index,
    );
    for (const issuer of candidates) {
      const { data } = await admin
        .from("mcp_oauth_clients")
        .select("client_information")
        .eq("issuer", issuer)
        .maybeSingle();
      if (data?.client_information) {
        return data.client_information as StoredOAuthClientInformation;
      }
    }
    return undefined;
  }

  async saveClientInformation(
    info: StoredOAuthClientInformation,
    ctx?: { issuer?: string },
  ) {
    const admin = createAdminClient();
    const issuer = ctx?.issuer ?? this.mcpUrl;
    await admin.from("mcp_oauth_clients").upsert({
      issuer,
      client_information: info as unknown as Json,
      updated_at: new Date().toISOString(),
    });
  }

  async tokens() {
    const admin = createAdminClient();
    const { data } = await admin
      .from("integrations")
      .select("access_token, refresh_token, token_expires_at, token_type, scope")
      .eq("athlete_id", this.input.athleteId)
      .eq("provider", "coros")
      .maybeSingle();
    if (!data?.access_token) {
      return undefined;
    }
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? undefined,
      token_type: data.token_type ?? "Bearer",
      expires_in: data.token_expires_at
        ? Math.max(
            0,
            Math.floor(
              (new Date(data.token_expires_at).getTime() - Date.now()) / 1000,
            ),
          )
        : undefined,
      scope: data.scope ?? undefined,
    } satisfies StoredOAuthTokens;
  }

  async saveTokens(tokens: StoredOAuthTokens) {
    const admin = createAdminClient();
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;
    await admin.from("integrations").upsert(
      {
        athlete_id: this.input.athleteId,
        provider: "coros",
        status: "connected",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        token_type: tokens.token_type ?? "Bearer",
        scope: tokens.scope ?? null,
        token_expires_at: expiresAt,
        mcp_url: this.mcpUrl,
      },
      { onConflict: "athlete_id,provider" },
    );
  }

  async redirectToAuthorization(url: URL) {
    this.authorizationUrl = url;
    this.lastState = url.searchParams.get("state") ?? this.state();
    await this.flushHandoff();
  }

  async saveCodeVerifier(codeVerifier: string) {
    this.pendingVerifier = codeVerifier;
    await this.flushHandoff();
  }

  async codeVerifier() {
    if (this.pendingVerifier) {
      return this.pendingVerifier;
    }
    const state = this.lastState;
    if (!state) {
      throw new Error("Missing OAuth state.");
    }
    const admin = createAdminClient();
    const { data } = await admin
      .from("oauth_handoffs")
      .select("code_verifier")
      .eq("state", state)
      .maybeSingle();
    if (!data?.code_verifier) {
      throw new Error("Missing PKCE verifier.");
    }
    this.pendingVerifier = data.code_verifier;
    return data.code_verifier;
  }

  async saveDiscoveryState(state: OAuthDiscoveryState) {
    this.pendingDiscovery = state;
    await this.flushHandoff();
  }

  async discoveryState() {
    if (this.pendingDiscovery) {
      return this.pendingDiscovery;
    }
    if (!this.lastState) {
      return undefined;
    }
    const admin = createAdminClient();
    const { data } = await admin
      .from("oauth_handoffs")
      .select("discovery_state")
      .eq("state", this.lastState)
      .maybeSingle();
    const stored = (data?.discovery_state as OAuthDiscoveryState | null) ?? undefined;
    if (stored) {
      this.pendingDiscovery = stored;
    }
    return stored;
  }

  private async flushHandoff() {
    const state = this.lastState ?? this.state();
    this.lastState = state;
    const admin = createAdminClient();
    if (this.pendingDiscovery) {
      this.mcpUrl = mcpUrlFromDiscovery(this.pendingDiscovery, this.mcpUrl);
    }
    const row: {
      state: string;
      athlete_id: string;
      return_path: string;
      mcp_url: string;
      expires_at: string;
      code_verifier?: string;
      discovery_state?: Json;
    } = {
      state,
      athlete_id: this.input.athleteId,
      return_path: this.input.returnPath,
      mcp_url: this.mcpUrl,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };
    if (this.pendingVerifier) {
      row.code_verifier = this.pendingVerifier;
    }
    if (this.pendingDiscovery) {
      row.discovery_state = jsonDiscovery(this.pendingDiscovery);
    }
    const { error } = await admin.from("oauth_handoffs").upsert(row);
    if (error) {
      throw new Error(`Failed to persist COROS OAuth handoff: ${error.message}`);
    }
  }
}

export async function loadHandoff(state: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("oauth_handoffs")
    .select("state, athlete_id, return_path, mcp_url, expires_at, discovery_state, code_verifier")
    .eq("state", state)
    .maybeSingle();
  if (!data) {
    return null;
  }
  if (new Date(data.expires_at).getTime() < Date.now()) {
    return null;
  }
  const discovery = (data.discovery_state as OAuthDiscoveryState | null) ?? undefined;
  return {
    state: data.state,
    athleteId: data.athlete_id,
    returnPath: safeReturnPath(data.return_path),
    mcpUrl: mcpUrlFromDiscovery(discovery, data.mcp_url ?? COROS_MCP_URLS[0]),
    discovery,
    codeVerifier: data.code_verifier,
  };
}

export async function clearHandoff(state: string) {
  const admin = createAdminClient();
  await admin.from("oauth_handoffs").delete().eq("state", state);
}

export async function connectCorosMcp(provider: CorosOAuthProvider, mcpUrl: string) {
  const client = new Client({ name: "potential", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL(mcpUrl), {
    authProvider: provider,
  });
  try {
    await client.connect(transport);
    return { client, transport };
  } catch (error) {
    await transport.close().catch(() => undefined);
    if (error instanceof UnauthorizedError) {
      return { unauthorized: true as const, authorizationUrl: provider.authorizationUrl };
    }
    throw error;
  }
}

export async function finishCorosAuth(
  provider: CorosOAuthProvider,
  mcpUrl: string,
  params: URLSearchParams,
) {
  let discovery = await provider.discoveryState();
  if (!discovery?.authorizationServerUrl) {
    const info = await discoverOAuthServerInfo(new URL(mcpUrl));
    discovery = {
      authorizationServerUrl: info.authorizationServerUrl,
      authorizationServerMetadata: info.authorizationServerMetadata,
      resourceMetadata: info.resourceMetadata,
    };
    await provider.saveDiscoveryState(discovery);
  }
  const url = mcpUrlFromDiscovery(discovery, mcpUrl);
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    authProvider: provider,
  });
  await transport.finishAuth(params);
  const client = new Client({ name: "potential", version: "0.1.0" });
  const next = new StreamableHTTPClientTransport(new URL(url), {
    authProvider: provider,
  });
  await client.connect(next);
  return { client, transport: next, mcpUrl: url };
}
