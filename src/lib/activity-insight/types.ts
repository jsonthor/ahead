export const ACTIVITY_INSIGHT_PACKET_VERSION = 1;
export const ACTIVITY_INSIGHT_PROMPT_VERSION = 1;

export type InsightConfidence = "high" | "moderate" | "limited";
export type InsightStatus = "ready" | "stale" | "failed";
export type ClassificationConfidence = "trusted" | "uncertain" | "unavailable";
export type PlannedVerdict = "matched" | "partially_matched" | "missed" | "unknown";
export type InsightFindingKind =
  | "performance"
  | "execution"
  | "recovery"
  | "context"
  | "data_quality";

export type ActivityInsightPacket = {
  athlete: {
    sportContext: string | null;
    upcomingPriority?: string | null;
  };
  activity: {
    id: string;
    sport: string;
    startedAt: string;
    durationSeconds: number | null;
    movingSeconds?: number | null;
    distanceM?: number | null;
    elevationM?: number | null;
    avgHr?: number | null;
    maxHr?: number | null;
    avgPower?: number | null;
    normalizedPower?: number | null;
    avgSpeed?: number | null;
    trainingLoad?: number | null;
    loadMethod?: string | null;
    classificationConfidence: ClassificationConfidence;
  };
  physiology: {
    hrMax?: number | null;
    hrMaxSource?: string | null;
    hrMaxConfidence?: string | null;
    thresholdHr?: number | null;
    thresholdHrSource?: string | null;
    thresholdHrConfidence?: string | null;
    zoneMethod?: string | null;
    hrZones?: {
      z1Seconds: number;
      z2Seconds: number;
      z3Seconds: number;
      z4Seconds: number;
      z5Seconds: number;
    };
  };
  trainingMix?: {
    easyMinutes: number;
    specificMinutes: number;
    highMinutes: number;
  };
  plannedWorkout?: {
    title: string;
    purpose?: string | null;
    targetDurationMinutes?: number | null;
    prescribedStructure?: string | null;
    plannedIntensity?: string | null;
    plannedLoad?: number | null;
    comparison: {
      durationMatched?: boolean | null;
      intensityMatched?: boolean | null;
      structureVerified?: boolean | null;
    };
  };
  laps?: Array<{
    durationSeconds: number | null;
    avgHr?: number | null;
    avgPower?: number | null;
    avgSpeed?: number | null;
  }>;
  performance?: {
    repeatedRoute?: {
      attemptCount: number;
      comparisonAvailable: boolean;
      speedChangePct?: number | null;
      hrChangeBpm?: number | null;
      comparisonConfidence?: string | null;
    };
  };
  recovery: {
    readiness?: number | null;
    sleepDurationMinutes?: number | null;
    hrv?: number | null;
    restingHr?: number | null;
    recoveryCoverage?: string | null;
  };
  currentState: {
    direction?: string | null;
    fitness?: number | null;
    fatigue?: number | null;
    form?: number | null;
  };
  recentContext: {
    previous7DayLoad?: number | null;
    previous7DayHours?: number | null;
    hardSessionsPrevious72h?: number | null;
  };
  forwardContext: {
    nextRace?: {
      name: string;
      startsAt: string;
      priority?: string | null;
    };
    nextPlannedSession?: {
      title: string;
      startsAt: string;
      purpose?: string | null;
    };
  };
  weather: {
    available: boolean;
    summary?: string;
  };
  dataLimitations: string[];
};

export type ActivityInsightFinding = {
  title: string;
  explanation: string;
  kind: InsightFindingKind;
};

export type ActivityInsight = {
  id: string;
  athleteId: string;
  activityId: string;
  status: InsightStatus;
  headline: string;
  summary: string;
  findings: ActivityInsightFinding[];
  implications: string | null;
  nextAction: string | null;
  plannedVsActual: {
    verdict: PlannedVerdict;
    duration?: string | null;
    intensity?: string | null;
    structure?: string | null;
  } | null;
  confidence: InsightConfidence;
  fingerprint: string;
  model: string | null;
  promptVersion: number;
  packetVersion: number;
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
  estimatedCost: number | null;
  latencyMs: number | null;
  generatedAt: string;
};

export type ActivityInsightContext = {
  activityId: string;
  insightId: string;
  headline: string;
  summary: string;
  findings: ActivityInsightFinding[];
  implications: string | null;
  nextAction: string | null;
  plannedVsActual: ActivityInsight["plannedVsActual"];
  confidence: InsightConfidence;
};
