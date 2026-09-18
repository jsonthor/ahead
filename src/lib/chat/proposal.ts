import {
  asCalendarImportance,
  asCalendarIntent,
  asCalendarSport,
  type CalendarImportance,
  type CalendarIntent,
} from "@/lib/calendar-event";
import type { WorkoutSport } from "@/lib/workout";

export type DiaryMutation =
  | {
      op: "create";
      date: string;
      sport: WorkoutSport;
      title: string;
      intent: CalendarIntent;
      importance: CalendarImportance | null;
      planned_seconds: number | null;
      planned_distance_m: number | null;
      notes: string | null;
    }
  | {
      op: "update";
      id: string;
      date?: string;
      sport?: WorkoutSport;
      title?: string;
      intent?: CalendarIntent;
      importance?: CalendarImportance | null;
      planned_seconds?: number | null;
      planned_distance_m?: number | null;
      notes?: string | null;
    }
  | { op: "delete"; id: string };

import { parseOperations, type CalendarOperation } from "@/lib/chat/operations";
import type { ProposalSnapshot } from "@/lib/chat/proposal-view";

export type CalendarProposal = {
  id?: string;
  status: "pending" | "applied" | "dismissed" | "undone";
  rationale: string;
  mutations: DiaryMutation[];
  operations: CalendarOperation[];
  snapshot: ProposalSnapshot[];
};

function asSport(value: unknown): WorkoutSport {
  return asCalendarSport(typeof value === "string" ? value : "other");
}

function asSeconds(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function asDistance(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function asDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  return value;
}

export function parseDiaryMutations(value: unknown): DiaryMutation[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const rows: DiaryMutation[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const row = item as Record<string, unknown>;
    if (row.op === "delete" && typeof row.id === "string") {
      rows.push({ op: "delete", id: row.id });
      continue;
    }
    if (row.op === "update" && typeof row.id === "string") {
      rows.push({
        op: "update",
        id: row.id,
        date: asDate(row.date) ?? undefined,
        sport: row.sport ? asSport(row.sport) : undefined,
        title: typeof row.title === "string" ? row.title : undefined,
        intent: row.intent ? asCalendarIntent(String(row.intent)) : undefined,
        importance:
          row.importance === null
            ? null
            : asCalendarImportance(typeof row.importance === "string" ? row.importance : null),
        planned_seconds:
          row.planned_seconds === undefined ? undefined : asSeconds(row.planned_seconds),
        planned_distance_m:
          row.planned_distance_m === undefined ? undefined : asDistance(row.planned_distance_m),
        notes: typeof row.notes === "string" ? row.notes : row.notes === null ? null : undefined,
      });
      continue;
    }
    if (row.op === "create") {
      const date = asDate(row.date);
      const title = typeof row.title === "string" ? row.title.trim() : "";
      if (!date || !title) {
        continue;
      }
      rows.push({
        op: "create",
        date,
        sport: asSport(row.sport),
        title,
        intent: asCalendarIntent(typeof row.intent === "string" ? row.intent : "training"),
        importance: asCalendarImportance(
          typeof row.importance === "string" ? row.importance : null,
        ),
        planned_seconds: asSeconds(row.planned_seconds),
        planned_distance_m: asDistance(row.planned_distance_m),
        notes: typeof row.notes === "string" && row.notes.trim() ? row.notes.trim() : null,
      });
    }
  }
  return rows;
}

export function parseProposal(value: unknown): CalendarProposal | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as Record<string, unknown>;
  const operations = parseOperations(row.operations);
  const mutations = parseDiaryMutations(row.mutations);
  if (operations.length === 0 && mutations.length === 0) {
    return null;
  }
  const status =
    row.status === "applied" ||
    row.status === "dismissed" ||
    row.status === "undone"
      ? row.status
      : "pending";
  const snapshot = Array.isArray(row.snapshot)
    ? (row.snapshot as ProposalSnapshot[])
    : [];
  return {
    id: typeof row.id === "string" ? row.id : undefined,
    status,
    rationale: typeof row.rationale === "string" ? row.rationale : "",
    mutations,
    operations,
    snapshot,
  };
}

export function mutationLabel(mutation: DiaryMutation) {
  if (mutation.op === "delete") {
    return `Remove ${mutation.id.slice(0, 8)}`;
  }
  if (mutation.op === "update") {
    return `Update ${mutation.title ?? mutation.id.slice(0, 8)}${mutation.date ? ` · ${mutation.date}` : ""}`;
  }
  const when = mutation.planned_seconds
    ? ` · ${Math.round(mutation.planned_seconds / 60)}m`
    : "";
  return `${mutation.date} · ${mutation.intent === "race" ? "Race" : mutation.sport} · ${mutation.title}${when}`;
}
