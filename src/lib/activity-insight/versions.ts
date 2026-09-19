import { ACTIVITY_INSIGHT_PACKET_VERSION } from "@/lib/activity-insight/types";
import type { ActivityInsightPacket } from "@/lib/activity-insight/types";

export function insightFingerprint(input: {
  packet: ActivityInsightPacket;
  formulaVersion?: string | null;
  hrModelVersion?: string | null;
}) {
  const zones = input.packet.physiology.hrZones;
  return [
    ACTIVITY_INSIGHT_PACKET_VERSION,
    input.formulaVersion ?? "",
    input.hrModelVersion ?? "",
    input.packet.activity.trainingLoad ?? "",
    input.packet.activity.classificationConfidence,
    input.packet.physiology.thresholdHr ?? "",
    input.packet.physiology.hrMax ?? "",
    input.packet.physiology.zoneMethod ?? "",
    zones
      ? `${zones.z1Seconds},${zones.z2Seconds},${zones.z3Seconds},${zones.z4Seconds},${zones.z5Seconds}`
      : "",
    input.packet.plannedWorkout?.title ?? "",
    input.packet.plannedWorkout?.comparison.intensityMatched ?? "",
    input.packet.forwardContext.nextRace?.startsAt ?? "",
    input.packet.currentState.fitness ?? "",
    input.packet.currentState.form ?? "",
  ].join("|");
}
