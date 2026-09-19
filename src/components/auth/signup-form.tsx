"use client";

import { Field, inputClassName } from "@/components/auth/field";
import { UnitsChoice } from "@/components/app/units-choice";
import {
  postAuthPath,
  signUp,
  validateDisplayName,
  validateEmail,
  validatePassword,
} from "@/lib/auth";
import type { Units } from "@/lib/units";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [units, setUnits] = useState<Units>("imperial");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    const nameError = validateDisplayName(displayName);
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    if (nameError) {
      nextErrors.displayName = nameError;
    }
    if (emailError) {
      nextErrors.email = emailError;
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
    const result = await signUp({ email, password, displayName, units });
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

  return (
    <div>
      <h1 className="title text-ink">
        Create your account
      </h1>
      <p className="lede mt-3">
        Then a few questions Ahead cannot learn from your files.
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
        <Field label="Email" htmlFor="email" error={fieldErrors.email}>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            aria-invalid={Boolean(fieldErrors.email)}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClassName}
          />
        </Field>
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
          {submitting ? "Creating…" : "Create account"}
        </button>
      </form>

      <p className="mt-8 text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-ink underline-offset-2 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
