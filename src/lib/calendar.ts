const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function utcNoon(key: string): Date {
  return new Date(`${key}T12:00:00.000Z`);
}

function formatUtcKey(key: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(
    utcNoon(key),
  );
}

export function dateKeyInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function weekdayIndexMonday(date: Date, timeZone: string): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(date);
  const index = WEEKDAYS.indexOf(weekday as (typeof WEEKDAYS)[number]);
  return index === -1 ? 0 : index;
}

export function addDaysToKey(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

export function mondayKeyInZone(date: Date, timeZone: string): string {
  const key = dateKeyInZone(date, timeZone);
  return addDaysToKey(key, -weekdayIndexMonday(date, timeZone));
}

export function weekKeys(mondayKey: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDaysToKey(mondayKey, index));
}

export function formatWeekRange(mondayKey: string): string {
  const endKey = addDaysToKey(mondayKey, 6);
  const start = formatUtcKey(mondayKey, { day: "numeric", month: "short" });
  const end = formatUtcKey(endKey, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const startMonth = formatUtcKey(mondayKey, { month: "short" });
  const endMonth = formatUtcKey(endKey, { month: "short" });
  if (startMonth === endMonth) {
    const startDay = formatUtcKey(mondayKey, { day: "numeric" });
    return `${startDay}–${end}`;
  }
  return `${start} – ${end}`;
}

export function weekdayIndexFromKey(key: string): number {
  return (utcNoon(key).getUTCDay() + 6) % 7;
}

export function monthKeyInZone(date: Date, timeZone: string): string {
  return dateKeyInZone(date, timeZone).slice(0, 7);
}

export function addMonthsToKey(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1 + delta, 1));
  return next.toISOString().slice(0, 7);
}

export function lastDayOfMonth(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const next = new Date(Date.UTC(year, month, 0));
  return next.toISOString().slice(0, 10);
}

export function monthQueryRange(monthKey: string): { from: string; to: string } {
  const keys = monthGridKeys(monthKey);
  const first = keys[0] ?? `${monthKey}-01`;
  const last = keys[keys.length - 1] ?? lastDayOfMonth(monthKey);
  return {
    from: `${addDaysToKey(first, -1)}T00:00:00.000Z`,
    to: `${addDaysToKey(last, 2)}T00:00:00.000Z`,
  };
}

export function monthGridKeys(monthKey: string): string[] {
  const first = `${monthKey}-01`;
  const start = addDaysToKey(first, -weekdayIndexFromKey(first));
  const last = lastDayOfMonth(monthKey);
  const end = addDaysToKey(last, 6 - weekdayIndexFromKey(last));
  const keys: string[] = [];
  let key = start;
  while (key <= end) {
    keys.push(key);
    key = addDaysToKey(key, 1);
  }
  return keys;
}

export function formatMonthTitle(monthKey: string): string {
  return formatUtcKey(`${monthKey}-01`, { month: "long", year: "numeric" });
}

export function isSameMonth(dayKey: string, monthKey: string): boolean {
  return dayKey.startsWith(monthKey);
}

export function formatDayNumber(key: string): string {
  return formatUtcKey(key, { day: "numeric" });
}

export function formatDayTitle(key: string): string {
  return formatUtcKey(key, { day: "numeric", month: "short", year: "numeric" });
}

export function formatDayShort(key: string): string {
  return formatUtcKey(key, { day: "numeric", month: "short" });
}

export function formatDayAxis(key: string): string {
  return formatUtcKey(key, { day: "numeric", month: "short", year: "2-digit" });
}

export function formatMonthShort(key: string): string {
  return formatUtcKey(key, { month: "short" });
}

export function isoWeekNumber(dayKey: string): number {
  const date = utcNoon(dayKey);
  const weekday = date.getUTCDay() || 7;
  const thursday = new Date(date);
  thursday.setUTCDate(date.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  return Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function weekdayLabel(key: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "UTC",
  }).format(utcNoon(key));
}

export function formatWeekdayDate(key: string): string {
  return `${weekdayLabel(key)} ${formatUtcKey(key, { day: "numeric", month: "short" })}`;
}

export function formatWeekdayDay(key: string): string {
  return `${weekdayLabel(key)} ${formatDayNumber(key)}`;
}

export function hourInZone(date: Date, timeZone: string): number {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "numeric",
    hourCycle: "h23",
  })
    .formatToParts(date)
    .find((part) => part.type === "hour")?.value;
  const value = Number(hour);
  return Number.isFinite(value) ? value : 12;
}

export function formatTimeInZone(iso: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

export function formatActivityWhen(iso: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
