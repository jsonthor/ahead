"use client";

import { notifyCalendarChanged } from "@/lib/calendar-event";
import {
  COROS_SYNC_STALE_MS,
  readImportProgress,
  type ImportProgress,
} from "@/lib/coros/progress";
import {
  isConnected,
  loadIntegrations,
  PROVIDERS,
  type Provider,
} from "@/lib/integrations";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const itemClassName =
  "flex cursor-pointer items-center rounded-sm px-2 py-2 text-sm text-ink outline-none data-[highlighted]:bg-paper-sunken data-[disabled]:cursor-default data-[disabled]:opacity-50";

type SyncState = {
  provider: string;
  status: "running" | "done" | "error";
  phase?: ImportProgress["phase"];
  message: string;
};

function SyncSpinner() {
  return (
    <svg
      className="size-4 shrink-0 motion-safe:animate-spin"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
    >
      <circle
        cx="8"
        cy="8"
        r="6"
        stroke="currentColor"
        strokeOpacity="0.22"
        strokeWidth="2"
      />
      <path
        d="M14 8a6 6 0 0 0-6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function headerStatus(sync: SyncState) {
  if (sync.status === "error") {
    return sync.message;
  }
  if (sync.status === "done") {
    return sync.message;
  }
  switch (sync.phase) {
    case "listing":
      return "Checking COROS";
    case "activities":
      return "Getting activities";
    case "fit":
      return "Saving sessions";
    case "wellness":
      return "Getting recovery";
    case "load":
      return "Updating load";
    default:
      return "Connecting";
  }
}

let autoSyncStarted = false;

function syncableFrom(state: Awaited<ReturnType<typeof loadIntegrations>>) {
  return PROVIDERS.filter(
    (provider) =>
      provider.kind === "oauth" &&
      provider.live &&
      isConnected(state, provider.id),
  );
}

function staleProviders(state: Awaited<ReturnType<typeof loadIntegrations>>) {
  const now = Date.now();
  return syncableFrom(state).filter((provider) => {
    const last = state.connections.find((row) => row.provider === provider.id)?.lastSyncAt;
    if (!last) {
      return true;
    }
    return now - Date.parse(last) >= COROS_SYNC_STALE_MS;
  });
}

export function SyncMenu() {
  const pathname = usePathname();
  const [sources, setSources] = useState<Provider[] | null>(null);
  const [sync, setSync] = useState<SyncState | null>(null);
  const clearDone = useRef<number | null>(null);

  useEffect(() => {
    void loadIntegrations().then((state) => {
      const next = syncableFrom(state);
      setSources(next);
      const due = staleProviders(state)[0];
      if (!due || autoSyncStarted) {
        return;
      }
      autoSyncStarted = true;
      void syncProvider(due);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (clearDone.current) {
        window.clearTimeout(clearDone.current);
      }
    };
  }, []);

  if (!sources?.length) {
    return null;
  }

  function startOAuth(provider: Provider) {
    window.location.href = `/api/integrations/${provider.id}/start?return=${encodeURIComponent(pathname)}`;
  }

  async function syncProvider(provider: Provider) {
    if (sync?.status === "running") {
      return;
    }
    if (clearDone.current) {
      window.clearTimeout(clearDone.current);
      clearDone.current = null;
    }
    setSync({
      provider: provider.id,
      status: "running",
      message: `Connecting to ${provider.name}…`,
    });
    try {
      const response = await fetch(`/api/integrations/${provider.id}/sync`, {
        method: "POST",
      });
      if (response.status === 401) {
        startOAuth(provider);
        return;
      }
      const last = await readImportProgress(response, (next) => {
        setSync({
          provider: provider.id,
          status: "running",
          phase: next.phase,
          message: next.message,
        });
      });
      if (last?.reauth) {
        startOAuth(provider);
        return;
      }
      if (!last || last.phase === "error") {
        setSync({
          provider: provider.id,
          status: "error",
          message: last?.message || `${provider.name} sync failed.`,
        });
        return;
      }
      notifyCalendarChanged();
      setSync({
        provider: provider.id,
        status: "done",
        message:
          last.saved > 0
            ? `${provider.name} synced · ${last.saved} saved`
            : `${provider.name} is up to date`,
      });
      clearDone.current = window.setTimeout(() => {
        setSync(null);
        clearDone.current = null;
      }, 4000);
    } catch {
      setSync({
        provider: provider.id,
        status: "error",
        message: `${provider.name} sync failed.`,
      });
    }
  }

  return (
    <div className="flex items-center gap-2">
      {sync && sync.status !== "running" ? (
        <p
          className={`hidden whitespace-nowrap text-[0.9375rem] font-medium sm:block ${
            sync.status === "error" ? "text-danger" : "text-ink"
          }`}
          role="status"
        >
          {headerStatus(sync)}
        </p>
      ) : null}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className="inline-flex h-[2.75rem] items-center gap-2 border border-line px-[1.15rem] text-[0.9375rem] font-medium text-ink hover:bg-paper-sunken"
            aria-label="Sync connected training"
            aria-busy={sync?.status === "running"}
          >
            {sync?.status === "running" ? (
              <>
                <SyncSpinner />
                {headerStatus(sync)}
              </>
            ) : (
              "Sync"
            )}
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={8}
            className="z-50 min-w-40 border border-line bg-paper-raised p-1 shadow-[0_16px_40px_rgba(0,0,0,0.4)]"
          >
            {sources.map((provider) => (
              <DropdownMenu.Item
                key={provider.id}
                className={itemClassName}
                disabled={sync?.status === "running"}
                onSelect={() => void syncProvider(provider)}
              >
                {sync?.status === "running" && sync.provider === provider.id ? (
                  <span className="flex items-center gap-2">
                    <SyncSpinner />
                    {headerStatus(sync)}
                  </span>
                ) : (
                  provider.name
                )}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}
