"use client";

import { BRAND_MARKS } from "@/components/brands/marks";
import {
  disconnectIntegration,
  isConnected,
  loadIntegrations,
  providersIn,
  type Connection,
  type IntegrationState,
  type Provider,
} from "@/lib/integrations";
import { readImportProgress, type ImportProgress } from "@/lib/coros/progress";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const ACCEPT = ".fit,.gpx,.tcx,.zip,application/zip,application/octet-stream";

type Props = {
  onLeave?: () => void;
  returnTo?: string;
};

export function BrandConnect({ onLeave, returnTo = "/onboarding" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const searchParams = useSearchParams();
  const [state, setState] = useState<IntegrationState>(() => ({
    connections: [],
    uploads: [],
  }));
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadIntegrations().then(setState);
  }, [searchParams]);

  const primary = providersIn("primary");
  const optional = providersIn("optional");
  const later = providersIn("later");

  async function uploadFiles(fileList: File[]) {
    if (fileList.length === 0 || busy) {
      return;
    }
    setBusy(true);
    setProgress({
      phase: "listing",
      message: "Uploading files…",
      processed: 0,
      total: 0,
      saved: 0,
    });
    try {
      const body = new FormData();
      for (const file of fileList) {
        body.append("files", file);
      }
      const response = await fetch("/api/integrations/fit/upload", {
        method: "POST",
        body,
      });
      if (response.status === 401) {
        setProgress({
          phase: "error",
          message: "Sign in again to upload files.",
          processed: 0,
          total: 0,
          saved: 0,
        });
        return;
      }
      const last = await readImportProgress(response, setProgress);
      if (last?.phase === "done") {
        const next = await loadIntegrations();
        setState(next);
      }
    } catch (error) {
      console.error(error);
      setProgress({
        phase: "error",
        message: "Upload failed before it finished.",
        processed: 0,
        total: 0,
        saved: 0,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        {primary.map((provider) => (
          <BrandTile
            key={provider.id}
            provider={provider}
            state={state}
            returnTo={returnTo}
            onLeave={onLeave}
            busy={busy}
            onUpload={() => inputRef.current?.click()}
            onDisconnected={(next) => setState(next)}
          />
        ))}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        aria-label="Upload FIT, GPX, TCX, or zip files"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          void uploadFiles(files);
        }}
      />

      {progress ? (
        <div className="mt-6">
          <p className="text-sm text-ink-soft">{progress.message}</p>
          <div
            className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-paper-sunken"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={progress.total || 100}
            aria-valuenow={progress.total ? progress.processed : undefined}
            aria-label="Upload progress"
          >
            {progress.total > 0 ? (
              <div
                className="h-full rounded-full bg-forest transition-[width] duration-300"
                style={{
                  width: `${Math.round(
                    Math.min(1, progress.processed / progress.total) * 100,
                  )}%`,
                }}
              />
            ) : busy ? (
              <div className="absolute inset-y-0 w-1/3 rounded-full bg-forest potential-indeterminate" />
            ) : null}
          </div>
          {progress.phase === "error" ? (
            <p className="mt-3 text-sm text-danger" role="alert">
              {progress.message}
            </p>
          ) : null}
        </div>
      ) : null}

      {optional.length > 0 ? (
        <div className="mt-8">
          <p className="text-[13px] font-medium tracking-[0.16em] text-muted uppercase">
            Overlay only
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {optional.map((provider) => (
              <BrandTile
                key={provider.id}
                provider={provider}
                state={state}
                returnTo={returnTo}
                onLeave={onLeave}
                busy={busy}
                onDisconnected={(next) => setState(next)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {searchParams.get("error") === "coros" ? (
        <p className="mt-6 text-sm text-danger" role="alert">
          COROS didn’t connect. Try again from this page.
        </p>
      ) : null}

      <p className="mt-8 text-[13px] leading-5 text-muted">
        {later.map((provider) => provider.name).join(" · ")} later. Amazfit
        can arrive through Apple Health.
      </p>
    </div>
  );
}

function syncLabel(connection: Connection | undefined, file: boolean) {
  if (!connection?.lastSyncAt) {
    return file ? "Files uploaded" : "Connected";
  }
  const synced = new Date(connection.lastSyncAt);
  if (Number.isNaN(synced.getTime())) {
    return file ? "Files uploaded" : "Connected";
  }
  const when = synced.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  return file ? `Uploaded ${when}` : `Synced ${when}`;
}

function tileStatus(
  provider: Provider,
  connected: boolean,
  connection: Connection | undefined,
) {
  if (!provider.live) {
    return "Coming soon";
  }
  if (connected) {
    return syncLabel(connection, provider.kind === "file");
  }
  return provider.kind === "file" ? "Live — upload" : "Live — connect";
}

function BrandTile({
  provider,
  state,
  returnTo,
  onLeave,
  onUpload,
  onDisconnected,
  busy,
}: {
  provider: Provider;
  state: IntegrationState;
  returnTo: string;
  onLeave?: () => void;
  onUpload?: () => void;
  onDisconnected?: (state: IntegrationState) => void;
  busy: boolean;
}) {
  const Mark = BRAND_MARKS[provider.id];
  const file = provider.kind === "file";
  const connection = state.connections.find((row) => row.provider === provider.id);
  const connected = isConnected(state, provider.id);
  const available = provider.live;
  const href = `/api/integrations/${provider.id}/start?return=${encodeURIComponent(returnTo)}`;
  const syncHref = `/connect/${provider.id}?return=${encodeURIComponent(returnTo)}`;
  const className = `flex h-full min-h-[4.5rem] items-center gap-3 rounded-md border px-3 text-left ${
    !available
      ? "cursor-not-allowed border-line opacity-45"
      : connected
        ? "border-ink bg-paper-raised"
        : "border-line bg-paper hover:bg-paper-sunken"
  }`;

  const content = (
    <>
      <Mark />
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className="block truncate text-sm font-medium text-ink">
            {provider.name}
          </span>
          {available ? (
            <span className="shrink-0 rounded-sm bg-forest/10 px-1.5 py-0.5 text-[10px] font-medium tracking-[0.08em] text-forest uppercase">
              Live
            </span>
          ) : null}
        </span>
        <span className="block truncate text-[12px] text-muted">
          {tileStatus(provider, connected, connection)}
        </span>
      </span>
    </>
  );

  if (!available) {
    return (
      <div className={className} aria-disabled="true">
        {content}
      </div>
    );
  }

  if (file) {
    return (
      <button
        type="button"
        onClick={onUpload}
        disabled={busy}
        className={`${className} disabled:cursor-wait`}
      >
        {content}
      </button>
    );
  }

  if (connected) {
    return (
      <div className={`${className} flex-col items-stretch py-3`}>
        <div className="flex items-center gap-3">{content}</div>
        <div className="mt-3 flex gap-2">
          <a
            href={syncHref}
            onClick={onLeave}
            className="home-cta home-cta-sm h-8 px-3 text-[12px]"
          >
            Sync
          </a>
          <button
            type="button"
            className="inline-flex h-8 items-center justify-center rounded-sm border border-line px-3 text-[12px] font-medium text-ink hover:bg-paper-sunken"
            onClick={() => {
              const confirmed = window.confirm(
                `Disconnect ${provider.name}? Imported activities and recovery stay in Potential. You can reconnect later.`,
              );
              if (!confirmed) {
                return;
              }
              void disconnectIntegration(provider.id)
                .then((next) => onDisconnected?.(next))
                .catch(() => {
                  window.alert(`Could not disconnect ${provider.name}.`);
                });
            }}
          >
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  return (
    <a
      href={href}
      onClick={onLeave}
      className={className}
    >
      {content}
    </a>
  );
}
