"use client";

import { Field, inputClassName } from "@/components/auth/field";
import { UnitsChoice } from "@/components/app/units-choice";
import { useAppSession } from "@/components/app/app-shell";
import { athleteAge, validateDateOfBirth } from "@/lib/athlete-age";
import { saveProfile, validateDisplayName } from "@/lib/auth";
import { summarize } from "@/lib/onboarding";
import type { Units } from "@/lib/units";
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
  const [dateOfBirth, setDateOfBirth] = useState(user.dateOfBirth ?? "");
  const [nameError, setNameError] = useState<string | null>(null);
  const [dobError, setDobError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [savingDob, setSavingDob] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [dobSaved, setDobSaved] = useState(false);
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

  async function handleDobSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const error = validateDateOfBirth(dateOfBirth, new Date(), timezone);
    if (error) {
      setDobError(error);
      return;
    }
    setDobError(null);
    setSavingDob(true);
    const ok = await persist({ dateOfBirth });
    setSavingDob(false);
    if (ok) {
      setDobSaved(true);
    }
  }

  const age = athleteAge(dateOfBirth || user.dateOfBirth, new Date(), timezone);

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
        <h2 className="kicker">
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
        <h2 className="kicker">
          Athlete details
        </h2>
        <form className="mt-4 grid gap-4" onSubmit={handleDobSubmit}>
          <Field
            label="Date of birth"
            htmlFor="dateOfBirth"
            error={dobError ?? undefined}
            hint="We use age where it matters to interpreting training and recovery. Age is derived from this date."
          >
            <input
              id="dateOfBirth"
              name="dateOfBirth"
              type="date"
              autoComplete="bday"
              value={dateOfBirth}
              max={new Date().toISOString().slice(0, 10)}
              min="1900-01-01"
              aria-invalid={Boolean(dobError)}
              onChange={(event) => {
                setDateOfBirth(event.target.value);
                setDobSaved(false);
              }}
              className={inputClassName}
            />
          </Field>
          {age ? (
            <p className="text-[13px] text-muted">{age.age_years} years old</p>
          ) : null}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={savingDob || dateOfBirth === (user.dateOfBirth ?? "")}
              className="home-cta px-4 disabled:opacity-50"
            >
              {savingDob ? "Saving…" : "Save date of birth"}
            </button>
            {dobSaved ? <p className="text-[13px] text-muted">Saved.</p> : null}
          </div>
        </form>
      </section>

      <section>
        <h2 className="kicker">
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
          <h2 className="kicker">
            Training
          </h2>
          <p className="mt-2 text-[13px] leading-5 text-muted">
            From the questions Ahead cannot learn from files.
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
    </div>
  );
}
