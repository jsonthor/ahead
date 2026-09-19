export const SESSION_NOTE_VERSION = 3;

export type SessionRole =
  | "race"
  | "opener"
  | "main-stress"
  | "easy-contrast"
  | "aerobic"
  | "quality"
  | "other";

export type SessionMix = "easy" | "specific" | "mixed" | "unknown";

export type SessionNote = {
  version: number;
  activityId: string;
  fingerprint: string;
  composedAt: string;
  title: string;
  date: string;
  role: SessionRole;
  reading: string;
  planned: {
    title: string | null;
    purpose: string | null;
    minutes: number | null;
    load: number | null;
  } | null;
  landed: {
    minutes: number | null;
    load: number | null;
    mix: SessionMix;
    intensity: number | null;
    race: boolean;
  };
  week: {
    start: string;
    end: string;
    sessionCount: number;
    peakLoad: number | null;
  };
  route: {
    attemptCount: number;
    versusTypical: string | null;
  } | null;
  intensityStatus: "trusted" | "uncertain" | "unavailable";
  review: {
    reviewId: string;
    immediatePriority: string | null;
    nextObjective: string | null;
  } | null;
};

export type SessionNoteContext = {
  activityId: string;
  title: string;
  date: string;
  role: SessionRole;
  reading: string;
  planned: SessionNote["planned"];
  landed: SessionNote["landed"];
  week: SessionNote["week"];
  route: SessionNote["route"];
  intensityStatus: SessionNote["intensityStatus"];
  review: SessionNote["review"];
};
