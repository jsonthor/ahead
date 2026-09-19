const ADULT_FROM_YEARS = 18;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export type AthleteAge = {
  age_years: number;
  age_group: "youth" | "adult";
};

function dateKeyInZone(now: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function parseDateOfBirth(value: string) {
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

export function athleteAge(
  dateOfBirth: string | null | undefined,
  now = new Date(),
  timeZone = "UTC",
): AthleteAge | null {
  if (!dateOfBirth) {
    return null;
  }
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
  if (years < 0 || years > 120) {
    return null;
  }
  return {
    age_years: years,
    age_group: years < ADULT_FROM_YEARS ? "youth" : "adult",
  };
}
