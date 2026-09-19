"use client";

import { Field, inputClassName } from "@/components/auth/field";
import { useAppUser } from "@/components/app/app-shell";
import {
  loadRaceResult,
  saveRaceResult,
  setOpenRaceResult,
} from "@/lib/race-result/store";
import {
  formatRaceResult,
  RACE_FACTORS,
  RACE_FEELS,
  RACE_STATUSES,
  type RaceFactor,
  type RaceFeel,
  type RaceResult,
  type RaceStatus,
} from "@/lib/race-result/types";
import { useEffect, useState, type FormEvent } from "react";

const FEEL_LABEL: Record<RaceFeel, string> = {
  good: "Good",
  ok: "OK",
  hard: "Hard",
  rough: "Rough",
};

const FACTOR_LABEL: Record<RaceFactor, string> = {
  none: "None",
  crash: "Crash",
  mechanical: "Mechanical",
  weather: "Weather",
  illness: "Illness",
  other: "Other",
};

const STATUS_LABEL: Record<RaceStatus, string> = {
  completed: "Completed",
  dnf: "DNF",
  dns: "DNS",
};

export function RaceResultCard({
  activityId,
  calendarItemId,
}: {
  activityId: string;
  calendarItemId: string | null;
}) {
  const user = useAppUser();
  const [result, setResult] = useState<RaceResult | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [place, setPlace] = useState("");
  const [fieldSize, setFieldSize] = useState("");
  const [category, setCategory] = useState("");
  const [gap, setGap] = useState("");
  const [feel, setFeel] = useState<RaceFeel | null>(null);
  const [factor, setFactor] = useState<RaceFactor | null>("none");
  const [status, setStatus] = useState<RaceStatus>("completed");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadRaceResult({ activityId, calendarItemId }).then((next) => {
      if (cancelled) {
        return;
      }
      setResult(next);
      setOpenRaceResult(next);
      if (next) {
        applyResult(next);
        setEditing(false);
      } else {
        setEditing(true);
      }
    });
    return () => {
      cancelled = true;
      setOpenRaceResult(null);
    };
  }, [activityId, calendarItemId]);

  function applyResult(next: RaceResult) {
    setPlace(next.place != null ? String(next.place) : "");
    setFieldSize(next.fieldSize != null ? String(next.fieldSize) : "");
    setCategory(next.category ?? "");
    setGap(next.gap ?? "");
    setFeel(next.feel);
    setFactor(next.factor);
    setStatus(next.status);
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const next = await saveRaceResult(user.id, {
        activityId,
        calendarItemId,
        place: parseOptionalInt(place),
        fieldSize: parseOptionalInt(fieldSize),
        category: category.trim() || null,
        gap: gap.trim() || null,
        feel,
        factor,
        status,
      });
      setResult(next);
      setOpenRaceResult(next);
      setEditing(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the race result.");
    } finally {
      setSaving(false);
    }
  }

  if (result === undefined) {
    return null;
  }

  if (result && !editing) {
    const extras = [
      result.category,
      result.gap,
      result.feel ? `Felt ${FEEL_LABEL[result.feel].toLowerCase()}` : null,
      result.factor && result.factor !== "none"
        ? FACTOR_LABEL[result.factor]
        : result.factor === "none"
          ? "Nothing unusual"
          : null,
    ].filter(Boolean);

    return (
      <section className="border border-line bg-paper-raised px-5 py-5">
        <p className="kicker">Race result</p>
        <p className="mt-3 text-[1.65rem] leading-none tracking-[-0.04em] text-ink">
          {formatRaceResult(result)}
        </p>
        {extras.length > 0 ? (
          <p className="mt-3 text-[15px] leading-6 text-ink-soft">{extras.join(" · ")}</p>
        ) : null}
        <button
          type="button"
          className="mt-4 inline-flex h-10 items-center text-[0.9375rem] font-medium text-ink underline decoration-line decoration-2 underline-offset-6 hover:decoration-ink"
          onClick={() => setEditing(true)}
        >
          Edit result
        </button>
      </section>
    );
  }

  return (
    <section className="border border-line bg-paper-raised px-5 py-5">
      <p className="kicker">Race result</p>
      <h2 className="mt-3 text-[1.35rem] tracking-[-0.03em] text-ink">How did it go?</h2>
      <p className="mt-2 text-[14px] leading-6 text-ink-soft">
        The file has the ride. This is the result — about 30 seconds.
      </p>
      <form className="mt-5 grid gap-4" onSubmit={(event) => void handleSave(event)}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Where did you finish?" htmlFor="race-place">
            <input
              id="race-place"
              inputMode="numeric"
              value={place}
              onChange={(event) => setPlace(event.target.value)}
              className={inputClassName}
              placeholder="4"
            />
          </Field>
          <Field label="How many started?" htmlFor="race-field">
            <input
              id="race-field"
              inputMode="numeric"
              value={fieldSize}
              onChange={(event) => setFieldSize(event.target.value)}
              className={inputClassName}
              placeholder="38"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category" htmlFor="race-category">
            <input
              id="race-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className={inputClassName}
              placeholder="U12"
            />
          </Field>
          <Field label="Time / gap" htmlFor="race-gap">
            <input
              id="race-gap"
              value={gap}
              onChange={(event) => setGap(event.target.value)}
              className={inputClassName}
              placeholder="+0:17"
            />
          </Field>
        </div>
        <fieldset>
          <legend className="text-sm font-medium text-ink">How did it feel?</legend>
          <ChoiceRow
            value={feel}
            options={RACE_FEELS.map((id) => ({ id, label: FEEL_LABEL[id] }))}
            onChange={setFeel}
          />
        </fieldset>
        <fieldset>
          <legend className="text-sm font-medium text-ink">
            Anything affect the result?
          </legend>
          <ChoiceRow
            value={factor}
            options={RACE_FACTORS.map((id) => ({ id, label: FACTOR_LABEL[id] }))}
            onChange={setFactor}
          />
        </fieldset>
        <fieldset>
          <legend className="text-sm font-medium text-ink">Status</legend>
          <ChoiceRow
            value={status}
            options={RACE_STATUSES.map((id) => ({ id, label: STATUS_LABEL[id] }))}
            onChange={setStatus}
          />
        </fieldset>
        {error ? (
          <p className="text-[13px] text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="home-cta home-cta-sm disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save race result"}
          </button>
          {result ? (
            <button
              type="button"
              className="inline-flex h-8 items-center px-3 text-[13px] text-ink-soft hover:text-ink"
              onClick={() => {
                applyResult(result);
                setEditing(false);
              }}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}

function ChoiceRow<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T | null;
  options: { id: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={`rounded-sm border px-3 py-1.5 text-[13px] ${
              selected
                ? "border-ink bg-ink text-paper"
                : "border-white/25 bg-[#1c1c1c] text-ink hover:bg-[#242424]"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function parseOptionalInt(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const next = Number.parseInt(trimmed, 10);
  return Number.isFinite(next) && next > 0 ? next : null;
}
