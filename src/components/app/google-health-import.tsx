"use client";

import { readImportProgress, type ImportProgress } from "@/lib/coros/progress";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const INITIAL: ImportProgress = {
  phase: "wellness",
  message: "Connecting to Google Health…",
  processed: 0,
  total: 0,
  saved: 0,
};

type SharedSync = {
  progress: ImportProgress;
  listeners: Set<(progress: ImportProgress) => void>;
  result: Promise<{ last: ImportProgress | null; failed: boolean; reauth: boolean }>;
};

let shared: SharedSync | null = null;

function publish(next: ImportProgress) {
  if (!shared) {
    return;
  }
  shared.progress = next;
  for (const listener of shared.listeners) {
    listener(next);
  }
}

function startSharedSync() {
  if (shared) {
    return shared;
  }
  const listeners = new Set<(progress: ImportProgress) => void>();
  const result = (async () => {
    try {
      const response = await fetch("/api/integrations/google_health/sync", {
        method: "POST",
      });
      if (response.status === 401) {
        publish({
          phase: "error",
          message: "Sign in again, then connect Google Health from Connect.",
          processed: 0,
          total: 0,
          saved: 0,
        });
        return { last: null, failed: true, reauth: false };
      }
      const last = await readImportProgress(response, publish);
      if (!last || last.phase === "error") {
        if (last?.reauth) {
          publish({
            phase: "error",
            message: "Google Health needs permission again.",
            processed: 0,
            total: 0,
            saved: 0,
            reauth: true,
          });
        }
        return { last, failed: true, reauth: Boolean(last?.reauth) };
      }
      if (last.phase !== "done") {
        return { last, failed: true, reauth: false };
      }
      return { last, failed: false, reauth: false };
    } catch (error) {
      console.error(error);
      return { last: null, failed: true, reauth: false };
    }
  })();
  shared = { progress: INITIAL, listeners, result };
  return shared;
}

export function GoogleHealthImport({ returnPath }: { returnPath: string }) {
  const router = useRouter();
  const returnPathRef = useRef(returnPath);
  returnPathRef.current = returnPath;
  const [progress, setProgress] = useState<ImportProgress>(
    shared?.progress ?? INITIAL,
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const sync = startSharedSync();
    setProgress(sync.progress);
    sync.listeners.add(setProgress);
    void sync.result.then(({ last, failed: nextFailed }) => {
      if (nextFailed) {
        shared = null;
        setFailed(true);
        return;
      }
      if (!last) {
        setFailed(true);
        return;
      }
      shared = null;
      const dest = new URL(returnPathRef.current, window.location.origin);
      dest.searchParams.set("connected", "google_health");
      dest.searchParams.set("imported", String(last.saved));
      router.replace(`${dest.pathname}${dest.search}`);
    });
    return () => {
      sync.listeners.delete(setProgress);
    };
  }, [router]);

  return (
    <main className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-4 py-16 sm:px-6">
      <p className="kicker">Google Health</p>
      <h1 className="title mt-3 text-ink">Importing overnight recovery</h1>
      <p className="lede mt-3">
        Sleep, HRV, and resting heart rate. Ahead is not importing workouts.
      </p>
      <p className="mt-8 text-sm text-ink-soft">{progress.message}</p>
      {failed ? (
        <div className="mt-6 grid gap-3">
          <p className="text-sm text-danger" role="alert">
            {progress.reauth
              ? "Google Health needs permission again. Go back to Connect and tap Google Health once."
              : "Recovery sync failed. Try Connect again from Integrations."}
          </p>
          <a href={`/app/connect`} className="home-cta home-cta-sm w-fit">
            Back to Connect
          </a>
        </div>
      ) : null}
    </main>
  );
}
