/**
 * Athlete-wide Fitness / Fatigue / Form from Potential training load.
 * Never feed vendor (COROS / Garmin / Polar) load into this model.
 *
 * Fitness − Fatigue = Form. Today's cards include today's completed load.
 */

export const FITNESS_TAU = 42;
export const FATIGUE_TAU = 7;
export const ESTABLISHING_DAYS = 42;
export const TRAINING_STATE_VERSION = "banister-42-7-v3";

export type TrainingStateStatus = "actual" | "forecast";

export type DailyTrainingState = {
  date: string;
  load: number;
  fitness: number;
  fatigue: number;
  form: number;
  status: TrainingStateStatus;
};

export function calculateTrainingState(
  days: { date: string; load: number }[],
  options?: {
    fitness?: number;
    fatigue?: number;
    status?: TrainingStateStatus;
  },
): DailyTrainingState[] {
  let fitness = options?.fitness ?? 0;
  let fatigue = options?.fatigue ?? 0;
  const status = options?.status ?? "actual";

  return days.map((day) => {
    fitness = fitness + (day.load - fitness) / FITNESS_TAU;
    fatigue = fatigue + (day.load - fatigue) / FATIGUE_TAU;
    return {
      date: day.date,
      load: day.load,
      fitness,
      fatigue,
      form: fitness - fatigue,
      status,
    };
  });
}

export function forecastTrainingState(
  lastActual: Pick<DailyTrainingState, "fitness" | "fatigue">,
  plannedDays: { date: string; load: number }[],
): DailyTrainingState[] {
  return calculateTrainingState(plannedDays, {
    fitness: lastActual.fitness,
    fatigue: lastActual.fatigue,
    status: "forecast",
  });
}

export function historyDays(historyStart: string | null, today: string) {
  if (!historyStart) {
    return 0;
  }
  const start = Date.parse(`${historyStart}T12:00:00.000Z`);
  const end = Date.parse(`${today}T12:00:00.000Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return 0;
  }
  return Math.floor((end - start) / 86_400_000) + 1;
}

export function isEstablishing(historyStart: string | null, today: string) {
  const days = historyDays(historyStart, today);
  return days > 0 && days < ESTABLISHING_DAYS;
}

export function formatTrainingMetric(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) {
    return "0.0";
  }
  const text = Math.abs(rounded).toFixed(1);
  return rounded < 0 ? `−${text}` : text;
}

/** Round so displayed Fitness − Fatigue always equals displayed Form. Must match SQL ai_displayed_daily_state. */
export function displayTrainingState(state: { fitness: number; fatigue: number }) {
  const fitness = Math.round(state.fitness * 10) / 10;
  const fatigue = Math.round(state.fatigue * 10) / 10;
  return {
    fitness,
    fatigue,
    form: Math.round((fitness - fatigue) * 10) / 10,
  };
}
