"use client";

import {
  RECOVERY_METRICS,
  recoverySourceLabel,
  withConnectedSources,
  type RecoveryMetric,
  type RecoverySourcePriority,
} from "@/lib/recovery/priority";
import { useEffect, useMemo, useState } from "react";

const METRIC_LABEL: Record<RecoveryMetric, string> = {
  sleep: "Sleep",
  hrv: "HRV",
  resting_hr: "Resting heart rate",
};

const EMPTY: RecoverySourcePriority = {
  sleep: [],
  hrv: [],
  resting_hr: [],
  pending: [],
};

export function RecoveryPriority({
  connectedProviders,
}: {
  connectedProviders: string[];
}) {
  const [priority, setPriority] = useState<RecoverySourcePriority>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [recasting, setRecasting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<string[]>([]);

  const connectedKey = connectedProviders.join("|");
  const connected = useMemo(
    () => (connectedKey ? connectedKey.split("|") : []),
    [connectedKey],
  );

  useEffect(() => {
    setPriority((current) => withConnectedSources(current, connected));
  }, [connected]);

  useEffect(() => {
    if (connected.length === 0) {
      return;
    }
    void fetch("/api/recovery/priority")
      .then((response) => response.json())
      .then((body: { connected?: string[]; priority?: RecoverySourcePriority }) => {
        const sources = body.connected?.length ? body.connected : connected;
        const next = withConnectedSources(body.priority ?? EMPTY, sources);
        setPriority(next);
        setPending(next.pending ?? []);
      })
      .catch((error) => {
        console.error("Recovery priority load failed", error);
      });
  }, [connected]);

  if (connected.length === 0) {
    return null;
  }

  function move(metric: RecoveryMetric, from: number, to: number) {
    setPriority((current) => {
      if (!current) {
        return current;
      }
      const list = [...current[metric]];
      if (to < 0 || to >= list.length) {
        return current;
      }
      const [item] = list.splice(from, 1);
      if (!item) {
        return current;
      }
      list.splice(to, 0, item);
      return { ...current, [metric]: list };
    });
  }

  async function save(recast: boolean) {
    const payload = withConnectedSources(priority, connected);
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/recovery/priority", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error("Could not save recovery sources.");
      }
      setPending([]);
      if (recast) {
        setRecasting(true);
        const recastResponse = await fetch("/api/recovery/priority", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recast: true }),
        });
        if (!recastResponse.ok) {
          throw new Error("Could not recalculate recovery history.");
        }
        const body = (await recastResponse.json()) as { days?: number };
        setMessage(`Recalculated ${body.days ?? 0} days with this priority.`);
      } else {
        setMessage("Saved. New days use this order. Past days stay as they were.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setSaving(false);
      setRecasting(false);
    }
  }

  return (
    <section className="mt-10">
      <p className="kicker">Recovery sources</p>
      <p className="mt-2 text-sm text-ink-soft">
        Ahead uses the first source in each list that has a value. It does not
        average them.
      </p>
      {pending.length > 0 ? (
        <div className="mt-4 border border-line bg-paper-sunken px-4 py-3 text-sm text-ink">
          <p className="font-medium">New recovery source detected</p>
          <p className="mt-1 text-ink-soft">
            {pending.map(recoverySourceLabel).join(", ")} can provide sleep, HRV
            and resting HR. It is currently last. Drag to change where it sits.
            Past days will not change unless you recalculate.
          </p>
        </div>
      ) : null}
      <div className="mt-5 grid gap-6 sm:grid-cols-3">
        {RECOVERY_METRICS.map((metric) => (
          <PriorityList
            key={metric}
            title={METRIC_LABEL[metric]}
            sources={priority[metric]}
            onMove={(from, to) => move(metric, from, to)}
          />
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save(false)}
          className="home-cta home-cta-sm disabled:opacity-60"
        >
          {saving && !recasting ? "Saving…" : "Save priority"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            const confirmed = window.confirm(
              "Recalculate all past recovery days with this order? Performance history that used overnight recovery may change.",
            );
            if (!confirmed) {
              return;
            }
            void save(true);
          }}
          className="inline-flex h-8 items-center rounded-sm border border-line px-3 text-[13px] text-ink hover:bg-paper-sunken disabled:opacity-60"
        >
          {recasting ? "Recalculating…" : "Recalculate recovery history"}
        </button>
      </div>
      {message ? <p className="mt-3 text-sm text-ink-soft">{message}</p> : null}
    </section>
  );
}

function PriorityList({
  title,
  sources,
  onMove,
}: {
  title: string;
  sources: string[];
  onMove: (from: number, to: number) => void;
}) {
  const [dragging, setDragging] = useState<number | null>(null);

  return (
    <div>
      <p className="text-sm font-medium text-ink">{title}</p>
      <ol className="mt-2 grid gap-1.5">
        {sources.map((source, index) => (
          <li
            key={`${title}-${source}`}
            draggable
            onDragStart={() => setDragging(index)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (dragging == null || dragging === index) {
                return;
              }
              onMove(dragging, index);
              setDragging(null);
            }}
            onDragEnd={() => setDragging(null)}
            className={`flex items-center justify-between gap-2 rounded-sm border border-line bg-paper px-2 py-1.5 text-sm text-ink ${
              dragging === index ? "opacity-50" : ""
            }`}
          >
            <span className="truncate">
              <span className="mr-2 text-muted" aria-hidden>
                ☰
              </span>
              {index + 1}. {recoverySourceLabel(source)}
            </span>
            <span className="flex shrink-0 gap-1">
              <button
                type="button"
                aria-label={`Move ${recoverySourceLabel(source)} up`}
                disabled={index === 0}
                onClick={() => onMove(index, index - 1)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-ink-soft hover:bg-paper-sunken hover:text-ink disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`Move ${recoverySourceLabel(source)} down`}
                disabled={index === sources.length - 1}
                onClick={() => onMove(index, index + 1)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-ink-soft hover:bg-paper-sunken hover:text-ink disabled:opacity-30"
              >
                ↓
              </button>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
