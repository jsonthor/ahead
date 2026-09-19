# PRD — Ahead Activity Insight

**Status:** Draft
**Product:** Ahead
**Area:** Activities / Coaching
**Working name:** Activity Insight
**Audience:** Existing Ahead athletes
**Primary question:** **What did this session actually mean?**

Activity Insight automatically analyses every completed activity after Ahead has processed it.

It should answer more than:

> What were my numbers?

It should answer:

> **Did this session do what it was supposed to do, what stands out, and does anything change because of it?**

The feature should use Ahead's deterministic metrics as evidence and a low-cost AI model for interpretation. It must not ask the model to calculate physiology from raw streams.

---

## 1. Product goal

After a completed activity syncs into Ahead:

```text
Activity imported
→ metrics calculated
→ athlete physiology applied
→ planned workout matched
→ recent/future context assembled
→ AI Activity Insight generated
→ insight saved on activity
```

The athlete opens the activity and sees a short coaching interpretation immediately.

This should feel like Ahead watched the session, understood its purpose and put it into context.

---

## 2. Product principle

The AI interprets.

**The backend measures.**

The model must never independently calculate training load, HR zones, threshold, Fitness, Fatigue, Form, Readiness, Direction, aerobic or specific capacity, planned-vs-actual adherence, or repeated-route comparisons.

Those values come from Ahead's canonical backend.

---

## 3–36

See the source PRD in product notes. Implementation follows the MVP build order:

1. `buildActivityInsightPacket(activityId)`
2. structured Activity Insight JSON schema
3. Luna generation service
4. persistence table
5. post-processing trigger for new activities
6. activity-page Insight UI
7. Ask about this session
8. token/cost telemetry
9. model-version dependency / stale handling
10. planned-vs-actual enrichment
