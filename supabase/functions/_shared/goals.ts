export function athleteGoals(onboarding: unknown) {
  if (!onboarding || typeof onboarding !== "object") {
    return null;
  }
  const values = (onboarding as { values?: Record<string, unknown> }).values;
  if (!values) {
    return null;
  }
  const races = values.priority_races as
    | { type?: string; events?: { name?: string; date?: string; priority?: string }[] }
    | undefined;
  const season = values.season as { type?: string; ids?: string[] } | undefined;
  const improve = values.improve as { type?: string; ids?: string[] } | undefined;
  const train = values.train_for as
    | { type?: string; picks?: { sport?: string; disciplines?: string[] }[] }
    | undefined;
  const fixed = values.fixed_sessions as
    | { type?: string; sessions?: { day?: string; title?: string }[] }
    | undefined;
  return {
    sports: (train?.picks ?? []).map((pick) => ({
      sport: pick.sport ?? "",
      disciplines: pick.disciplines ?? [],
    })),
    season: season?.ids?.[0] ?? null,
    focus: improve?.ids?.[0] ?? null,
    priorityRaces: (races?.events ?? [])
      .filter((event) => event.name?.trim())
      .map((event) => ({
        name: event.name?.trim() ?? "",
        date: event.date || null,
        priority: event.priority ?? "B",
      })),
    weeklySessions: (fixed?.sessions ?? []).map((session) =>
      `${session.day ?? ""} ${session.title ?? "session"}`.trim(),
    ),
  };
}
