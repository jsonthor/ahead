"use client";

import { Field, inputClassName } from "@/components/auth/field";
import type { ZoneSaveProgress, ZoneSnapshot } from "@/lib/hr-model/profile";
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useRef, useState, type FormEvent } from "react";

const MS_PER_SESSION = 220;

function sourceLabel(source: string | null, kind: "max" | "threshold") {
  if (source === "manual") {
    return "You set this";
  }
  if (source === "observed") {
    return kind === "max"
      ? "Estimated from your hardest efforts"
      : "Estimated from sustained hard efforts";
  }
  if (source === "provider_profile") {
    return "From a device profile";
  }
  return "Ahead does not have this yet";
}

function asInput(value: number | null) {
  return value == null ? "" : String(value);
}

function formatDuration(seconds: number) {
  if (seconds < 20) {
    return "a few seconds";
  }
  if (seconds < 50) {
    return "about half a minute";
  }
  if (seconds < 100) {
    return "about a minute";
  }
  return `about ${Math.ceil(seconds / 60)} minutes`;
}

function estimateSeconds(sessionCount: number) {
  return Math.max(8, Math.round((sessionCount * MS_PER_SESSION) / 1000));
}

function BusySpinner() {
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

async function readSaveProgress(
  response: Response,
  onProgress: (progress: ZoneSaveProgress) => void,
) {
  if (!response.body) {
    throw new Error("No progress stream.");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let last: ZoneSaveProgress | null = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }
      const parsed = JSON.parse(line) as ZoneSaveProgress;
      last = parsed;
      onProgress(parsed);
    }
  }
  if (buffer.trim()) {
    const parsed = JSON.parse(buffer) as ZoneSaveProgress;
    last = parsed;
    onProgress(parsed);
  }
  return last;
}

export function ZonesForm() {
  const [snapshot, setSnapshot] = useState<ZoneSnapshot | null>(null);
  const [hrMax, setHrMax] = useState("");
  const [cyclingLthr, setCyclingLthr] = useState("");
  const [runningLthr, setRunningLthr] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [modal, setModal] = useState<"closed" | "working" | "done">("closed");
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    void fetch("/api/hr-model")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: ZoneSnapshot | null) => {
        if (!data) {
          return;
        }
        setSnapshot(data);
        setHrMax(asInput(data.applied.hrMax));
        setCyclingLthr(asInput(data.applied.cyclingLthr));
        setRunningLthr(asInput(data.applied.runningLthr));
      })
      .catch(() => {
        setError("Could not load zones.");
      });
  }, []);

  useEffect(() => {
    if (!saving) {
      return;
    }
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saving]);

  function applySnapshot(data: ZoneSnapshot) {
    setSnapshot(data);
    setHrMax(asInput(data.applied.hrMax));
    setCyclingLthr(asInput(data.applied.cyclingLthr));
    setRunningLthr(asInput(data.applied.runningLthr));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const sessions = snapshot?.sessionCount ?? 0;
    setSaving(true);
    setSaved(false);
    setError(null);
    setModal("working");
    setProgress({ processed: 0, total: sessions });
    startedAt.current = Date.now();
    setStatus(
      sessions > 0
        ? `Recalculating intensity on ${sessions} sessions. This usually takes ${formatDuration(estimateSeconds(sessions))}.`
        : "Saving your zones…",
    );
    try {
      const response = await fetch("/api/hr-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hrMax: hrMax.trim() === "" ? null : Number(hrMax),
          cyclingLthr: cyclingLthr.trim() === "" ? null : Number(cyclingLthr),
          runningLthr: runningLthr.trim() === "" ? null : Number(runningLthr),
        }),
      });
      if (response.status === 401) {
        throw new Error("Sign in again to save zones.");
      }
      const last = await readSaveProgress(response, (update) => {
        if (update.total > 0) {
          setProgress({ processed: update.processed, total: update.total });
        }
        if (update.phase === "sessions" && update.total > 0 && startedAt.current) {
          const elapsed = (Date.now() - startedAt.current) / 1000;
          const rate = update.processed / Math.max(elapsed, 1);
          const remaining = (update.total - update.processed) / Math.max(rate, 0.2);
          setStatus(`${update.message} ${formatDuration(remaining)} left.`);
          return;
        }
        setStatus(update.message);
        if (update.snapshot) {
          applySnapshot(update.snapshot);
        }
      });
      if (!last || last.phase === "error") {
        throw new Error(last?.error || last?.message || "Could not save zones.");
      }
      if (last.snapshot) {
        applySnapshot(last.snapshot);
      }
      setSaved(true);
      setModal("done");
      setStatus(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save zones.");
      setStatus(null);
      setModal("closed");
    } finally {
      setSaving(false);
      startedAt.current = null;
    }
  }

  const estimate = snapshot?.estimated;
  const sessionCount = snapshot?.sessionCount ?? 0;

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      {error ? (
        <p
          className="rounded-sm border border-danger/40 bg-paper-raised px-3 py-2 text-sm text-danger"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <Field
        label="Maximum heart rate"
        htmlFor="hrMax"
        hint={
          snapshot
            ? [
                sourceLabel(snapshot.applied.hrMaxSource, "max"),
                estimate?.hrMax != null && estimate.hrMax !== snapshot.applied.hrMax
                  ? `Ahead currently estimates ${estimate.hrMax}`
                  : null,
              ]
                .filter(Boolean)
                .join(". ")
            : undefined
        }
      >
        <input
          id="hrMax"
          name="hrMax"
          type="number"
          min={140}
          max={220}
          inputMode="numeric"
          disabled={saving}
          value={hrMax}
          onChange={(event) => {
            setHrMax(event.target.value);
            setSaved(false);
          }}
          className={inputClassName}
        />
      </Field>
      <Field
        label="Cycling threshold"
        htmlFor="cyclingLthr"
        hint={
          snapshot
            ? [
                sourceLabel(snapshot.applied.cyclingSource, "threshold"),
                estimate?.cyclingLthr != null &&
                estimate.cyclingLthr !== snapshot.applied.cyclingLthr
                  ? `Ahead currently estimates ${estimate.cyclingLthr}`
                  : null,
              ]
                .filter(Boolean)
                .join(". ")
            : "Leave blank to use Ahead’s estimate, or % HRmax if there isn’t one."
        }
      >
        <input
          id="cyclingLthr"
          name="cyclingLthr"
          type="number"
          min={140}
          max={210}
          inputMode="numeric"
          disabled={saving}
          value={cyclingLthr}
          onChange={(event) => {
            setCyclingLthr(event.target.value);
            setSaved(false);
          }}
          className={inputClassName}
        />
      </Field>
      <Field
        label="Running threshold"
        htmlFor="runningLthr"
        hint={
          snapshot
            ? [
                sourceLabel(snapshot.applied.runningSource, "threshold"),
                estimate?.runningLthr != null &&
                estimate.runningLthr !== snapshot.applied.runningLthr
                  ? `Ahead currently estimates ${estimate.runningLthr}`
                  : null,
              ]
                .filter(Boolean)
                .join(". ")
            : "Leave blank if you do not have a running threshold."
        }
      >
        <input
          id="runningLthr"
          name="runningLthr"
          type="number"
          min={140}
          max={210}
          inputMode="numeric"
          disabled={saving}
          value={runningLthr}
          onChange={(event) => {
            setRunningLthr(event.target.value);
            setSaved(false);
          }}
          className={inputClassName}
        />
      </Field>
      {sessionCount > 0 && modal === "closed" ? (
        <p className="text-[13px] leading-5 text-muted">
          Saving rewrites intensity on {sessionCount} session
          {sessionCount === 1 ? "" : "s"} and then Fitness, Fatigue, Form, and
          Readiness. Stay on this page — that usually takes{" "}
          {formatDuration(estimateSeconds(sessionCount))}.
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          aria-busy={saving}
          className="home-cta inline-flex items-center gap-2 px-4 disabled:opacity-50"
        >
          {saving ? (
            <>
              <BusySpinner />
              Working
            </>
          ) : (
            "Save zones"
          )}
        </button>
        {saved && modal === "closed" ? (
          <p className="text-[13px] text-muted">
            Saved. Dashboard numbers now use these zones.
          </p>
        ) : null}
      </div>
      <ZoneSaveModal
        open={modal !== "closed"}
        done={modal === "done"}
        status={status}
        progress={progress}
        onDone={() => setModal("closed")}
      />
    </form>
  );
}

function ZoneSaveModal({
  open,
  done,
  status,
  progress,
  onDone,
}: {
  open: boolean;
  done: boolean;
  status: string | null;
  progress: { processed: number; total: number };
  onDone: () => void;
}) {
  const ratio =
    progress.total > 0
      ? Math.min(1, progress.processed / progress.total)
      : done
        ? 1
        : 0;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && done) {
          onDone();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/70" />
        <Dialog.Content
          onPointerDownOutside={(event) => {
            if (!done) {
              event.preventDefault();
            }
          }}
          onInteractOutside={(event) => {
            if (!done) {
              event.preventDefault();
            }
          }}
          onEscapeKeyDown={(event) => {
            if (!done) {
              event.preventDefault();
            }
          }}
          className="fixed top-1/2 left-1/2 z-[60] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 border border-line bg-paper-raised p-6 outline-none"
        >
          <Dialog.Title className="title text-[2rem] text-ink">
            {done ? "History updated" : "Updating history"}
          </Dialog.Title>
          <Dialog.Description className="mt-3 text-sm leading-6 text-ink-soft">
            {done
              ? "Session intensity, Fitness, Fatigue, Form, and Readiness have changed. Open the dashboard to see the new numbers."
              : "Stay here until this finishes. Ahead is rewriting session intensity, then Fitness, Fatigue, Form, and Readiness will change."}
          </Dialog.Description>
          {done ? null : (
            <div className="mt-5 space-y-3">
              <div className="flex items-center gap-2 text-sm text-ink" role="status" aria-live="polite">
                <BusySpinner />
                <span>{status ?? "Saving your zones…"}</span>
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-paper-sunken"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={progress.total || 100}
                aria-valuenow={progress.processed}
              >
                <div
                  className="h-full bg-ink transition-[width] duration-300"
                  style={{ width: `${Math.round(ratio * 100)}%` }}
                />
              </div>
            </div>
          )}
          {done ? (
            <div className="mt-6 flex justify-end">
              <Dialog.Close asChild>
                <button type="button" className="home-cta px-4">
                  Continue
                </button>
              </Dialog.Close>
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
