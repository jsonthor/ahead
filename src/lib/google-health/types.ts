export const GOOGLE_HEALTH_PROVIDER = "google_health";

export const GOOGLE_HEALTH_SCOPES = [
  "https://www.googleapis.com/auth/googlehealth.sleep.readonly",
  "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly",
] as const;

export const GOOGLE_HEALTH_ACTIVITY_SCOPE =
  "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly";

export const GOOGLE_DATA_TYPES = {
  sleep: "sleep",
  hrv: "daily-heart-rate-variability",
  restingHr: "daily-resting-heart-rate",
  respiratoryRate: "daily-respiratory-rate",
  oxygenSaturation: "daily-oxygen-saturation",
  sleepTemperature: "daily-sleep-temperature-derivations",
} as const;

export type GoogleHealthTokens = {
  accessToken: string;
  refreshToken: string | null;
  tokenType: string;
  scope: string | null;
  expiresAt: string | null;
};
