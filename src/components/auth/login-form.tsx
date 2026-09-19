"use client";

import { Field, inputClassName } from "@/components/auth/field";
import {
  postAuthPath,
  signIn,
  validateEmail,
  validatePassword,
} from "@/lib/auth";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    if (emailError) {
      nextErrors.email = emailError;
    }
    if (passwordError) {
      nextErrors.password = passwordError;
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSubmitting(true);
    setFormError(null);
    const result = await signIn(email, password);
    setSubmitting(false);

    if (!result.ok) {
      setFormError(result.error.message);
      return;
    }

    const dest =
      nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")
        ? nextPath
        : postAuthPath(result.data.user);
    router.push(dest);
    router.refresh();
  }

  return (
    <div>
      <h1 className="title text-ink">
        Welcome back
      </h1>
      <p className="lede mt-3">
        Log in to your calendar.
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
        <Field label="Password" htmlFor="password" error={fieldErrors.password}>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
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
        <button
          type="submit"
          disabled={submitting}
          className="home-cta mt-2 w-full disabled:opacity-60"
        >
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </form>

      <p className="mt-8 text-sm text-muted">
        New here? Sign up is{" "}
        <Link
          href="/signup"
          className="text-ink underline-offset-2 hover:underline"
        >
          coming soon
        </Link>
        .
      </p>
    </div>
  );
}
