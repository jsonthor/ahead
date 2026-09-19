export type CalendarOperation = {
  type: string;
  date?: string;
  to?: string;
  from?: string;
  sessionId?: string;
  title?: string;
  durationMinutes?: number | null;
  session?: {
    title?: string;
    sport?: string;
    intent?: string;
    durationMinutes?: number | null;
    expectedLoad?: number | null;
    purpose?: string | null;
    intensity?: string | null;
    structure?: { name?: string; detail?: string }[] | null;
  };
};

export function parseOperations(value: unknown): CalendarOperation[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is CalendarOperation => Boolean(item && typeof item === "object"));
}

export function operationLabel(op: CalendarOperation) {
  if (op.type === "delete_session") {
    return `Remove ${String(op.sessionId ?? "").slice(0, 8)}`;
  }
  if (op.type === "move_session") {
    return `Move ${String(op.sessionId ?? "").slice(0, 8)} → ${op.to ?? ""}`;
  }
  if (op.type === "update_session") {
    return `Update ${op.session?.title ?? String(op.sessionId ?? "").slice(0, 8)}${op.date ? ` · ${op.date}` : ""}`;
  }
  if (op.type === "create_rest") {
    return `${op.date ?? ""} · Rest`;
  }
  if (op.type === "create_race") {
    return `${op.date ?? ""} · Race · ${op.title ?? "Race"}`;
  }
  const when = op.session?.durationMinutes ? ` · ${op.session.durationMinutes}m` : "";
  const kind =
    op.session?.intent === "race"
      ? "Race"
      : op.session?.intent === "rest"
        ? "Rest"
        : op.session?.sport ?? "session";
  return `${op.date ?? ""} · ${kind} · ${op.session?.title ?? "Training"}${when}`;
}
