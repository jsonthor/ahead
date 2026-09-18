"use client";

import { Field, inputClassName } from "@/components/auth/field";
import { UnitsChoice } from "@/components/app/units-choice";
import { useAppSession } from "@/components/app/app-shell";
import { saveProfile, validateDisplayName } from "@/lib/auth";
import { summarize } from "@/lib/onboarding";
import type { Units } from "@/lib/units";
import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";

function timeZones() {
  try {
    if (typeof Intl !== "undefined" && "supportedValuesOf" in Intl) {
      return Intl.supportedValuesOf("timeZone");
    }
  } catch {
    // fall through
  }
  return ["UTC", "Europe/London", "Europe/Paris", "America/New_York", "America/Los_Angeles"];
}

export function ProfileForm() {
  const { user, setUser } = useAppSession();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [units, setUnits] = useState<Units>(user.units);
  const [timezone, setTimezone] = useState(user.timezone);
  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const zones = useMemo(() => {
    const list = timeZones();
    if (timezone && !list.includes(timezone)) {
      return [timezone, ...list];
    }
    return list;
  }, [timezone]);

  const onboarding = user.onboarding ? summarize(user.onboarding) : null;

  async function persist(patch: Parameters<typeof saveProfile>[0]) {
    const result = await saveProfile(patch);
    if (!result.ok) {
      setFormError(result.error.message);
      return false;
    }
    setFormError(null);
    setUser(result.data.user);
    return true;
  }

  async function handleNameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const error = validateDisplayName(displayName);
    if (error) {
      setNameError(error);
      return;
    }
    setNameError(null);
    setSavingName(true);
    const ok = await persist({ displayName });
    setSavingName(false);
    if (ok) {
      setNameSaved(true);
    }
  }

  return (
    <div className="grid gap-12">
      {formError ? (
        <p
          className="rounded-sm border border-danger/40 bg-paper-raised px-3 py-2 text-sm text-danger"
          role="alert"
        >
          {formError}
        </p>
      ) : null}

      <section>
        <h2 className="text-[13px] font-medium tracking-[0.16em] text-muted uppercase">
          You
        </h2>
        <form className="mt-4 grid gap-4" onSubmit={handleNameSubmit}>
          <Field label="Name" htmlFor="displayName" error={nameError ?? undefined}>
            <input
              id="displayName"
              name="displayName"
              type="text"
              autoComplete="name"
              value={displayName}
              aria-invalid={Boolean(nameError)}
              onChange={(event) => {
                setDisplayName(event.target.value);
                setNameSaved(false);
              }}
              className={inputClassName}
            />
          </Field>
          <Field label="Email" htmlFor="email" hint="Used to sign in. Not shown to anyone else.">
            <input
              id="email"
              name="email"
              type="email"
              value={user.email}
              readOnly
              className={`${inputClassName} text-ink-soft`}
            />
          </Field>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={savingName || displayName.trim() === user.displayName}
              className="home-cta px-4 disabled:opacity-50"
            >
              {savingName ? "Saving…" : "Save name"}
            </button>
            {nameSaved ? <p className="text-[13px] text-muted">Saved.</p> : null}
          </div>
        </form>
      </section>

      <section>
        <h2 className="text-[13px] font-medium tracking-[0.16em] text-muted uppercase">
          Display
        </h2>
        <div className="mt-4 grid gap-5">
          <div className="grid gap-1.5">
            <p className="text-sm font-medium text-ink">Distances</p>
            <UnitsChoice
              value={units}
              onChange={(next) => {
                setUnits(next);
                void persist({ units: next });
              }}
            />
          </div>
          <Field label="Timezone" htmlFor="timezone" hint="Used for activity times and the calendar.">
            <select
              id="timezone"
              name="timezone"
              value={timezone}
              onChange={(event) => {
                const next = event.target.value;
                setTimezone(next);
                void persist({ timezone: next });
              }}
              className={inputClassName}
            >
              {zones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      {onboarding ? (
        <section>
          <h2 className="text-[13px] font-medium tracking-[0.16em] text-muted uppercase">
            Training
          </h2>
          <p className="mt-2 text-[13px] leading-5 text-muted">
            From the questions Potential cannot learn from files.
          </p>
          <dl className="mt-4 grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2">
            <div className="bg-paper-raised px-4 py-4">
              <dt className="text-[11px] tracking-wide text-muted uppercase">Sports</dt>
              <dd className="mt-1 text-sm text-ink">{onboarding.sport}</dd>
            </div>
            <div className="bg-paper-raised px-4 py-4">
              <dt className="text-[11px] tracking-wide text-muted uppercase">Season</dt>
              <dd className="mt-1 text-sm text-ink">{onboarding.season}</dd>
            </div>
            <div className="bg-paper-raised px-4 py-4">
              <dt className="text-[11px] tracking-wide text-muted uppercase">
                Priority races
              </dt>
              <dd className="mt-1 text-sm text-ink">
                {onboarding.raceCount === 0
                  ? "None marked yet"
                  : `${onboarding.raceCount} marked`}
              </dd>
            </div>
            <div className="bg-paper-raised px-4 py-4">
              <dt className="text-[11px] tracking-wide text-muted uppercase">Focus</dt>
              <dd className="mt-1 text-sm text-ink">{onboarding.focus}</dd>
            </div>
            <div className="bg-paper-raised px-4 py-4 sm:col-span-2">
              <dt className="text-[11px] tracking-wide text-muted uppercase">Available</dt>
              <dd className="mt-1 text-sm text-ink">
                {onboarding.availableDays.length > 0
                  ? onboarding.availableDays.join(" · ")
                  : "—"}
              </dd>
            </div>
            <div className="bg-paper-raised px-4 py-4 sm:col-span-2">
              <dt className="text-[11px] tracking-wide text-muted uppercase">
                Fixed sessions
              </dt>
              <dd className="mt-1 text-sm text-ink">
                {onboarding.sessions.length > 0
                  ? onboarding.sessions.join(" · ")
                  : "None"}
              </dd>
            </div>
          </dl>
        </section>
      ) : null}

      <section>
        <h2 className="text-[13px] font-medium tracking-[0.16em] text-muted uppercase">
          Connections
        </h2>
        <p className="mt-2 text-[15px] leading-6 text-ink-soft">
          COROS and file upload are live on Connect. Garmin and Polar are
          coming soon. Strava stays overlay-only when it arrives.
        </p>
        <Link
          href="/app/connect"
          className="mt-4 inline-flex h-10 items-center text-sm text-ink underline-offset-2 hover:underline"
        >
          Manage connections
        </Link>
      </section>
    </div>
  );
}
