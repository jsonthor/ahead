"use client";

import { readImportProgress, type ImportProgress } from "@/lib/coros/progress";
import { safeReturnPath } from "@/lib/oauth";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const INITIAL: ImportProgress = {
  phase: "wellness",
  message: "Connecting to Google Health…",
  processed: 0,
  total: 0,
  saved: 0,
};

export function GoogleHealthImport() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnPath = safeReturnPath(searchParams.get("return") ?? "/app/connect");
  const [progress, setProgress] = useState<ImportProgress>(INITIAL);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const response = await fetch("/api/integrations/google_health/sync", {
          method: "POST",
        });
        if (response.status === 401) {
          window.location.href = `/api/integrations/google_health/start?return=${encodeURIComponent(returnPath)}`;
          return;
        }
        const last = await readImportProgress(response, (next) => {
          if (!cancelled) {
            setProgress(next);
          }
        });
        if (cancelled) {
          return;
        }
        if (!last || last.phase === "error") {
          if (last?.reauth) {
            window.location.href = `/api/integrations/google_health/start?return=${encodeURIComponent(returnPath)}`;
            return;
          }
          setFailed(true);
          return;
        }
        if (last.phase === "done") {
          const dest = new URL(returnPath, window.location.origin);
          dest.searchParams.set("connected", "google_health");
          dest.searchParams.set("imported", String(last.saved));
          router.replace(`${dest.pathname}${dest.search}`);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setFailed(true);
        }
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [returnPath, router]);

  return (
    <main className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-4 py-16 sm:px-6">
      <p className="kicker">Google Health</p>
      <h1 className="title mt-3 text-ink">Importing overnight recovery</h1>
      <p className="lede mt-3">
        Sleep, HRV, and resting heart rate. Ahead is not importing workouts.
      </p>
      <p className="mt-8 text-sm text-ink-soft">{progress.message}</p>
      {failed ? (
        <p className="mt-4 text-sm text-danger" role="alert">
          Recovery sync failed. Try Connect again from Integrations.
        </p>
      ) : null}
    </main>
  );
}
