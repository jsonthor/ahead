import { formatWeekdayDate, formatWeekdayDay } from "@/lib/calendar";
import type { CalendarOperation } from "@/lib/chat/operations";

export type ProposalSnapshot = {
  id: string;
  date?: string;
  title?: string;
  planned_seconds?: number | null;
  planned_load?: number | null;
};

export type ProposedChange =
  | {
      kind: "create";
      date: string;
      title: string;
      durationMinutes: number | null;
      expectedLoad: number | null;
    }
  | {
      kind: "move";
      fromDate: string;
      toDate: string;
      title: string;
      durationMinutes: number | null;
    }
  | {
      kind: "delete";
      date: string;
      title: string;
    }
  | {
      kind: "update";
      date: string;
      title: string;
      durationMinutes: number | null;
      expectedLoad: number | null;
    };

function snapshotById(snapshot: ProposalSnapshot[]) {
  return new Map(snapshot.map((item) => [item.id, item]));
}

function minutesOf(seconds: number | null | undefined) {
  return seconds && seconds > 0 ? Math.round(seconds / 60) : null;
}

function sessionOf(op: CalendarOperation) {
  return op.session ?? null;
}

export function proposedChanges(
  operations: CalendarOperation[],
  snapshot: ProposalSnapshot[] = [],
): ProposedChange[] {
  const byId = snapshotById(snapshot);
  const changes: ProposedChange[] = [];
  for (const op of operations) {
    if (op.type === "create_session") {
      const session = sessionOf(op);
      changes.push({
        kind: "create",
        date: op.date ?? "",
        title: session?.title ?? "Training",
        durationMinutes: session?.durationMinutes ?? null,
        expectedLoad: session?.expectedLoad ?? null,
      });
      continue;
    }
    if (op.type === "create_rest") {
      changes.push({
        kind: "create",
        date: op.date ?? "",
        title: "Rest",
        durationMinutes: null,
        expectedLoad: null,
      });
      continue;
    }
    if (op.type === "create_race") {
      changes.push({
        kind: "create",
        date: op.date ?? "",
        title: op.title ?? "Race",
        durationMinutes: op.durationMinutes ?? op.session?.durationMinutes ?? null,
        expectedLoad: null,
      });
      continue;
    }
    if (op.type === "move_session") {
      const existing = op.sessionId ? byId.get(op.sessionId) : undefined;
      changes.push({
        kind: "move",
        fromDate: op.from ?? existing?.date ?? "",
        toDate: op.to ?? op.date ?? "",
        title: existing?.title ?? "Session",
        durationMinutes: minutesOf(existing?.planned_seconds),
      });
      continue;
    }
    if (op.type === "delete_session") {
      const existing = op.sessionId ? byId.get(op.sessionId) : undefined;
      changes.push({
        kind: "delete",
        date: existing?.date ?? "",
        title: existing?.title ?? "Session",
      });
      continue;
    }
    if (op.type === "update_session") {
      const existing = op.sessionId ? byId.get(op.sessionId) : undefined;
      const session = sessionOf(op);
      changes.push({
        kind: "update",
        date: op.date ?? existing?.date ?? "",
        title: session?.title ?? existing?.title ?? "Session",
        durationMinutes: session?.durationMinutes ?? minutesOf(existing?.planned_seconds),
        expectedLoad: session?.expectedLoad ?? existing?.planned_load ?? null,
      });
    }
  }
  return changes.filter((change) => {
    if (change.kind === "move") {
      return Boolean(change.toDate);
    }
    return Boolean(change.date);
  });
}

export function durationLabel(minutes: number | null | undefined) {
  if (!minutes || minutes <= 0) {
    return null;
  }
  return `${minutes} min`;
}

export function changeMeta(change: ProposedChange) {
  if (change.kind === "delete") {
    return null;
  }
  if (change.kind === "move") {
    return durationLabel(change.durationMinutes);
  }
  const parts = [
    durationLabel(change.durationMinutes),
    change.expectedLoad != null ? `Expected load ${change.expectedLoad}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function appliedSummary(changes: ProposedChange[]) {
  const creates = changes.filter((change) => change.kind === "create");
  const moves = changes.filter((change) => change.kind === "move");
  if (creates.length > 0 && creates.length === changes.length) {
    const noun = creates.length === 1 ? "session" : "sessions";
    return {
      headline: `${creates.length} ${noun} added to your calendar.`,
      dates: creates.map((change) => formatWeekdayDay(change.date)).join(" · "),
    };
  }
  if (moves.length === 1 && changes.length === 1) {
    const move = moves[0]!;
    return {
      headline: "1 session moved.",
      dates: `${formatWeekdayDay(move.fromDate)} → ${formatWeekdayDay(move.toDate)}`,
    };
  }
  const dates = [...new Set(changes.flatMap((change) => {
    if (change.kind === "move") {
      return [change.toDate];
    }
    return [change.date];
  }))];
  return {
    headline: "Calendar updated.",
    dates: dates.map(formatWeekdayDay).join(" · "),
  };
}

export function headingFor(change: ProposedChange) {
  if (change.kind === "move") {
    return formatWeekdayDate(change.toDate);
  }
  return formatWeekdayDate(change.date);
}
