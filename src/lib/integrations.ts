/**
 * Integration catalogue. Edit this list as providers come online.
 * OAuth still waits on Supabase; this module is the product contract.
 *
 * Question for every ecosystem: can Potential legally and technically
 * receive completed activity data?
 *
 * MVP ingest (feeds intelligence):
 *   Garmin Activity API, COROS, Polar AccessLink, FIT/GPX upload
 *
 * Later:
 *   Apple Health (iPhone app) — also the path for Amazfit/Zepp
 *
 * Not core:
 *   Strava (policy blocks AI/analytics). Display overlay only.
 *
 * Device integrations are inbound importers. Potential does not send
 * workouts back to Garmin / COROS / Amazfit in this architecture.
 */

import { isIntelligenceSource, type ActivitySource } from "@/lib/activity-source";
import { createClient } from "@/lib/supabase/client";

export type ProviderId = Extract<
  ActivitySource,
  "fit" | "garmin" | "coros" | "polar" | "strava" | "apple" | "wahoo" | "suunto"
>;

export type ProviderGroup = "primary" | "optional" | "later";

export type Provider = {
  id: ProviderId;
  name: string;
  group: ProviderGroup;
  kind: "oauth" | "file";
  intelligence: boolean;
  live: boolean;
  title: string;
  body: string;
  route: string;
  restriction?: string;
};

export const PROVIDERS: Provider[] = [
  {
    id: "coros",
    name: "COROS",
    group: "primary",
    kind: "oauth",
    intelligence: true,
    live: true,
    title: "COROS MCP",
    body: "Athlete OAuth into COROS MCP. Potential pulls completed workouts and builds its own activity record.",
    route: "COROS MCP",
  },
  {
    id: "fit",
    name: "FIT / GPX",
    group: "primary",
    kind: "file",
    intelligence: true,
    live: true,
    title: "Upload files you own",
    body: "FIT, GPX, TCX, or a zip of those files from any watch. Same canonical activity as a vendor pull.",
    route: "File upload",
  },
  {
    id: "garmin",
    name: "Garmin",
    group: "primary",
    kind: "oauth",
    intelligence: true,
    live: false,
    title: "Garmin Connect Activity API",
    body: "Watch or Edge syncs to Garmin Connect; Potential pulls the activity and the FIT file. Apply to the developer program early — no Connect IQ app.",
    route: "Garmin Connect Activity API",
  },
  {
    id: "polar",
    name: "Polar",
    group: "primary",
    kind: "oauth",
    intelligence: true,
    live: false,
    title: "AccessLink",
    body: "OAuth2 training sessions: duration, distance, HR, laps, zones, samples. Polar’s numbers stay metadata; Potential calculates load.",
    route: "Polar AccessLink",
  },
  {
    id: "strava",
    name: "Strava",
    group: "optional",
    kind: "oauth",
    intelligence: false,
    live: false,
    title: "Optional overlay",
    body: "Technically an activity API. Policy forbids using that data to operate an AI app or for analytics. Not a Potential intelligence source.",
    route: "Strava API",
    restriction:
      "Strava’s 1 June 2026 API policy forbids using API data to operate an AI application, including putting it in a model context window, and restricts analytics on that data. Strava MCP is personal use, not a Potential integration.",
  },
  {
    id: "apple",
    name: "Apple Health",
    group: "later",
    kind: "oauth",
    intelligence: true,
    live: false,
    title: "HealthKit via iPhone app",
    body: "Needs a Potential iPhone app. Also the realistic path for Amazfit/Zepp, which can sync into Apple Health and has no public cloud activity API.",
    route: "HealthKit",
  },
  {
    id: "wahoo",
    name: "Wahoo",
    group: "later",
    kind: "oauth",
    intelligence: true,
    live: false,
    title: "Wahoo Cloud",
    body: "Partner approval. Inbound activities when we need head-unit coverage beyond Garmin.",
    route: "Wahoo Cloud API",
  },
  {
    id: "suunto",
    name: "Suunto",
    group: "later",
    kind: "oauth",
    intelligence: true,
    live: false,
    title: "Suunto",
    body: "More ingest later if athletes ask.",
    route: "Suunto Cloud",
  },
];

export function providersIn(group: ProviderGroup): Provider[] {
  return PROVIDERS.filter((provider) => provider.group === group);
}

export function providerById(id: ProviderId): Provider {
  const provider = PROVIDERS.find((entry) => entry.id === id);
  if (!provider) {
    throw new Error(`Unknown provider: ${id}`);
  }
  return provider;
}

/**
 * Optional Strava display sync — do not build as the history warehouse.
 * See activity-source.ts. isIntelligenceSource('strava') is false.
 */
export const STRAVA_DISPLAY_ONLY = true;

export type Connection = {
  provider: ProviderId;
  connectedAt: string;
  lastSyncAt: string | null;
};

export type UploadedOriginal = {
  name: string;
  size: number;
  addedAt: string;
};

export type IntegrationState = {
  connections: Connection[];
  uploads: UploadedOriginal[];
};

const STORAGE_KEY = "potential.integrations";

function isBrowser() {
  return typeof window !== "undefined";
}

export function emptyIntegrationState(): IntegrationState {
  return { connections: [], uploads: [] };
}

export function readIntegrations(): IntegrationState {
  if (!isBrowser()) {
    return emptyIntegrationState();
  }
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return emptyIntegrationState();
    }
    const parsed = JSON.parse(raw) as IntegrationState;
    return {
      connections: Array.isArray(parsed.connections) ? parsed.connections : [],
      uploads: Array.isArray(parsed.uploads) ? parsed.uploads : [],
    };
  } catch {
    return emptyIntegrationState();
  }
}

export async function loadIntegrations(): Promise<IntegrationState> {
  const local = readIntegrations();
  if (!isBrowser()) {
    return local;
  }
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("integrations")
      .select("provider, status, created_at, last_sync_at")
      .eq("status", "connected");
    const connections: Connection[] = (data ?? []).map((row) => ({
      provider: row.provider as ProviderId,
      connectedAt: row.created_at,
      lastSyncAt: row.last_sync_at,
    }));
    return { connections, uploads: local.uploads };
  } catch {
    return local;
  }
}

function writeIntegrations(state: IntegrationState) {
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function isConnected(state: IntegrationState, id: ProviderId): boolean {
  return state.connections.some((connection) => connection.provider === id);
}

export function connectProvider(id: ProviderId): IntegrationState {
  const state = readIntegrations();
  if (isConnected(state, id)) {
    return state;
  }
  const next = {
    ...state,
    connections: [
      ...state.connections,
      { provider: id, connectedAt: new Date().toISOString(), lastSyncAt: null },
    ],
  };
  writeIntegrations(next);
  return next;
}

export async function disconnectIntegration(id: ProviderId) {
  const response = await fetch(`/api/integrations/${id}/disconnect`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error("Could not disconnect.");
  }
  disconnectProvider(id);
  return loadIntegrations();
}

export function disconnectProvider(id: ProviderId): IntegrationState {
  const state = readIntegrations();
  const next = {
    ...state,
    connections: state.connections.filter((connection) => connection.provider !== id),
  };
  writeIntegrations(next);
  return next;
}

export function addUploads(files: { name: string; size: number }[]): IntegrationState {
  const state = readIntegrations();
  const addedAt = new Date().toISOString();
  const next = {
    ...state,
    uploads: [
      ...state.uploads,
      ...files.map((file) => ({ name: file.name, size: file.size, addedAt })),
    ],
  };
  writeIntegrations(next);
  return next;
}

export function hasIntelligenceHistory(state: IntegrationState): boolean {
  if (state.uploads.length > 0) {
    return true;
  }
  return state.connections.some((connection) => {
    const provider = PROVIDERS.find((entry) => entry.id === connection.provider);
    return provider?.intelligence && isIntelligenceSource(connection.provider);
  });
}
