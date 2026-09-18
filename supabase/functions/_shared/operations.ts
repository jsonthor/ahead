export type WorkoutBlock = {
  name: string;
  detail: string;
};

export type SessionSpec = {
  sport: string;
  title: string;
  intent: "training" | "race";
  importance: "A" | "B" | "C" | null;
  durationMinutes: number | null;
  distanceM: number | null;
  expectedLoad: number | null;
  intensity: string | null;
  purpose: string | null;
  structure: WorkoutBlock[] | null;
  notes: string | null;
};

export type CalendarOperation =
  | { type: "create_session"; date: string; session: SessionSpec }
  | { type: "create_rest"; date: string }
  | {
      type: "create_race";
      date: string;
      title: string;
      sport: string;
      importance: "A" | "B" | "C" | null;
      durationMinutes: number | null;
    }
  | { type: "move_session"; sessionId: string; from?: string; to: string }
  | { type: "update_session"; sessionId: string; date?: string; session?: Partial<SessionSpec> }
  | { type: "delete_session"; sessionId: string };

export type ItemSnapshot = {
  id: string;
  date: string;
  title: string;
  sport?: string | null;
  intent?: string | null;
  importance?: string | null;
  planned_seconds?: number | null;
  planned_distance_m?: number | null;
  planned_load?: number | null;
  purpose?: string | null;
  notes?: string | null;
  workout?: unknown;
  created_by?: string | null;
  linked_activity_id?: string | null;
  updated_at: string;
};

export const SNAPSHOT_COLUMNS =
  "id, date, title, sport, intent, importance, planned_seconds, planned_distance_m, planned_load, purpose, notes, workout, created_by, linked_activity_id, updated_at";

const SPORTS = new Set([
  "run",
  "ride",
  "swim",
  "triathlon",
  "strength",
  "walk",
  "row",
  "ski",
  "other",
]);

function asSport(value: unknown) {
  return SPORTS.has(String(value)) ? String(value) : "other";
}

function asDate(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function asMinutes(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function asDistance(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function asLoad(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function asImportance(value: unknown): "A" | "B" | "C" | null {
  return value === "A" || value === "B" || value === "C" ? value : null;
}

function asIntent(value: unknown): "training" | "race" {
  return value === "race" ? "race" : "training";
}

function asText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function parseWorkoutBlocks(value: unknown): WorkoutBlock[] | null {
  const raw = Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as { blocks?: unknown }).blocks)
      ? (value as { blocks: unknown[] }).blocks
      : value && typeof value === "object" && Array.isArray((value as { structure?: unknown }).structure)
        ? (value as { structure: unknown[] }).structure
        : null;
  if (!raw) {
    return null;
  }
  const blocks: WorkoutBlock[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const row = item as Record<string, unknown>;
    const name = asText(row.name) ?? "";
    const detail =
      asText(row.detail) ??
      asText(row.text) ??
      (Array.isArray(row.lines)
        ? row.lines.filter((line): line is string => typeof line === "string").join("\n")
        : "");
    if (name || detail) {
      blocks.push({ name: name || "Set", detail });
    }
  }
  return blocks.length > 0 ? blocks : null;
}

export function workoutPayload(session: Pick<SessionSpec, "structure" | "intensity" | "purpose">) {
  if (!session.structure || session.structure.length === 0) {
    return null;
  }
  return {
    version: 1,
    blocks: session.structure,
    intensity: session.intensity,
    purpose: session.purpose,
  };
}

function sessionFrom(raw: Record<string, unknown>, fallbackTitle: string): SessionSpec {
  const nested = raw.session && typeof raw.session === "object"
    ? (raw.session as Record<string, unknown>)
    : raw;
  const kind = typeof nested.type === "string" ? nested.type : "";
  const title =
    (typeof nested.title === "string" && nested.title.trim()) ||
    (typeof raw.title === "string" && raw.title.trim()) ||
    kind ||
    fallbackTitle;
  const durationMinutes =
    asMinutes(nested.durationMinutes) ??
    asMinutes(nested.duration_minutes) ??
    (typeof nested.planned_seconds === "number" ? Math.round(nested.planned_seconds / 60) : null);
  return {
    sport: asSport(nested.sport ?? raw.sport),
    title,
    intent: asIntent(nested.intent ?? raw.intent),
    importance: asImportance(nested.importance ?? raw.importance),
    durationMinutes,
    distanceM: asDistance(nested.distanceM ?? nested.distance_m ?? nested.planned_distance_m),
    expectedLoad:
      asLoad(nested.expectedLoad) ??
      asLoad(nested.expected_load) ??
      asLoad(nested.planned_load),
    intensity: asText(nested.intensity) ?? asText(nested.target_intensity),
    purpose: asText(nested.purpose) ?? asText(nested.session_purpose),
    structure:
      parseWorkoutBlocks(nested.structure) ??
      parseWorkoutBlocks(nested.workout) ??
      parseWorkoutBlocks(nested.blocks),
    notes: typeof nested.notes === "string" ? nested.notes : typeof raw.notes === "string" ? raw.notes : null,
  };
}

function idOf(raw: Record<string, unknown>) {
  return typeof raw.sessionId === "string"
    ? raw.sessionId
    : typeof raw.session_id === "string"
      ? raw.session_id
      : typeof raw.id === "string"
        ? raw.id
        : "";
}

export function parseOperations(value: unknown): CalendarOperation[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const rows: CalendarOperation[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const raw = item as Record<string, unknown>;
    const kind = String(raw.type ?? raw.action ?? raw.op ?? "");
    if (kind === "delete_session" || kind === "delete") {
      const sessionId = idOf(raw);
      if (sessionId) {
        rows.push({ type: "delete_session", sessionId });
      }
      continue;
    }
    if (kind === "move_session" || kind === "move") {
      const sessionId = idOf(raw);
      const to = asDate(raw.to) ?? asDate(raw.date);
      if (sessionId && to) {
        rows.push({
          type: "move_session",
          sessionId,
          from: asDate(raw.from) ?? undefined,
          to,
        });
      }
      continue;
    }
    if (kind === "update_session" || kind === "update" || kind === "edit") {
      const sessionId = idOf(raw);
      if (sessionId) {
        rows.push({
          type: "update_session",
          sessionId,
          date: asDate(raw.date) ?? undefined,
          session: sessionFrom(raw, "Training"),
        });
      }
      continue;
    }
    if (kind === "create_rest" || kind === "rest") {
      const date = asDate(raw.date);
      if (date) {
        rows.push({ type: "create_rest", date });
      }
      continue;
    }
    if (kind === "create_race" || kind === "race") {
      const date = asDate(raw.date);
      const session = sessionFrom(raw, "Race");
      if (date) {
        rows.push({
          type: "create_race",
          date,
          title: session.title,
          sport: session.sport,
          importance: session.importance,
          durationMinutes: session.durationMinutes,
        });
      }
      continue;
    }
    if (kind === "create_session" || kind === "create") {
      const date = asDate(raw.date);
      if (date) {
        rows.push({ type: "create_session", date, session: sessionFrom(raw, "Training") });
      }
    }
  }
  return rows;
}

export function referencedSessionIds(operations: CalendarOperation[]) {
  const ids = new Set<string>();
  for (const op of operations) {
    if (op.type === "move_session" || op.type === "update_session" || op.type === "delete_session") {
      ids.add(op.sessionId);
    }
  }
  return [...ids];
}

export function secondsFrom(minutes: number | null | undefined) {
  return minutes && minutes > 0 ? minutes * 60 : null;
}

export function restorePayload(item: ItemSnapshot, athleteId: string) {
  return {
    id: item.id,
    athlete_id: athleteId,
    date: item.date,
    sport: item.sport ?? "other",
    title: item.title,
    intent: item.intent ?? "training",
    importance: item.importance ?? null,
    planned_seconds: item.planned_seconds ?? null,
    planned_distance_m: item.planned_distance_m ?? null,
    planned_load: item.planned_load ?? null,
    purpose: item.purpose ?? null,
    notes: item.notes ?? null,
    workout: item.workout ?? null,
    created_by: item.created_by === "potential_ai" ? "potential_ai" : "athlete",
    linked_activity_id: item.linked_activity_id ?? null,
  };
}
