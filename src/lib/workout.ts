/**
 * Planned session on Potential’s calendar.
 *
 * Device integrations do not consume this. Completed work arrives as
 * PotentialActivity via importers. The assistant still creates and
 * moves Potential workouts on the Potential calendar — it does not
 * push them to Garmin, COROS, or Amazfit.
 */

export const WORKOUT_VERSION = 1;

export const WORKOUT_SPORTS = [
  { id: "run", label: "Run" },
  { id: "ride", label: "Ride" },
  { id: "swim", label: "Swim" },
  { id: "triathlon", label: "Triathlon" },
  { id: "strength", label: "Strength" },
  { id: "walk", label: "Walk" },
  { id: "row", label: "Row" },
  { id: "ski", label: "Ski" },
  { id: "other", label: "Other" },
] as const;

export type WorkoutSport = (typeof WORKOUT_SPORTS)[number]["id"];

export function workoutSportLabel(sport: string) {
  return (
    WORKOUT_SPORTS.find((entry) => entry.id === sport)?.label ??
    (sport ? sport.charAt(0).toUpperCase() + sport.slice(1) : "Other")
  );
}
export type CalendarCreatedBy = "athlete" | "potential_ai";

export type WorkoutBlock = {
  name: string;
  detail: string;
};

export type SessionWorkout = {
  version: typeof WORKOUT_VERSION;
  blocks: WorkoutBlock[];
  intensity: string | null;
  purpose: string | null;
};

export function parseSessionWorkout(value: unknown): SessionWorkout | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const row = value as Record<string, unknown>;
  const rawBlocks = Array.isArray(row.blocks)
    ? row.blocks
    : Array.isArray(row.structure)
      ? row.structure
      : [];
  const blocks: WorkoutBlock[] = [];
  for (const item of rawBlocks) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const block = item as Record<string, unknown>;
    const name = typeof block.name === "string" ? block.name.trim() : "";
    const detail =
      typeof block.detail === "string"
        ? block.detail.trim()
        : typeof block.text === "string"
          ? block.text.trim()
          : "";
    if (name || detail) {
      blocks.push({ name: name || "Set", detail });
    }
  }
  if (blocks.length === 0) {
    return null;
  }
  return {
    version: WORKOUT_VERSION,
    blocks,
    intensity: typeof row.intensity === "string" && row.intensity.trim() ? row.intensity.trim() : null,
    purpose: typeof row.purpose === "string" && row.purpose.trim() ? row.purpose.trim() : null,
  };
}

export type WorkoutIntensity =
  | { kind: "easy" }
  | { kind: "open" }
  | { kind: "rpe"; min: number; max?: number }
  | { kind: "hr"; min?: number; max?: number; zone?: number }
  | { kind: "power"; min?: number; max?: number; percentFtp?: [number, number] }
  | { kind: "pace"; secondsPerKm?: { min?: number; max?: number } };

export type WorkoutDuration =
  | { kind: "time"; seconds: number }
  | { kind: "distance"; meters: number };

export type WorkoutStep =
  | {
      type: "step";
      name?: string;
      duration: WorkoutDuration;
      intensity: WorkoutIntensity;
      notes?: string;
    }
  | {
      type: "repeat";
      count: number;
      steps: WorkoutStep[];
    };

export type PotentialWorkout = {
  version: typeof WORKOUT_VERSION;
  title: string;
  sport: WorkoutSport;
  description?: string;
  steps: WorkoutStep[];
};

export const THRESHOLD_5X5: PotentialWorkout = {
  version: WORKOUT_VERSION,
  title: "Threshold 5×5",
  sport: "run",
  description: "Classic threshold repeats on Ahead’s calendar.",
  steps: [
    {
      type: "step",
      name: "Warmup",
      duration: { kind: "time", seconds: 600 },
      intensity: { kind: "easy" },
    },
    {
      type: "repeat",
      count: 5,
      steps: [
        {
          type: "step",
          name: "Work",
          duration: { kind: "time", seconds: 300 },
          intensity: { kind: "hr", min: 170, max: 180 },
        },
        {
          type: "step",
          name: "Recovery",
          duration: { kind: "time", seconds: 120 },
          intensity: { kind: "easy" },
        },
      ],
    },
    {
      type: "step",
      name: "Cooldown",
      duration: { kind: "time", seconds: 600 },
      intensity: { kind: "easy" },
    },
  ],
};

export type CalendarMutation =
  | { op: "delete"; sessionId: string }
  | { op: "create"; date: string; workout: PotentialWorkout }
  | { op: "move"; sessionId: string; toDate: string }
  | { op: "replace"; sessionId: string; workout: PotentialWorkout };

export type CalendarDiff = {
  summary: string;
  mutations: CalendarMutation[];
};

export function serializeWorkout(workout: PotentialWorkout): string {
  return `${JSON.stringify(workout, null, 2)}\n`;
}

export function workoutFileName(workout: PotentialWorkout): string {
  return `${workout.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.json`;
}
