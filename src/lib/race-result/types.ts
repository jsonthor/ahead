export const RACE_FEELS = ["good", "ok", "hard", "rough"] as const;
export const RACE_FACTORS = [
  "none",
  "crash",
  "mechanical",
  "weather",
  "illness",
  "other",
] as const;
export const RACE_STATUSES = ["completed", "dnf", "dns"] as const;

export type RaceFeel = (typeof RACE_FEELS)[number];
export type RaceFactor = (typeof RACE_FACTORS)[number];
export type RaceStatus = (typeof RACE_STATUSES)[number];

export type RaceResult = {
  id: string;
  athleteId: string;
  calendarItemId: string | null;
  activityId: string | null;
  place: number | null;
  fieldSize: number | null;
  category: string | null;
  gap: string | null;
  feel: RaceFeel | null;
  factor: RaceFactor | null;
  status: RaceStatus;
};

export type RaceResultInput = {
  calendarItemId?: string | null;
  activityId?: string | null;
  place: number | null;
  fieldSize: number | null;
  category: string | null;
  gap: string | null;
  feel: RaceFeel | null;
  factor: RaceFactor | null;
  status: RaceStatus;
};

export type RaceResultContext = {
  place: number | null;
  fieldSize: number | null;
  category: string | null;
  gap: string | null;
  feel: RaceFeel | null;
  factor: RaceFactor | null;
  status: RaceStatus;
};

export function isRaceSession(input: {
  intent?: string | null;
  sessionType?: string | null;
}) {
  return input.intent === "race" || input.sessionType === "race";
}

export function raceResultContext(result: RaceResult | null): RaceResultContext | null {
  if (!result) {
    return null;
  }
  return {
    place: result.place,
    fieldSize: result.fieldSize,
    category: result.category,
    gap: result.gap,
    feel: result.feel,
    factor: result.factor,
    status: result.status,
  };
}

export function formatRaceResult(result: Pick<RaceResult, "place" | "fieldSize" | "status">) {
  if (result.status === "dnf") {
    return "DNF";
  }
  if (result.status === "dns") {
    return "DNS";
  }
  if (result.place != null && result.fieldSize != null) {
    return `${result.place} / ${result.fieldSize}`;
  }
  if (result.place != null) {
    return `${result.place}${ordinal(result.place)}`;
  }
  return "Completed";
}

function ordinal(value: number) {
  const ones = value % 10;
  const tens = value % 100;
  if (ones === 1 && tens !== 11) {
    return "st";
  }
  if (ones === 2 && tens !== 12) {
    return "nd";
  }
  if (ones === 3 && tens !== 13) {
    return "rd";
  }
  return "th";
}
