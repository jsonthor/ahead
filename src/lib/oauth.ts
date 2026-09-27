import type { ProviderId } from "@/lib/integrations";

export type OauthProviderId = Exclude<ProviderId, "fit">;

export type OauthConfig = {
  id: OauthProviderId;
  authorizeUrl: string;
  tokenUrl?: string;
  scopes?: string;
  clientIdEnv: string;
  clientSecretEnv: string;
  extraParams?: Record<string, string>;
};

export const OAUTH: Record<OauthProviderId, OauthConfig> = {
  garmin: {
    id: "garmin",
    authorizeUrl: "https://connect.garmin.com/oauthConfirm",
    clientIdEnv: "GARMIN_CLIENT_ID",
    clientSecretEnv: "GARMIN_CLIENT_SECRET",
  },
  coros: {
    id: "coros",
    authorizeUrl: "https://mcp.coros.com/mcp",
    clientIdEnv: "COROS_CLIENT_ID",
    clientSecretEnv: "COROS_CLIENT_SECRET",
  },
  polar: {
    id: "polar",
    authorizeUrl: "https://flow.polar.com/oauth2/authorization",
    tokenUrl: "https://polarremote.com/v2/oauth2/token",
    scopes: "accesslink.read_all",
    clientIdEnv: "POLAR_CLIENT_ID",
    clientSecretEnv: "POLAR_CLIENT_SECRET",
  },
  strava: {
    id: "strava",
    authorizeUrl: "https://www.strava.com/oauth/authorize",
    tokenUrl: "https://www.strava.com/oauth/token",
    scopes: "activity:read_all",
    clientIdEnv: "STRAVA_CLIENT_ID",
    clientSecretEnv: "STRAVA_CLIENT_SECRET",
  },
  apple: {
    id: "apple",
    authorizeUrl: "",
    clientIdEnv: "APPLE_CLIENT_ID",
    clientSecretEnv: "APPLE_CLIENT_SECRET",
  },
  wahoo: {
    id: "wahoo",
    authorizeUrl: "https://api.wahooligan.com/oauth/authorize",
    tokenUrl: "https://api.wahooligan.com/oauth/token",
    clientIdEnv: "WAHOO_CLIENT_ID",
    clientSecretEnv: "WAHOO_CLIENT_SECRET",
  },
  suunto: {
    id: "suunto",
    authorizeUrl: "https://cloudapi-oauth.suunto.com/oauth/authorize",
    tokenUrl: "https://cloudapi-oauth.suunto.com/oauth/token",
    clientIdEnv: "SUUNTO_CLIENT_ID",
    clientSecretEnv: "SUUNTO_CLIENT_SECRET",
  },
  google_health: {
    id: "google_health",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes:
      "https://www.googleapis.com/auth/googlehealth.sleep.readonly https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly",
    clientIdEnv: "GOOGLE_HEALTH_CLIENT_ID",
    clientSecretEnv: "GOOGLE_HEALTH_CLIENT_SECRET",
    extraParams: {
      access_type: "offline",
      prompt: "consent",
    },
  },
};

export const OAUTH_STATE_COOKIE = "potential.oauth.state";
export const OAUTH_RETURN_COOKIE = "potential.oauth.return";
export const OAUTH_PROVIDER_COOKIE = "potential.oauth.provider";

export function isOauthProvider(value: string): value is OauthProviderId {
  return value in OAUTH;
}

export function oauthCredentials(id: OauthProviderId): {
  clientId: string | undefined;
  clientSecret: string | undefined;
} {
  const config = OAUTH[id];
  return {
    clientId: process.env[config.clientIdEnv],
    clientSecret: process.env[config.clientSecretEnv],
  };
}

export function hasOauthCredentials(id: OauthProviderId): boolean {
  const { clientId, clientSecret } = oauthCredentials(id);
  return Boolean(clientId && clientSecret && OAUTH[id].authorizeUrl);
}

export function buildAuthorizeUrl(id: OauthProviderId, input: {
  origin: string;
  state: string;
}): string | null {
  const config = OAUTH[id];
  const { clientId } = oauthCredentials(id);
  if (!clientId || !config.authorizeUrl) {
    return null;
  }
  const redirectUri = `${input.origin}/api/integrations/${id}/callback`;
  const url = new URL(config.authorizeUrl);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", input.state);
  if (config.scopes) {
    url.searchParams.set("scope", config.scopes);
  }
  if (config.extraParams) {
    for (const [key, value] of Object.entries(config.extraParams)) {
      url.searchParams.set(key, value);
    }
  }
  if (id === "strava") {
    url.searchParams.set("approval_prompt", "auto");
  }
  return url.toString();
}

export function safeReturnPath(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/onboarding";
  }
  return value;
}

export function requestOrigin(request: Request) {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host = forwardedHost || url.host;
  const proto = forwardedProto || url.protocol.replace(":", "");
  if (host === "getahead.fit" || host === "www.getahead.fit") {
    return "https://www.getahead.fit";
  }
  return `${proto}://${host}`;
}
