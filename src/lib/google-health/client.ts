import { createAdminClient } from "@/lib/supabase/admin";
import {
  GOOGLE_DATA_TYPES,
  GOOGLE_HEALTH_ACTIVITY_SCOPE,
  GOOGLE_HEALTH_PROVIDER,
  type GoogleHealthTokens,
} from "@/lib/google-health/types";
import { oauthCredentials } from "@/lib/oauth";

const API_ROOT = "https://health.googleapis.com/v4/users/me/dataTypes";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export class GoogleHealthAuthError extends Error {
  reauth = true;
  constructor(message = "Google Health needs permission again.") {
    super(message);
  }
}

type ListResponse = {
  dataPoints?: Record<string, unknown>[];
  nextPageToken?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export async function loadGoogleHealthTokens(
  athleteId: string,
): Promise<GoogleHealthTokens | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("integrations")
    .select("access_token, refresh_token, token_expires_at, token_type, scope")
    .eq("athlete_id", athleteId)
    .eq("provider", GOOGLE_HEALTH_PROVIDER)
    .eq("status", "connected")
    .maybeSingle();
  if (!data?.access_token) {
    return null;
  }
  if (data.scope?.includes(GOOGLE_HEALTH_ACTIVITY_SCOPE)) {
    throw new Error("Google Health connected with activity scope. Disconnect and reconnect.");
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenType: data.token_type ?? "Bearer",
    scope: data.scope,
    expiresAt: data.token_expires_at,
  };
}

export async function saveGoogleHealthTokens(
  athleteId: string,
  tokens: GoogleHealthTokens,
) {
  if (tokens.scope?.includes(GOOGLE_HEALTH_ACTIVITY_SCOPE)) {
    throw new Error("Refusing to store Google Health activity scope.");
  }
  const admin = createAdminClient();
  const { error } = await admin.from("integrations").upsert(
    {
      athlete_id: athleteId,
      provider: GOOGLE_HEALTH_PROVIDER,
      status: "connected",
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_type: tokens.tokenType,
      scope: tokens.scope,
      token_expires_at: tokens.expiresAt,
    },
    { onConflict: "athlete_id,provider" },
  );
  if (error) {
    throw new Error(error.message);
  }
}

async function refreshAccessToken(athleteId: string, refreshToken: string) {
  const { clientId, clientSecret } = oauthCredentials("google_health");
  if (!clientId || !clientSecret) {
    throw new GoogleHealthAuthError();
  }
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    token_type?: string;
    scope?: string;
    refresh_token?: string;
  };
  if (!response.ok || !body.access_token) {
    throw new GoogleHealthAuthError();
  }
  const tokens: GoogleHealthTokens = {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? refreshToken,
    tokenType: body.token_type ?? "Bearer",
    scope: body.scope ?? null,
    expiresAt: body.expires_in
      ? new Date(Date.now() + body.expires_in * 1000).toISOString()
      : null,
  };
  await saveGoogleHealthTokens(athleteId, tokens);
  return tokens;
}

async function bearer(athleteId: string) {
  let tokens = await loadGoogleHealthTokens(athleteId);
  if (!tokens) {
    throw new GoogleHealthAuthError();
  }
  const expiring =
    tokens.expiresAt && Date.parse(tokens.expiresAt) - Date.now() < 60_000;
  if (expiring && tokens.refreshToken) {
    tokens = await refreshAccessToken(athleteId, tokens.refreshToken);
  }
  return tokens;
}

export async function googleHealthRequest(
  athleteId: string,
  path: string,
  search: Record<string, string>,
) {
  const run = async (accessToken: string) => {
    const url = new URL(`${API_ROOT}/${path}`);
    for (const [key, value] of Object.entries(search)) {
      url.searchParams.set(key, value);
    }
    return fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });
  };

  let tokens = await bearer(athleteId);
  let response = await run(tokens.accessToken);
  if (response.status === 401 && tokens.refreshToken) {
    tokens = await refreshAccessToken(athleteId, tokens.refreshToken);
    response = await run(tokens.accessToken);
  }
  if (response.status === 401) {
    throw new GoogleHealthAuthError();
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Health ${response.status}: ${text.slice(0, 400)}`);
  }
  return (await response.json()) as ListResponse;
}

export async function listDataPoints(
  athleteId: string,
  dataType: string,
  filter: string,
) {
  const points: Record<string, unknown>[] = [];
  let pageToken: string | undefined;
  do {
    const search: Record<string, string> = {
      filter,
      pageSize: dataType === GOOGLE_DATA_TYPES.sleep ? "25" : "100",
    };
    if (pageToken) {
      search.pageToken = pageToken;
    }
    const body = await googleHealthRequest(
      athleteId,
      `${dataType}/dataPoints`,
      search,
    );
    points.push(...(body.dataPoints ?? []));
    pageToken = body.nextPageToken || undefined;
  } while (pageToken);
  return points;
}

export async function reconcileDataPoints(
  athleteId: string,
  dataType: string,
  filter: string,
) {
  try {
    const body = await googleHealthRequest(
      athleteId,
      `${dataType}/dataPoints:reconcile`,
      { filter, pageSize: dataType === GOOGLE_DATA_TYPES.sleep ? "25" : "100" },
    );
    if (body.dataPoints?.length) {
      return body.dataPoints;
    }
  } catch (error) {
    console.error("Google Health reconcile failed", error);
  }
  return listDataPoints(athleteId, dataType, filter);
}

export function dateFilter(filterName: string, from: string, toExclusive: string) {
  return `${filterName}.date >= "${from}" AND ${filterName}.date < "${toExclusive}"`;
}

export function sleepEndFilter(from: string, toExclusive: string) {
  return `sleep.interval.civil_end_time >= "${from}" AND sleep.interval.civil_end_time < "${toExclusive}"`;
}

export function asObject(value: unknown) {
  return asRecord(value);
}
