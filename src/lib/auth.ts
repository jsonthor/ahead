/**
 * Auth boundary for the app.
 *
 * UI code should only call these functions. Email + password via
 * Supabase Auth; cookie session via `@supabase/ssr`.
 */

import { parseDateOfBirth, validateDateOfBirth } from "@/lib/athlete-age";
import { createClient } from "@/lib/supabase/client";
import {
  emptyAnswers,
  seedPriorityRaces,
  takeDateOfBirth,
  type OnboardingAnswers,
} from "@/lib/onboarding";
import { parseUnits, type Units } from "@/lib/units";
import type { EmailOtpType, User } from "@supabase/supabase-js";
import type { Json } from "@/lib/database.types";

export type SignUpInput = {
  email: string;
  password: string;
  displayName: string;
  units: Units;
};

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  timezone: string;
  units: Units;
  dateOfBirth: string | null;
  emailConfirmed: boolean;
  onboarding: OnboardingAnswers | null;
};

export type AuthError = {
  message: string;
  field?: "email" | "password" | "displayName";
};

export type AuthResult<T> = { ok: true; data: T } | { ok: false; error: AuthError };

function timezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function validateEmail(email: string): string | null {
  const value = email.trim();
  if (!value) {
    return "Enter your email.";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return "Enter a valid email address.";
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) {
    return "Enter a password.";
  }
  if (password.length < 8) {
    return "Use at least 8 characters.";
  }
  return null;
}

export function validateDisplayName(name: string): string | null {
  const value = name.trim();
  if (value.length < 2) {
    return "Name needs at least 2 characters.";
  }
  if (value.length > 40) {
    return "Keep it under 40 characters.";
  }
  return null;
}

function asOnboarding(value: Json | null): OnboardingAnswers | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as { version?: unknown; values?: unknown };
  if (typeof record.version !== "number" || !record.values || typeof record.values !== "object") {
    return null;
  }
  return value as OnboardingAnswers;
}

function mapError(message: string): AuthError {
  const lower = message.toLowerCase();
  if (lower.includes("already registered") || lower.includes("already exists")) {
    return {
      message: "An account with this email already exists. Log in instead.",
      field: "email",
    };
  }
  if (lower.includes("invalid login") || lower.includes("invalid email or password")) {
    return { message: "Invalid email or password." };
  }
  if (lower.includes("password")) {
    return { message, field: "password" };
  }
  return { message };
}

async function loadUser(user: User): Promise<AuthUser> {
  const supabase = createClient();
  const metadata = user.user_metadata ?? {};
  const fallbackName =
    (typeof metadata.display_name === "string" && metadata.display_name) ||
    (user.email ? user.email.split("@")[0] : "Athlete");
  const fallbackTimezone =
    (typeof metadata.timezone === "string" && metadata.timezone) || timezone();

  const fallbackUnits = parseUnits(metadata.units);

  let { data: profile } = await supabase
    .from("profiles")
    .select("display_name, timezone, units, date_of_birth, onboarding")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    await supabase.from("profiles").upsert({
      id: user.id,
      display_name: fallbackName,
      timezone: fallbackTimezone,
      units: fallbackUnits,
    });
    const retry = await supabase
      .from("profiles")
      .select("display_name, timezone, units, date_of_birth, onboarding")
      .eq("id", user.id)
      .maybeSingle();
    profile = retry.data;
  }

  return {
    id: user.id,
    email: user.email ?? "",
    displayName: profile?.display_name || fallbackName,
    timezone: profile?.timezone || fallbackTimezone,
    units: parseUnits(profile?.units ?? fallbackUnits),
    dateOfBirth: profile?.date_of_birth ?? null,
    emailConfirmed: Boolean(user.email_confirmed_at),
    onboarding: asOnboarding(profile?.onboarding ?? null),
  };
}

export async function signUp(
  input: SignUpInput,
): Promise<AuthResult<{ user: AuthUser }>> {
  const email = normalizeEmail(input.email);
  const emailError = validateEmail(email);
  if (emailError) {
    return { ok: false, error: { message: emailError, field: "email" } };
  }
  const passwordError = validatePassword(input.password);
  if (passwordError) {
    return { ok: false, error: { message: passwordError, field: "password" } };
  }
  const nameError = validateDisplayName(input.displayName);
  if (nameError) {
    return { ok: false, error: { message: nameError, field: "displayName" } };
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: {
      data: {
        display_name: input.displayName.trim(),
        timezone: timezone(),
        units: input.units,
      },
    },
  });

  if (error) {
    return { ok: false, error: mapError(error.message) };
  }
  if (!data.user || !data.session) {
    return {
      ok: false,
      error: {
        message: "Account created, but no session came back. Try logging in.",
      },
    };
  }

  await supabase
    .from("profiles")
    .update({ units: input.units })
    .eq("id", data.user.id);

  return { ok: true, data: { user: await loadUser(data.user) } };
}

function inviteFailed(): AuthResult<{ user: AuthUser }> {
  return {
    ok: false,
    error: { message: "This invite link is invalid or has expired." },
  };
}

export async function establishAuthFromUrl(): Promise<AuthResult<{ user: AuthUser }>> {
  const supabase = createClient();
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash") ?? hash.get("token_hash");
  const type = (url.searchParams.get("type") ?? hash.get("type")) as EmailOtpType | null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return inviteFailed();
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) {
      return inviteFailed();
    }
  } else {
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) {
        return inviteFailed();
      }
    }
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return inviteFailed();
  }
  return { ok: true, data: { user: await loadUser(data.user) } };
}

export async function acceptInvite(input: {
  password: string;
  displayName: string;
  units: Units;
}): Promise<AuthResult<{ user: AuthUser }>> {
  const nameError = validateDisplayName(input.displayName);
  if (nameError) {
    return { ok: false, error: { message: nameError, field: "displayName" } };
  }
  const passwordError = validatePassword(input.password);
  if (passwordError) {
    return { ok: false, error: { message: passwordError, field: "password" } };
  }

  const supabase = createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return inviteFailed();
  }

  const nextTimezone = timezone();
  const { error } = await supabase.auth.updateUser({
    password: input.password,
    data: {
      display_name: input.displayName.trim(),
      timezone: nextTimezone,
      units: input.units,
    },
  });
  if (error) {
    return { ok: false, error: mapError(error.message) };
  }

  await supabase.from("profiles").upsert({
    id: authData.user.id,
    display_name: input.displayName.trim(),
    timezone: nextTimezone,
    units: input.units,
  });

  return { ok: true, data: { user: await loadUser(authData.user) } };
}

export async function signIn(
  email: string,
  password: string,
): Promise<AuthResult<{ user: AuthUser }>> {
  const emailError = validateEmail(email);
  if (emailError) {
    return { ok: false, error: { message: emailError, field: "email" } };
  }
  const passwordError = validatePassword(password);
  if (passwordError) {
    return { ok: false, error: { message: passwordError, field: "password" } };
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizeEmail(email),
    password,
  });

  if (error || !data.user) {
    return {
      ok: false,
      error: mapError(error?.message ?? "Invalid email or password."),
    };
  }

  return { ok: true, data: { user: await loadUser(data.user) } };
}

export async function getSession(): Promise<AuthUser | null> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return null;
  }
  return loadUser(data.user);
}

export function needsOnboarding(user: AuthUser | null): boolean {
  return Boolean(user && !user.onboarding);
}

export type ProfilePatch = {
  displayName?: string;
  timezone?: string;
  units?: Units;
  dateOfBirth?: string | null;
};

function isTimezone(value: string) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export async function saveProfile(
  patch: ProfilePatch,
): Promise<AuthResult<{ user: AuthUser }>> {
  const supabase = createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return { ok: false, error: { message: "Sign in again to save this." } };
  }

  const current = await loadUser(authData.user);
  const displayName = patch.displayName ?? current.displayName;
  const nextTimezone = patch.timezone ?? current.timezone;
  const units = patch.units ?? current.units;
  let dateOfBirth = current.dateOfBirth;
  if (patch.dateOfBirth !== undefined) {
    if (patch.dateOfBirth === null || patch.dateOfBirth.trim() === "") {
      dateOfBirth = null;
    } else {
      const dobError = validateDateOfBirth(
        patch.dateOfBirth,
        new Date(),
        nextTimezone,
      );
      if (dobError) {
        return { ok: false, error: { message: dobError } };
      }
      dateOfBirth = parseDateOfBirth(patch.dateOfBirth);
    }
  }

  if (patch.displayName !== undefined) {
    const nameError = validateDisplayName(displayName);
    if (nameError) {
      return { ok: false, error: { message: nameError, field: "displayName" } };
    }
  }
  if (patch.timezone !== undefined && !isTimezone(nextTimezone)) {
    return { ok: false, error: { message: "Choose a valid timezone." } };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName.trim(),
      timezone: nextTimezone,
      units,
      date_of_birth: dateOfBirth,
    })
    .eq("id", authData.user.id);

  if (error) {
    return { ok: false, error: { message: error.message } };
  }

  await supabase.auth.updateUser({
    data: {
      display_name: displayName.trim(),
      timezone: nextTimezone,
      units,
    },
  });

  return { ok: true, data: { user: await loadUser(authData.user) } };
}

export async function saveOnboarding(
  answers: OnboardingAnswers,
): Promise<AuthResult<{ user: AuthUser }>> {
  const supabase = createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return { ok: false, error: { message: "Sign in again to save this." } };
  }

  const current = await loadUser(authData.user);
  const payload = answers.version ? answers : { ...emptyAnswers(), ...answers };
  const { dateOfBirth, answers: stored } = takeDateOfBirth(payload);
  if (!dateOfBirth) {
    return { ok: false, error: { message: "Enter your date of birth." } };
  }
  const dobError = validateDateOfBirth(
    dateOfBirth,
    new Date(),
    current.timezone,
  );
  if (dobError) {
    return { ok: false, error: { message: dobError } };
  }
  const { error } = await supabase.from("profiles").upsert({
    id: authData.user.id,
    display_name: current.displayName,
    timezone: current.timezone,
    units: current.units,
    date_of_birth: dateOfBirth,
    onboarding: stored as unknown as Json,
  });

  if (error) {
    return { ok: false, error: { message: error.message } };
  }

  try {
    await seedPriorityRaces(supabase, authData.user.id, payload);
  } catch (seedError) {
    console.error("Onboarding race seed failed", seedError);
  }

  return { ok: true, data: { user: await loadUser(authData.user) } };
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
}

export function postAuthPath(user: AuthUser): "/onboarding" | "/app" {
  return needsOnboarding(user) ? "/onboarding" : "/app";
}
