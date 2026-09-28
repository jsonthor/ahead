import { GOOGLE_DATA_TYPES } from "@/lib/google-health/types";
import {
  asObject,
  dateFilter,
  listDataPoints,
  sleepEndFilter,
} from "@/lib/google-health/client";
import type { RecoverySourcePayload } from "@/lib/recovery/source";
import { overnightSleepMinutes } from "@/lib/recovery";
import { addDaysToKey } from "@/lib/calendar";

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const next = Number(value);
    return Number.isFinite(next) ? next : null;
  }
  return null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function googleDate(value: unknown): string | null {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  const row = asObject(value);
  if (!row) {
    return null;
  }
  const year = asNumber(row.year);
  const month = asNumber(row.month);
  const day = asNumber(row.day);
  if (!year || !month || !day) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function intervalEndDate(sleep: Record<string, unknown>): string | null {
  const interval = asObject(sleep.interval);
  if (!interval) {
    return null;
  }
  const civil = asString(interval.civilEndTime) ?? asString(interval.civil_end_time);
  if (civil) {
    return civil.slice(0, 10);
  }
  const end = asString(interval.endTime) ?? asString(interval.end_time);
  if (!end) {
    return null;
  }
  return end.slice(0, 10);
}

function minutesBetween(start: string | null, end: string | null) {
  if (!start || !end) {
    return null;
  }
  const delta = Date.parse(end) - Date.parse(start);
  if (!Number.isFinite(delta) || delta <= 0) {
    return null;
  }
  return Math.round(delta / 60_000);
}

function stageMinutes(sleep: Record<string, unknown>) {
  const stages = Array.isArray(sleep.stages) ? sleep.stages : [];
  const totals = { deep: 0, rem: 0, light: 0, awake: 0 };
  for (const stage of stages) {
    const row = asObject(stage);
    if (!row) {
      continue;
    }
    const type = String(row.type ?? "").toUpperCase();
    const start = asString(row.startTime) ?? asString(row.start_time);
    const end = asString(row.endTime) ?? asString(row.end_time);
    const minutes = minutesBetween(start, end) ?? 0;
    if (type === "DEEP") {
      totals.deep += minutes;
    } else if (type === "REM") {
      totals.rem += minutes;
    } else if (type === "LIGHT" || type === "ASLEEP") {
      totals.light += minutes;
    } else if (type === "AWAKE" || type === "WAKE" || type === "RESTLESS") {
      totals.awake += minutes;
    }
  }
  return totals;
}

function mapSleep(point: Record<string, unknown>): {
  date: string;
  payload: RecoverySourcePayload;
} | null {
  const sleep = asObject(point.sleep);
  if (!sleep) {
    return null;
  }
  const metadata = asObject(sleep.metadata);
  if (metadata?.nap === true) {
    return null;
  }
  const date = intervalEndDate(sleep);
  if (!date) {
    return null;
  }
  const interval = asObject(sleep.interval);
  const startAt = asString(interval?.startTime) ?? asString(interval?.start_time);
  const endAt = asString(interval?.endTime) ?? asString(interval?.end_time);
  const summary = asObject(sleep.summary);
  const minutesAsleep = asNumber(summary?.minutesAsleep ?? summary?.minutes_asleep);
  const minutesAwake = asNumber(summary?.minutesAwake ?? summary?.minutes_awake);
  const timeInBed = asNumber(
    summary?.minutesInSleepPeriod ?? summary?.minutes_in_sleep_period,
  );
  const stages = stageMinutes(sleep);
  const duration =
    overnightSleepMinutes(minutesAsleep) ??
    overnightSleepMinutes(stages.deep + stages.rem + stages.light) ??
    overnightSleepMinutes(minutesBetween(startAt, endAt));
  if (!duration) {
    return null;
  }
  return {
    date,
    payload: {
      sleep: {
        startAt,
        endAt,
        durationMinutes: duration,
        timeInBedMinutes: timeInBed,
        awakeMinutes: minutesAwake ?? stages.awake,
        stages: {
          deepMinutes: stages.deep || null,
          remMinutes: stages.rem || null,
          lightMinutes: stages.light || null,
          awakeMinutes: stages.awake || null,
        },
      },
    },
  };
}

function merge(
  into: Map<string, RecoverySourcePayload>,
  date: string,
  patch: RecoverySourcePayload,
) {
  const current = into.get(date) ?? {};
  into.set(date, {
    ...current,
    ...patch,
    sleep: patch.sleep ?? current.sleep,
    sleepTemperature: patch.sleepTemperature ?? current.sleepTemperature,
  });
}

export async function fetchGoogleRecovery(
  athleteId: string,
  from: string,
  toExclusive: string,
  onProgress?: (message: string) => void,
) {
  const days = new Map<string, RecoverySourcePayload>();
  onProgress?.("Getting overnight sleep from Google Health…");
  const sleepPoints = await listDataPoints(
    athleteId,
    GOOGLE_DATA_TYPES.sleep,
    sleepEndFilter(from, toExclusive),
  );
  const mains = new Map<string, { duration: number; payload: RecoverySourcePayload }>();
  for (const point of sleepPoints) {
    const mapped = mapSleep(point);
    if (!mapped) {
      continue;
    }
    const duration = mapped.payload.sleep?.durationMinutes ?? 0;
    const previous = mains.get(mapped.date);
    if (!previous || duration > previous.duration) {
      mains.set(mapped.date, { duration, payload: mapped.payload });
    }
  }
  for (const [date, row] of mains) {
    merge(days, date, row.payload);
  }

  const vitals: Array<{
    type: string;
    filter: string;
    label: string;
    apply: (point: Record<string, unknown>) => RecoverySourcePayload | null;
  }> = [
    {
      type: GOOGLE_DATA_TYPES.hrv,
      filter: "daily_heart_rate_variability",
      label: "HRV",
      apply: (point) => {
        const row =
          asObject(point.dailyHeartRateVariability) ??
          asObject(point.daily_heart_rate_variability);
        const value = asNumber(
          row?.averageHeartRateVariabilityMilliseconds ??
            row?.average_heart_rate_variability_milliseconds,
        );
        return value != null ? { hrvRmssdMs: value } : null;
      },
    },
    {
      type: GOOGLE_DATA_TYPES.restingHr,
      filter: "daily_resting_heart_rate",
      label: "resting heart rate",
      apply: (point) => {
        const row =
          asObject(point.dailyRestingHeartRate) ?? asObject(point.daily_resting_heart_rate);
        const value = asNumber(row?.beatsPerMinute ?? row?.beats_per_minute);
        return value != null ? { restingHrBpm: value } : null;
      },
    },
    {
      type: GOOGLE_DATA_TYPES.respiratoryRate,
      filter: "daily_respiratory_rate",
      label: "respiratory rate",
      apply: (point) => {
        const row =
          asObject(point.dailyRespiratoryRate) ?? asObject(point.daily_respiratory_rate);
        const value = asNumber(row?.breathsPerMinute ?? row?.breaths_per_minute);
        return value != null ? { respiratoryRate: value } : null;
      },
    },
    {
      type: GOOGLE_DATA_TYPES.oxygenSaturation,
      filter: "daily_oxygen_saturation",
      label: "oxygen saturation",
      apply: (point) => {
        const row =
          asObject(point.dailyOxygenSaturation) ?? asObject(point.daily_oxygen_saturation);
        const value = asNumber(row?.averagePercentage ?? row?.average_percentage);
        return value != null ? { spo2Pct: value } : null;
      },
    },
    {
      type: GOOGLE_DATA_TYPES.sleepTemperature,
      filter: "daily_sleep_temperature_derivations",
      label: "sleep temperature",
      apply: (point) => {
        const row =
          asObject(point.dailySleepTemperatureDerivations) ??
          asObject(point.daily_sleep_temperature_derivations);
        const nightly = asNumber(
          row?.nightlyTemperatureCelsius ?? row?.nightly_temperature_celsius,
        );
        const baseline = asNumber(
          row?.baselineTemperatureCelsius ?? row?.baseline_temperature_celsius,
        );
        if (nightly == null) {
          return null;
        }
        return {
          sleepTemperature: {
            nightlyC: nightly,
            baselineC: baseline,
            deltaC: baseline != null ? nightly - baseline : null,
          },
        };
      },
    },
  ];

  for (const vital of vitals) {
    onProgress?.(`Getting ${vital.label} from Google Health…`);
    const points = await listDataPoints(
      athleteId,
      vital.type,
      dateFilter(vital.filter, from, toExclusive),
    );
    for (const point of points) {
      const body =
        asObject(point.dailyHeartRateVariability) ??
        asObject(point.daily_heart_rate_variability) ??
        asObject(point.dailyRestingHeartRate) ??
        asObject(point.daily_resting_heart_rate) ??
        asObject(point.dailyRespiratoryRate) ??
        asObject(point.daily_respiratory_rate) ??
        asObject(point.dailyOxygenSaturation) ??
        asObject(point.daily_oxygen_saturation) ??
        asObject(point.dailySleepTemperatureDerivations) ??
        asObject(point.daily_sleep_temperature_derivations) ??
        point;
      const date = googleDate(asObject(body)?.date) ?? googleDate(point.date);
      if (!date) {
        continue;
      }
      const patch = vital.apply(point);
      if (patch) {
        merge(days, date, patch);
      }
    }
  }

  return days;
}

export function recoveryWindow(today: string, lastSyncAt?: string | null) {
  const toExclusive = addDaysToKey(today, 1);
  if (lastSyncAt) {
    return { from: addDaysToKey(today, -3), toExclusive };
  }
  return { from: addDaysToKey(today, -90), toExclusive };
}
