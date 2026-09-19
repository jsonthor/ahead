/**
 * Onboarding is a versioned question list, not a hard-coded form.
 *
 * Rule: only ask what Potential cannot reliably learn from training
 * history, calendar data, or imports. Change QUESTIONS (and bump
 * ONBOARDING_VERSION) when the product learns more from data.
 *
 * Answers are a JSON map keyed by question id — the same shape we
 * will store on the athlete profile in Supabase.
 */

import { parseDateOfBirth, validateDateOfBirth } from "@/lib/athlete-age";
import type { Database } from "@/lib/database.types";
import type { WorkoutSport } from "@/lib/workout";
import type { SupabaseClient } from "@supabase/supabase-js";

export const ONBOARDING_VERSION = 3;

export const CASUAL_DISCIPLINE = "casual";
const CASUAL_OPTION: Option = { id: CASUAL_DISCIPLINE, label: "Just for fun" };

function withCasual(disciplines: Option[]): Option[] {
  return [...disciplines, CASUAL_OPTION];
}

export const DAYS = [
  { id: "mon", label: "Mon" },
  { id: "tue", label: "Tue" },
  { id: "wed", label: "Wed" },
  { id: "thu", label: "Thu" },
  { id: "fri", label: "Fri" },
  { id: "sat", label: "Sat" },
  { id: "sun", label: "Sun" },
] as const;

export type DayId = (typeof DAYS)[number]["id"];

export const DURATION_OPTIONS = [
  { minutes: null, label: "Off" },
  { minutes: 30, label: "30m" },
  { minutes: 45, label: "45m" },
  { minutes: 60, label: "60m" },
  { minutes: 75, label: "75m" },
  { minutes: 90, label: "90m" },
  { minutes: 120, label: "2h" },
  { minutes: 150, label: "2.5h" },
  { minutes: 180, label: "3h+" },
] as const;

export type Option = {
  id: string;
  label: string;
  hint?: string;
};

export type SportOption = {
  id: string;
  label: string;
  disciplines: Option[];
};

export type Priority = "A" | "B" | "C";

export type FixedSession = {
  day: DayId;
  title: string;
  minutes?: number;
};

export type PriorityRace = {
  name: string;
  date?: string;
  priority: Priority;
};

export type SportPick = {
  sport: string;
  disciplines: string[];
};

export type AnswerValue =
  | { type: "choice"; ids: string[] }
  | { type: "sport_discipline"; picks: SportPick[] }
  | { type: "availability"; days: Record<DayId, number | null> }
  | { type: "fixed_sessions"; sessions: FixedSession[] }
  | { type: "event_list"; events: PriorityRace[] }
  | { type: "date"; value: string };

export type OnboardingAnswers = {
  version: number;
  values: Record<string, AnswerValue>;
};

type Visibility = (answers: OnboardingAnswers) => boolean;

type BaseQuestion = {
  id: string;
  title: string;
  help: string;
  required: boolean;
  showIf?: Visibility;
};

export type Question =
  | (BaseQuestion & {
      type: "choice";
      multiple?: boolean;
      options: Option[];
    })
  | (BaseQuestion & {
      type: "sport_discipline";
      sports: SportOption[];
    })
  | (BaseQuestion & {
      type: "availability";
    })
  | (BaseQuestion & {
      type: "fixed_sessions";
      presets: Option[];
    })
  | (BaseQuestion & {
      type: "event_list";
    })
  | (BaseQuestion & {
      type: "date";
    });

export const SPORTS: SportOption[] = [
  {
    id: "running",
    label: "Running",
    disciplines: withCasual([
      { id: "road", label: "Road" },
      { id: "trail", label: "Trail" },
      { id: "track", label: "Track" },
      { id: "xc", label: "Cross-country" },
      { id: "ultra", label: "Ultra" },
    ]),
  },
  {
    id: "cycling",
    label: "Cycling",
    disciplines: withCasual([
      { id: "road", label: "Road" },
      { id: "cx", label: "Cyclocross" },
      { id: "mtb", label: "MTB" },
      { id: "gravel", label: "Gravel" },
      { id: "track", label: "Track" },
      { id: "tt", label: "Time trial" },
    ]),
  },
  {
    id: "triathlon",
    label: "Triathlon",
    disciplines: withCasual([
      { id: "sprint", label: "Sprint" },
      { id: "olympic", label: "Olympic" },
      { id: "seventy-three", label: "70.3" },
      { id: "ironman", label: "Ironman" },
      { id: "off-road", label: "Off-road" },
    ]),
  },
  {
    id: "other",
    label: "Other",
    disciplines: withCasual([
      { id: "swim", label: "Swim" },
      { id: "row", label: "Row" },
      { id: "ski", label: "Ski" },
      { id: "other", label: "Something else" },
    ]),
  },
];

function seasonId(answers: OnboardingAnswers): string | undefined {
  const value = answers.values.season;
  if (value?.type === "choice") {
    return value.ids[0];
  }
  return undefined;
}

/**
 * The live questionnaire. Edit this list to change onboarding.
 * Keep it short. Prefer hiding a step with `showIf`
 * over adding another screen.
 */
export const QUESTIONS: Question[] = [
  {
    id: "date_of_birth",
    type: "date",
    title: "When were you born?",
    help: "We use age where it matters to interpreting training and recovery.",
    required: true,
  },
  {
    id: "train_for",
    type: "sport_discipline",
    title: "What do you train for?",
    help: "Pick every sport that belongs in the week — including the ones that are just for fun. Ahead will learn the rest from your files.",
    required: true,
    sports: SPORTS,
  },
  {
    id: "season",
    type: "choice",
    title: "What does your season look like?",
    help: "We will not force a single goal race. A season is allowed to be a season.",
    required: true,
    options: [
      {
        id: "race_regularly",
        label: "I race regularly through a season",
        hint: "Add the calendar later. Mark the races that actually matter.",
      },
      {
        id: "key_events",
        label: "I’m building toward a few key events",
      },
      {
        id: "no_calendar",
        label: "I’m training without a race calendar",
      },
    ],
  },
  {
    id: "priority_races",
    type: "event_list",
    title: "Which races matter most?",
    help: "Name, date, and A / B / C. Optional — you can add the rest on the calendar later.",
    required: false,
    showIf: (answers) => {
      const season = seasonId(answers);
      return season === "race_regularly" || season === "key_events";
    },
  },
  {
    id: "availability",
    type: "availability",
    title: "When can you realistically train?",
    help: "History shows what you did. This is what your life actually allows.",
    required: true,
  },
  {
    id: "fixed_sessions",
    type: "fixed_sessions",
    title: "Anything fixed every week?",
    help: "Club, coach, commute, gym, school sport, long ride. These land on the calendar as recurring constraints.",
    required: false,
    presets: [
      { id: "club", label: "Club session" },
      { id: "coach", label: "Coached session" },
      { id: "commute", label: "Commute" },
      { id: "gym", label: "Gym" },
      { id: "school", label: "School sport" },
      { id: "long", label: "Long ride / run" },
      { id: "skills", label: "Skills" },
    ],
  },
  {
    id: "improve",
    type: "choice",
    title: "What are you trying to improve?",
    help: "One focus is enough. Volume, zones, and consistency come from your data.",
    required: true,
    options: [
      { id: "race", label: "Overall race performance" },
      { id: "endurance", label: "Endurance" },
      { id: "speed", label: "Speed / power" },
      { id: "threshold", label: "Threshold" },
      { id: "climbing", label: "Climbing" },
      { id: "return", label: "Return to fitness" },
      { id: "maintain", label: "Maintain fitness" },
      { id: "from_data", label: "Let Ahead decide from my data" },
    ],
  },
];

export function emptyAnswers(): OnboardingAnswers {
  return { version: ONBOARDING_VERSION, values: {} };
}

export function visibleQuestions(answers: OnboardingAnswers): Question[] {
  return QUESTIONS.filter((question) =>
    question.showIf ? question.showIf(answers) : true,
  );
}

export function defaultValue(question: Question): AnswerValue {
  switch (question.type) {
    case "choice":
      return { type: "choice", ids: [] };
    case "sport_discipline":
      return { type: "sport_discipline", picks: [] };
    case "availability": {
      const days = Object.fromEntries(DAYS.map((day) => [day.id, null])) as Record<
        DayId,
        number | null
      >;
      return { type: "availability", days };
    }
    case "fixed_sessions":
      return { type: "fixed_sessions", sessions: [] };
    case "event_list":
      return { type: "event_list", events: [] };
    case "date":
      return { type: "date", value: "" };
  }
}

export function validateQuestion(
  question: Question,
  value: AnswerValue | undefined,
): string | null {
  if (!question.required) {
    return null;
  }
  if (!value) {
    return "This one matters — Ahead cannot infer it.";
  }
  switch (question.type) {
    case "choice":
      if (value.type !== "choice" || value.ids.length === 0) {
        return "Pick one.";
      }
      return null;
    case "sport_discipline": {
      const picks = sportPicks(value);
      if (picks.length === 0) {
        return "Pick at least one sport.";
      }
      if (picks.some((pick) => pick.disciplines.length === 0)) {
        return "For each sport, pick a discipline — or Just for fun.";
      }
      return null;
    }
    case "availability":
      if (value.type !== "availability") {
        return "Set your week.";
      }
      if (!Object.values(value.days).some((minutes) => minutes && minutes > 0)) {
        return "Give at least one day you can train.";
      }
      return null;
    case "fixed_sessions":
    case "event_list":
      return null;
    case "date":
      if (value.type !== "date") {
        return "Enter your date of birth.";
      }
      return validateDateOfBirth(value.value);
  }
}

export function takeDateOfBirth(answers: OnboardingAnswers): {
  dateOfBirth: string | null;
  answers: OnboardingAnswers;
} {
  const raw = answers.values.date_of_birth;
  const value = raw?.type === "date" ? raw.value : "";
  const { date_of_birth: _removed, ...values } = answers.values;
  return {
    dateOfBirth: parseDateOfBirth(value),
    answers: { ...answers, values },
  };
}

export function labelForChoice(question: Question, id: string): string {
  if (question.type !== "choice") {
    return id;
  }
  return question.options.find((option) => option.id === id)?.label ?? id;
}

export function sportPicks(value: AnswerValue | undefined): SportPick[] {
  if (!value || value.type !== "sport_discipline") {
    return [];
  }
  const raw = value as AnswerValue & {
    picks?: SportPick[];
    sport?: string;
    discipline?: string;
  };
  if (Array.isArray(raw.picks)) {
    return raw.picks
      .filter((pick) => pick && typeof pick.sport === "string" && pick.sport.length > 0)
      .map((pick) => ({
        sport: pick.sport,
        disciplines: Array.isArray(pick.disciplines) ? pick.disciplines : [],
      }));
  }
  if (raw.sport) {
    return [
      {
        sport: raw.sport,
        disciplines: raw.discipline ? [raw.discipline] : [],
      },
    ];
  }
  return [];
}

export function sportLabel(sportId: string, disciplineId?: string): string {
  const sport = SPORTS.find((entry) => entry.id === sportId);
  if (!sport) {
    return sportId;
  }
  if (!disciplineId) {
    return sport.label;
  }
  if (disciplineId === CASUAL_DISCIPLINE) {
    return `${sport.label}, just for fun`;
  }
  const discipline = sport.disciplines.find((entry) => entry.id === disciplineId);
  if (!discipline) {
    return sport.label;
  }
  if (sport.id === "other") {
    return discipline.label;
  }
  return discipline.label;
}

function summarizeSportPick(pick: SportPick): string {
  const sport = SPORTS.find((entry) => entry.id === pick.sport);
  const disciplines = pick.disciplines ?? [];
  const competitive = disciplines.filter((id) => id !== CASUAL_DISCIPLINE);
  const casual = disciplines.includes(CASUAL_DISCIPLINE);
  const names = competitive.map((id) => {
    const label = sportLabel(pick.sport, id);
    return label;
  });
  if (names.length === 0) {
    return casual ? `${sport?.label ?? pick.sport}, just for fun` : (sport?.label ?? pick.sport);
  }
  const joined = names.join(", ");
  return casual ? `${joined} · also just for fun` : joined;
}

export function summarize(answers: OnboardingAnswers) {
  const train = answers.values.train_for;
  const season = answers.values.season;
  const races = answers.values.priority_races;
  const availability = answers.values.availability;
  const fixed = answers.values.fixed_sessions;
  const improve = answers.values.improve;

  const picks = sportPicks(train);
  const sport =
    picks.length > 0 ? picks.map(summarizeSportPick).join(" · ") : "—";

  const seasonLabel =
    season?.type === "choice"
      ? labelForChoice(
          QUESTIONS.find((question) => question.id === "season") as Question,
          season.ids[0] ?? "",
        )
      : "—";

  const availableDays =
    availability?.type === "availability"
      ? DAYS.filter((day) => availability.days[day.id]).map((day) => {
          const minutes = availability.days[day.id];
          const slot = DURATION_OPTIONS.find((option) => option.minutes === minutes);
          return `${day.label} ${slot?.label ?? ""}`.trim();
        })
      : [];

  const sessions =
    fixed?.type === "fixed_sessions"
      ? fixed.sessions.map((session) => {
          const day = DAYS.find((entry) => entry.id === session.day)?.label ?? session.day;
          return `${day} ${session.title}`;
        })
      : [];

  const raceCount =
    races?.type === "event_list" ? races.events.length : 0;

  const focus =
    improve?.type === "choice" && improve.ids[0]
      ? labelForChoice(
          QUESTIONS.find((question) => question.id === "improve") as Question,
          improve.ids[0],
        )
      : "—";

  return {
    sport,
    season: seasonLabel,
    raceCount,
    availableDays,
    sessions,
    focus,
  };
}

export function calendarSportFromOnboarding(answers: OnboardingAnswers): WorkoutSport {
  const picks = sportPicks(answers.values.train_for);
  const first = picks[0];
  if (!first) {
    return "other";
  }
  if (first.sport === "triathlon") {
    return "triathlon";
  }
  if (first.sport === "running") {
    return "run";
  }
  if (first.sport === "cycling") {
    return "ride";
  }
  if (first.sport === "other") {
    const discipline = first.disciplines.find((id) => id !== CASUAL_DISCIPLINE);
    if (discipline === "swim") {
      return "swim";
    }
    if (discipline === "row") {
      return "row";
    }
    if (discipline === "ski") {
      return "ski";
    }
  }
  return "other";
}

export async function seedPriorityRaces(
  client: SupabaseClient<Database>,
  athleteId: string,
  answers: OnboardingAnswers,
) {
  const races = answers.values.priority_races;
  if (races?.type !== "event_list" || races.events.length === 0) {
    return;
  }
  const sport = calendarSportFromOnboarding(answers);
  for (const event of races.events) {
    if (!event.date || !/^\d{4}-\d{2}-\d{2}$/.test(event.date) || !event.name.trim()) {
      continue;
    }
    const { data: existing } = await client
      .from("calendar_items")
      .select("id")
      .eq("athlete_id", athleteId)
      .eq("date", event.date)
      .eq("title", event.name.trim())
      .maybeSingle();
    if (existing) {
      continue;
    }
    const { error } = await client.from("calendar_items").insert({
      athlete_id: athleteId,
      date: event.date,
      sport,
      title: event.name.trim(),
      intent: "race",
      importance: event.priority,
      created_by: "athlete",
    });
    if (error) {
      console.error("Onboarding race seed failed", error);
    }
  }
}
