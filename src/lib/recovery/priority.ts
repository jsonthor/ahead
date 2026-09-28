export type RecoverySourceId = "coros" | "google_health" | string;

export const RECOVERY_METRICS = ["sleep", "hrv", "resting_hr"] as const;
export type RecoveryMetric = (typeof RECOVERY_METRICS)[number];

export const RECOVERY_SOURCE_LABEL: Record<string, string> = {
  coros: "COROS",
  google_health: "Google Health",
};

export function recoverySourceLabel(id: string) {
  return RECOVERY_SOURCE_LABEL[id] ?? id;
}

export type RecoverySleepObservation = {
  startAt?: string | null;
  endAt?: string | null;
  durationMinutes?: number | null;
  timeInBedMinutes?: number | null;
  awakeMinutes?: number | null;
  stages?: {
    deepMinutes?: number | null;
    remMinutes?: number | null;
    lightMinutes?: number | null;
    awakeMinutes?: number | null;
  } | null;
};

export type RecoverySourcePayload = {
  sleep?: RecoverySleepObservation | null;
  hrvRmssdMs?: number | null;
  restingHrBpm?: number | null;
  respiratoryRate?: number | null;
  spo2Pct?: number | null;
  sleepScore?: number | null;
  stressAvg?: number | null;
  sleepTemperature?: {
    nightlyC?: number | null;
    baselineC?: number | null;
    deltaC?: number | null;
  } | null;
};

export type RecoverySourcePriority = {
  sleep: RecoverySourceId[];
  hrv: RecoverySourceId[];
  resting_hr: RecoverySourceId[];
  pending: RecoverySourceId[];
};

const EMPTY_PRIORITY: RecoverySourcePriority = {
  sleep: [],
  hrv: [],
  resting_hr: [],
  pending: [],
};

function asSourceList(value: unknown): RecoverySourceId[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string" && Boolean(entry));
  }
  if (typeof value === "string" && value) {
    return [value];
  }
  return [];
}

export function parseRecoveryPriority(value: unknown): RecoverySourcePriority {
  if (typeof value === "string" && value) {
    return {
      sleep: [value],
      hrv: [value],
      resting_hr: [value],
      pending: [],
    };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...EMPTY_PRIORITY };
  }
  const row = value as Record<string, unknown>;
  if (typeof row.sleep === "string" && !Array.isArray(row.hrv)) {
    const winner = row.sleep;
    return {
      sleep: [winner],
      hrv: [winner],
      resting_hr: [winner],
      pending: [],
    };
  }
  return {
    sleep: asSourceList(row.sleep),
    hrv: asSourceList(row.hrv),
    resting_hr: asSourceList(row.resting_hr ?? row.restingHeartRate),
    pending: asSourceList(row.pending),
  };
}

/** Keep saved order, then append any connected recovery source that is missing. */
export function withConnectedSources(
  priority: RecoverySourcePriority,
  connected: RecoverySourceId[],
): RecoverySourcePriority {
  function merge(list: RecoverySourceId[]) {
    const next = list.filter((id) => connected.includes(id));
    for (const id of connected) {
      if (!next.includes(id)) {
        next.push(id);
      }
    }
    return next;
  }
  return {
    sleep: merge(priority.sleep),
    hrv: merge(priority.hrv),
    resting_hr: merge(priority.resting_hr),
    pending: priority.pending,
  };
}

export function pickFromPriority<T>(
  observations: Array<{ source: string; payload: RecoverySourcePayload }>,
  order: RecoverySourceId[],
  read: (payload: RecoverySourcePayload) => T | null | undefined,
): { value: T | null; source: string | null } {
  for (const source of order) {
    const row = observations.find((entry) => entry.source === source);
    const value = row ? read(row.payload) : null;
    if (value != null) {
      return { value, source };
    }
  }
  return { value: null, source: null };
}

function sourceRank(order: RecoverySourceId[], source: string | null | undefined) {
  if (!source) {
    return Number.POSITIVE_INFINITY;
  }
  const index = order.indexOf(source);
  return index < 0 ? Number.POSITIVE_INFINITY : index;
}

/** Keep a lower-priority winner, but always refresh from the same or higher-priority source. */
export function keepResolved<T>(input: {
  recast: boolean;
  order: RecoverySourceId[];
  existingValue: T | null | undefined;
  existingSource: string | null | undefined;
  picked: { value: T | null; source: string | null };
}): { value: T | null; source: string | null } {
  if (input.recast) {
    return input.picked;
  }
  const existingRank = sourceRank(input.order, input.existingSource);
  const pickedRank = sourceRank(input.order, input.picked.source);
  if (input.picked.value != null && pickedRank <= existingRank) {
    return input.picked;
  }
  if (input.existingSource && input.existingValue != null) {
    return { value: input.existingValue, source: input.existingSource };
  }
  return input.picked;
}

export function connectedOrder(order: RecoverySourceId[], connected: RecoverySourceId[]) {
  if (connected.length === 0) {
    return order;
  }
  const allowed = new Set(connected);
  const next = order.filter((id) => allowed.has(id));
  return next.length > 0 ? next : connected;
}
