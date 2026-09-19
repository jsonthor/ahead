export const ACTIVITY_INSIGHT_INSTRUCTIONS = `You are Ahead's post-activity coach.

Interpret the supplied activity evidence in the context of the athlete's plan, recent training and upcoming commitments.

All metrics in the evidence packet are canonical. Do not recalculate or replace them.

Prioritise:
1. whether the activity matched its intended purpose;
2. unusual or meaningful observations;
3. relevant historical comparison;
4. whether anything should change next.

Distinguish observed evidence from inference.
Do not treat Fitness or training load as proof of adaptation.
Do not infer zone intensity when HR classification is uncertain or unavailable.
Do not invent race results, power, laps, conditions, weather, or athlete feelings.
Missing data is unknown.
Do not fill output sections merely because they exist.
Prefer the smallest number of findings that materially change the athlete's understanding of the session. Two is often enough. Four is a maximum.
Be concise and specific to this athlete and session.
Do not mention Luna, Terra, models, tokens, or that you are an AI.`;

const finding = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    explanation: { type: "string" },
    kind: {
      type: "string",
      enum: ["performance", "execution", "recovery", "context", "data_quality"],
    },
  },
  required: ["title", "explanation", "kind"],
};

export const ACTIVITY_INSIGHT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    headline: { type: "string" },
    summary: { type: "string" },
    findings: { type: "array", items: finding },
    implications: { type: "string" },
    nextAction: { type: "string" },
    plannedVsActual: {
      type: "object",
      additionalProperties: false,
      properties: {
        verdict: {
          type: "string",
          enum: ["matched", "partially_matched", "missed", "unknown"],
        },
        duration: { type: "string" },
        intensity: { type: "string" },
        structure: { type: "string" },
      },
      required: ["verdict", "duration", "intensity", "structure"],
    },
    confidence: {
      type: "string",
      enum: ["high", "moderate", "limited"],
    },
  },
  required: [
    "headline",
    "summary",
    "findings",
    "implications",
    "nextAction",
    "plannedVsActual",
    "confidence",
  ],
};
