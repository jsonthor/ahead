/**
 * Date of birth is stored. Age is derived.
 *
 * Use age only where an explicit youth/adult rule exists.
 * Do not treat a missing DOB as an age, and do not send the
 * raw birthday to Ask Ahead.
 */

import { dateKeyInZone } from "@/lib/calendar";

export const ADULT_FROM_YEARS = 18;

export type AgeGroup = "youth" | "adult";

export type AthleteAge = {
  age_years: number;
  age_group: AgeGroup;
};

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDateOfBirth(value: string): string | null {
  const trimmed = value.trim();
  const match = DATE_RE.exec(trimmed);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null;
  }
  return trimmed;
}

export function ageYearsOn(
  dateOfBirth: string,
  now = new Date(),
  timeZone = "UTC",
): number | null {
  const parsed = parseDateOfBirth(dateOfBirth);
  if (!parsed) {
    return null;
  }
  const today = dateKeyInZone(now, timeZone);
  const [bornYear, bornMonth, bornDay] = parsed.split("-").map(Number);
  const [year, month, day] = today.split("-").map(Number);
  let years = year - bornYear;
  if (month < bornMonth || (month === bornMonth && day < bornDay)) {
    years -= 1;
  }
  return years;
}

export function ageGroupFor(years: number): AgeGroup {
  return years < ADULT_FROM_YEARS ? "youth" : "adult";
}

export function athleteAge(
  dateOfBirth: string | null | undefined,
  now = new Date(),
  timeZone = "UTC",
): AthleteAge | null {
  if (!dateOfBirth) {
    return null;
  }
  const years = ageYearsOn(dateOfBirth, now, timeZone);
  if (years == null || years < 0 || years > 120) {
    return null;
  }
  return {
    age_years: years,
    age_group: ageGroupFor(years),
  };
}

export function validateDateOfBirth(
  value: string,
  now = new Date(),
  timeZone = "UTC",
): string | null {
  if (!value.trim()) {
    return "Enter your date of birth.";
  }
  const parsed = parseDateOfBirth(value);
  if (!parsed) {
    return "Enter a real date.";
  }
  if (parsed > dateKeyInZone(now, timeZone)) {
    return "Date of birth cannot be in the future.";
  }
  if (parsed < "1900-01-01") {
    return "Enter a date from 1900 onward.";
  }
  const years = ageYearsOn(parsed, now, timeZone);
  if (years == null || years > 120) {
    return "Enter a realistic date of birth.";
  }
  return null;
}
