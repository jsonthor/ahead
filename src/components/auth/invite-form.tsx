"use client";

import { Field, inputClassName } from "@/components/auth/field";
import { UnitsChoice } from "@/components/app/units-choice";
import {
  acceptInvite,
  establishAuthFromUrl,
  postAuthPath,
  validateDisplayName,
  validatePassword,
  type AuthUser,
} from "@/lib/auth";
import type { Units } from "@/lib/units";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

export function InviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [units, setUnits] = useState<Units>("metric");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    void establishAuthFromUrl().then((result) => {
      if (!active) {
        return;
      }
      setLoading(false);
      if (!result.ok) {
        setFormError(
          searchParams.get("error") === "expired"
            ? "This invite link is invalid or has expired."
            : result.error.message,
        );
        return;
      }
      if (result.data.user.onboarding) {
        router.replace(postAuthPath(result.data.user));
        return;
      }
      setUser(result.data.user);
      setDisplayName(result.data.user.displayName);
      setUnits(result.data.user.units);
    });
    return () => {
      active = false;
    };
  }, [router, searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    const nameError = validateDisplayName(displayName);
    const passwordError = validatePassword(password);
    if (nameError) {
      nextErrors.displayName = nameError;
    }
    if (passwordError) {
      nextErrors.password = passwordError;
    }
    if (password && confirm !== password) {
      nextErrors.confirm = "Passwords do not match.";
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSubmitting(true);
    setFormError(null);
    const result = await acceptInvite({ password, displayName, units });
    setSubmitting(false);

    if (!result.ok) {
      setFormError(result.error.message);
      if (result.error.field) {
        setFieldErrors({ [result.error.field]: result.error.message });
      }
      return;
    }

    router.push(postAuthPath(result.data.user));
    router.refresh();
  }

  if (loading) {
    return <p className="text-sm text-muted">Opening your invite…</p>;
  }

  if (!user) {
    return (
      <div>
        <h1 className="title text-ink">This invite has expired</h1>
        <p className="lede mt-3">
          {formError ?? "Ask to be invited again, then open the new email."}
        </p>
        <p className="mt-8">
          <Link href="/login" className="home-cta home-cta-sm">
            Log in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="kicker">Invite</p>
      <h1 className="title mt-3 text-ink">Create your account</h1>
      <p className="lede mt-3">
        Choose a password for {user.email}. Then a few questions Ahead cannot
        learn from your files.
      </p>

      {formError ? (
        <p
          className="mt-5 rounded-sm border border-danger/40 bg-paper-raised px-3 py-2 text-sm text-danger"
          role="alert"
        >
          {formError}
        </p>
      ) : null}

      <form className="mt-8 grid gap-4" onSubmit={handleSubmit}>
        <Field
          label="What should we call you?"
          htmlFor="displayName"
          error={fieldErrors.displayName}
        >
          <input
            id="displayName"
            name="displayName"
            type="text"
            autoComplete="name"
            value={displayName}
            aria-invalid={Boolean(fieldErrors.displayName)}
            onChange={(event) => setDisplayName(event.target.value)}
            className={inputClassName}
          />
        </Field>
        <fieldset>
          <legend className="text-sm font-medium text-ink">
            How should distances show?
          </legend>
          <div className="mt-1.5">
            <UnitsChoice value={units} onChange={setUnits} />
          </div>
        </fieldset>
        <Field
          label="Password"
          htmlFor="password"
          error={fieldErrors.password}
          hint="At least 8 characters."
        >
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              aria-invalid={Boolean(fieldErrors.password)}
              onChange={(event) => setPassword(event.target.value)}
              className={`${inputClassName} pr-16`}
            />
            <button
              type="button"
              className="absolute top-0 right-0 h-11 px-3 text-[13px] text-muted hover:text-ink"
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </Field>
        <Field
          label="Confirm password"
          htmlFor="confirm"
          error={fieldErrors.confirm}
        >
          <input
            id="confirm"
            name="confirm"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={confirm}
            aria-invalid={Boolean(fieldErrors.confirm)}
            onChange={(event) => setConfirm(event.target.value)}
            className={inputClassName}
          />
        </Field>
        <button
          type="submit"
          disabled={submitting}
          className="home-cta mt-2 w-full disabled:opacity-60"
        >
          {submitting ? "Saving…" : "Continue"}
        </button>
      </form>
    </div>
  );
}
