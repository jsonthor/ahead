import { overnightSleepMinutes } from "@/lib/recovery";

export type WellnessRow = {
  date: string;
  resting_hr: number | null;
  sleep_minutes: number | null;
  sleep_hrv_ms: number | null;
  sleep_score: number | null;
  stress_avg: number | null;
  source: string | null;
};

export function presentWellnessFeed(rows: WellnessRow[]) {
  const days = rows.map((row) => ({
    date: row.date,
    restingHr: row.resting_hr,
    sleepHrvMs: row.sleep_hrv_ms,
    sleepMinutes: overnightSleepMinutes(row.sleep_minutes),
    sleepScore: row.sleep_score,
    stressAvg: row.stress_avg,
    source: row.source,
  }));
  const sleep = days.filter((day) => day.sleepMinutes != null).length;
  const hrv = days.filter((day) => day.sleepHrvMs != null).length;
  const restingHr = days.filter((day) => day.restingHr != null).length;
  const stress = days.filter((day) => day.stressAvg != null).length;
  const thin = days.length > 0 && hrv === 0 && restingHr === 0 && stress === 0;
  return {
    days,
    coverage: { days: days.length, sleep, hrv, restingHr, stress },
    ...(thin
      ? {
          note: "Recovery fields are missing from stored days. Do not invent sleep, HRV, resting HR, or stress. Lean on completed load and how the athlete feels.",
        }
      : {}),
  };
}
