"use client";

import { readImportProgress, type ImportProgress } from "@/lib/coros/progress";
import { safeReturnPath } from "@/lib/oauth";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const INITIAL: ImportProgress = {
  phase: "listing",
  message: "Connecting to COROS…",
  processed: 0,
  total: 0,
  saved: 0,
};

export function CorosImport() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnPath = safeReturnPath(searchParams.get("return") ?? "/app");
  const [progress, setProgress] = useState<ImportProgress>(INITIAL);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const response = await fetch("/api/integrations/coros/sync", {
          method: "POST",
        });
        if (response.status === 401) {
          window.location.href = `/api/integrations/coros/start?return=${encodeURIComponent(returnPath)}`;
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
            window.location.href = `/api/integrations/coros/start?return=${encodeURIComponent(returnPath)}`;
            return;
          }
          setFailed(true);
          return;
        }
        if (last.phase === "done") {
          const dest = new URL(returnPath, window.location.origin);
          dest.searchParams.set("connected", "coros");
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

  const ratio =
    progress.total > 0 ? Math.min(1, progress.processed / progress.total) : 0;
  const percent = Math.round(ratio * 100);

  return (
    <main className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-4 py-16 sm:px-6">
      <p className="kicker">
        COROS
      </p>
      <h1 className="title mt-3 text-ink">
        Importing your training
      </h1>
      <p className="mt-4 text-[15px] leading-7 text-ink-soft">{progress.message}</p>

      <div className="mt-8">
        <div
          className="relative h-1.5 overflow-hidden rounded-full bg-paper-sunken"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={progress.total || 100}
          aria-valuenow={progress.total ? progress.processed : undefined}
          aria-label="Import progress"
        >
          {progress.total > 0 ? (
            <div
              className="h-full rounded-full bg-forest transition-[width] duration-300"
              style={{ width: `${percent}%` }}
            />
          ) : (
            <div className="absolute inset-y-0 w-1/3 rounded-full bg-forest potential-indeterminate" />
          )}
        </div>
        <p className="mt-3 text-[13px] text-muted">
          {progress.total > 0
            ? `${progress.processed} of ${progress.total} activities`
            : "This can take a minute for a long history."}
        </p>
      </div>

      {failed ? (
        <div className="mt-8">
          <p className="text-sm text-danger" role="alert">
            Import stopped before it finished. You can retry without losing
            activities already saved.
          </p>
          <button
            type="button"
            className="home-cta mt-4"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </div>
      ) : null}
    </main>
  );
}
