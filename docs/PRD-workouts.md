# PRD — Workout Library + Coach-Designed Workouts

**Product:** Ahead
**Feature:** Structured Workouts
**Status:** Proposed
**Primary users:** Self-coached endurance athletes
**Core principle:** A workout is a prescription. Ahead should be able to select one, adapt one, or create one because of a coaching decision — not just because a workout looks interesting.

---

## 1. Problem

Most training platforms have a library of workouts that an athlete can browse and add to a plan.

That is useful, but Ahead can go further because it already knows:

* what the athlete has been doing;
* their current Performance state;
* aerobic/specific development;
* recent strain and recovery;
* races and priorities ahead;
* recurring club sessions and constraints;
* previous coaching decisions;
* what happened when similar sessions were completed.

Ahead should therefore support both:

**Library workouts**

> “I want a 45-minute threshold session.”

and:

**Coach-designed workouts**

> “I need a session on Wednesday that develops race-specific power without wrecking me for Sunday.”

The result should be the same structured workout object regardless of whether it came from a human-built library, the athlete, or Ahead.

---

## 2. Product proposition

## Workouts when you want one. Coaching when you need one.

Athletes can browse proven session structures and add them directly to their plan.

Or Ahead can design the session that fits the actual training problem.

The important distinction is:

> **The library starts with the workout. Ahead starts with why you need one.**

---

## 3. Product model

Do not treat a scheduled workout and a reusable workout as the same object.

There are three layers:

```text
WORKOUT DEFINITION
Reusable recipe
"5 × 5 min threshold"

        ↓

WORKOUT PRESCRIPTION
Athlete-specific version
Targets resolved against this athlete's physiology

        ↓

PLANNED SESSION
The copy scheduled for Wednesday
with date, race context, objective and coaching rationale
```

Example:

```text
Workout definition
5 × 5 min threshold
5 min recoveries

↓

Prescription for athlete
5 × 5 min @ cycling threshold HR / power zone
resolved using athlete's current thresholds

↓

Wednesday 23 Sep
Threshold development
Because Sunday race is 4 days away
Estimated load: 61
```

Completed activity then links back to the planned session.

That enables Activity Insight to answer:

> **Did the athlete actually do what was prescribed?**

---

## 4. Entry points

Workouts should be accessible from three places.

### Athlete chooses

From a planned day:

> Add session → Choose workout

opens the Workout Library.

### Athlete asks Ahead

Examples:

> Give me an aerobic session for tomorrow.

> I have 45 minutes. What should I do?

> Make Wednesday useful without compromising Sunday.

Ahead can select an existing workout or generate a new one.

### Coach Review / block planning

When Ahead creates the next block it can assign structured workouts to appropriate sessions.

For example:

```text
Wednesday
CX-specific intervals · 55m

Saturday
Race openers · 25m
```

These are real structured workout prescriptions rather than text labels.

---

## 5. Workout Library

Create:

`/app/workouts`

It does not necessarily need to enter the main navigation immediately. It can first be accessible from planning/session creation.

Library header:

> **Workouts**
>
> Sessions you can use as they are, adjust, or add to your plan.

Primary controls:

```text
All | Cycling | Running

Duration
Training focus
Intensity
Workout type
```

Ahead focuses:

* Easy endurance
* Aerobic endurance
* Tempo
* Threshold
* VO₂ / high intensity
* Race specific
* Openers
* Recovery
* Skills
* Progression / negative split

Do not expose an enormous taxonomy initially.

---

## 6. Workout cards

Use the pattern in the reference screenshot, but make the information more useful to Ahead athletes.

Example:

```text
Threshold · 5 × 5

Cycling                                55m

████████████████████
      ▇▇▇ ▇▇▇ ▇▇▇ ▇▇▇ ▇▇▇
████████████████████

Threshold development

5 × 5m hard
5m easy between

Estimated load
58–66
```

Card information should include:

**Primary**

* workout name;
* sport;
* duration;
* miniature workout profile.

**Secondary**

* focus;
* estimated load where meaningful;
* relevant target basis.

Do **not** fill cards with arbitrary metrics such as FTP percentages if the workout is not actually prescribed by FTP.

---

## 7. Workout detail

Selecting a workout opens its complete prescription.

Example:

## 5 × 5 Threshold

**55 min · Cycling · Threshold**

Build sustained high aerobic / threshold work without requiring one continuous effort.

### Session

**Warm-up — 10 min**

Easy → steady

**5 ×**

5 min · Threshold
5 min · Easy

**Cool-down — 5 min**

Easy

### For you

Threshold targets are resolved using the athlete's current cycling physiology.

For example:

```text
5 min
Power: 245–265 W

or

HR: 172–180 bpm
```

depending on available athlete data and workout targeting method.

CTA:

**Add to plan**

Secondary:

**Adjust workout**

---

## 8. Structured workout representation

Ahead needs a vendor-neutral internal workout schema.

Do not make it Garmin-, COROS-, TrainingPeaks-, FIT-, power-, or HR-shaped.

Example:

```ts
type WorkoutDefinition = {
  id: string
  name: string
  sport: Sport
  description?: string

  objective: WorkoutObjective

  steps: WorkoutStep[]

  source:
    | "ahead_library"
    | "ahead_coach"
    | "athlete"

  estimatedDurationSeconds: number
  estimatedLoad?: {
    min: number
    max: number
    confidence: "low" | "moderate" | "high"
  }

  createdAt: string
  version: number
}
```

Workout steps:

```ts
type WorkoutStep =
  | WorkoutInterval
  | WorkoutRepeat

type WorkoutInterval = {
  duration:
    | { type: "time"; seconds: number }
    | { type: "distance"; meters: number }
    | { type: "open" }

  target?: WorkoutTarget

  label?: string
}

type WorkoutRepeat = {
  repetitions: number
  steps: WorkoutStep[]
}
```

Targets:

```ts
type WorkoutTarget =
  | {
      type: "zone"
      metric: "hr" | "power" | "pace"
      zone: string
    }
  | {
      type: "range"
      metric: "hr" | "power" | "pace"
      min: number
      max: number
      unit: string
    }
  | {
      type: "rpe"
      min: number
      max: number
    }
  | {
      type: "free"
    }
```

This structure should be capable of representing:

> 15m easy → 4 × [3m hard / 3m easy] → 10m easy

without depending on any watch platform.

---

## 9. Semantic target + resolved target

This is important.

Do **not** save a workout merely as:

> 178–184 bpm.

Save why that target exists:

```text
Target:
cycling threshold
Zone 4

Resolved for athlete:
178–184 bpm

Physiology version:
20 Sep 2026
```

So the prescription stores both:

```ts
targetSemantic: {
  metric: "hr",
  basis: "cycling_lthr",
  zone: "Z4"
}

resolvedTarget: {
  min: 178,
  max: 184,
  unit: "bpm",
  thresholdValue: 187
}
```

This solves several problems.

If the athlete changes watch, nothing changes.

If their threshold changes later, Ahead still knows **what was actually prescribed on that date**.

Future unscheduled templates can resolve against the latest physiology.

---

## 10. Ahead-designed workouts

This is the more interesting feature.

The athlete should be able to ask:

> Give me a session for tomorrow.

But Ahead should **not immediately hallucinate a set of intervals**.

The workflow should be:

```text
COACHING DECISION

What does tomorrow need to accomplish?

        ↓

SESSION REQUIREMENTS

sport
objective
available time
appropriate intensity
recovery/race constraints

        ↓

WORKOUT SELECTION

Is there already a suitable library workout?

   YES → select/adapt it
   NO  → construct one

        ↓

DETERMINISTIC VALIDATION

duration
intensity distribution
estimated load
physiology targets
calendar compatibility

        ↓

PROPOSAL

Athlete approves

        ↓

PLAN
```

The AI chooses the coaching intention.

Backend code constructs and validates the actual prescription.

---

## 11. AI responsibilities

Ahead AI may decide:

> Tomorrow should be aerobic rather than another specific session.

It may decide:

> 60 minutes available, maintain aerobic capacity, low cost before Sunday's race.

It can then request something like:

```json
{
  "sport": "cycling",
  "objective": "aerobic_endurance",
  "duration_minutes": 60,
  "intensity_ceiling": "z2",
  "reason": "maintain aerobic work without adding meaningful race-week strain"
}
```

The workout engine can either find:

> **Easy endurance · 60m**

or generate one from approved workout primitives.

The LLM should **not calculate athlete HR zones, watts, training load or threshold values itself.**

Those come from Ahead.

---

## 12. Coach-designed workout output

Example conversation:

**You**

> I have 50 minutes tomorrow. Sunday is the race. What should I do?

**Ahead**

> You already have enough specific work this week. I’d use the time for easy aerobic riding and a few short openers rather than another hard session.

### Tomorrow · Race preparation

**45 min · Cycling**

```text
10m easy
20m steady aerobic
3 × 15s race-speed pickup
2m easy between
remaining time easy
```

**Why this session**

Maintain aerobic work, touch race speed briefly, and keep the overall cost low before Sunday.

**Estimated load**

24–30

**Add to plan**

That is significantly more useful than:

> Here's a VO₂ workout!

---

## 13. Selection before generation

Ahead should strongly prefer:

```text
existing suitable workout
        ↓
adjust existing workout
        ↓
generate completely new structure
```

This keeps the workout universe coherent.

If six athletes ask for:

> 45-minute race-week aerobic session

Ahead does not need six essentially identical AI-created workouts.

The workout library gradually becomes Ahead's **coaching vocabulary**.

---

## 14. Library provenance

Each workout should know where it came from.

Possible labels:

```text
Ahead
Ahead · adapted
Yours
```

Do not make generated workouts look magically authoritative.

Internally:

```ts
source_type:
  library
  coach_generated
  athlete_created

parent_workout_id?: UUID
```

If Ahead adjusts an existing workout:

```text
Original:
5 × 5 Threshold · 60m

Adapted:
4 × 5 Threshold · 50m

Reason:
Race in four days
```

Keep the lineage.

---

## 15. Generated workouts should not automatically pollute the library

If Ahead makes:

> 42-minute aerobic ride because Jason only has 42 minutes today

that does not need to become a global reusable workout.

It can exist as a one-off prescription.

Offer:

**Save as workout**

if the athlete wants to keep it.

Global Ahead library workouts should be curated separately.

---

## 16. Workout builder

Athletes should eventually be able to construct workouts themselves.

V1 can be simple:

```text
+ Warm-up
+ Interval
+ Recovery
+ Repeat
+ Cool-down
```

Each step supports:

* duration;
* distance;
* target;
* label.

Workout graph updates live.

This gives Ahead a common editing interface whether the workout originated from:

* library;
* athlete;
* Ask Ahead;
* Coach Review.

---

## 17. Workout visualisation

The graph shown in the screenshot is useful because you can understand the shape of a workout instantly.

Ahead should render a generic **effort profile**.

X-axis:

> workout progression

Y-axis:

> intended relative intensity

Do not label the Y-axis as `%FTP` unless the workout genuinely uses FTP.

For example, the display can map internally:

```text
Recovery       1
Easy           2
Aerobic        3
Tempo          4
Threshold      5
High intensity 6
Sprint         7
```

This is **visualisation only**.

The real prescription remains HR/power/pace/RPE/etc.

That lets the same graph represent:

* running;
* cycling;
* an HR-based athlete;
* a power-based athlete;
* a beginner using RPE.

---

## 18. Planned load

A workout may show:

> **Estimated load 54–62**

rather than falsely claiming:

> Load 58.

The estimate should be calculated by Ahead from the prescription.

Confidence depends on what is known.

For example:

**High**

* reliable threshold;
* precise intensity targets;
* duration known.

**Moderate**

* HR zone prescription;
* stable athlete physiology.

**Low / unavailable**

* mostly RPE;
* skills session;
* open-ended duration;
* insufficient athlete physiology.

Once completed, estimated load is replaced by actual derived load from the recorded activity.

Never treat planned load as completed load.

---

## 19. Planned vs actual

This is where structured workouts become especially valuable to Ahead.

After completion:

```text
PLANNED

60m
45m aerobic
3 × 15s race pace
Estimated load 28

ACTUAL

62m
47m aerobic
3 pickups detected
Load 30
```

Activity Insight can then say:

> **This session did what it was supposed to do.**
>
> Duration and overall intensity were close to prescription. The short pickups added little additional cost.

Or:

> **This became a different session.**
>
> You were prescribed easy aerobic work but spent 24 minutes near threshold. That matters because Sunday's race is two days away.

This is a substantial product advantage.

---

## 20. Relationship with Coach Review

Coach Review should not merely produce:

> Do more aerobic work next month.

It should be able to turn the strategy into actual sessions.

Example:

### Next block

**Objective**

Maintain aerobic capacity while using weekly racing for specific intensity.

**Session pattern**

Monday
Recovery / skills

Wednesday
Aerobic endurance

Friday
Race opener

Sunday
Race

**Build next block**

Ahead then selects or creates the actual workout prescriptions.

So:

```text
Coach Review
    ↓
block strategy
    ↓
session objectives
    ↓
structured workouts
    ↓
calendar
    ↓
completed activities
    ↓
Activity Insight
    ↓
next Coach Review
```

That closes the loop extremely nicely.

---

## 21. Race workouts

A race itself is **not a workout template**.

Keep race events separate.

But Ahead can create workouts around them:

* pre-race opener;
* warm-up;
* post-race recovery;
* between-race aerobic maintenance.

For a scheduled race:

```text
SAT
Ahead · Race opener · 25m

SUN
Race · Eastern CX R4
```

The result and race activity remain linked to the race event, not to some `"CX Race 45m"` workout template.

---

## 22. Youth athletes

The workout engine must receive age context.

It must not simply take an adult workout:

> 6 × 5 min threshold

and prescribe the same thing to a nine-year-old because duration happens to fit.

Age group should be part of the generation/selection context:

```text
child
adolescent
adult
```

and appropriate coaching rules should operate before the LLM.

For younger athletes especially, Ahead should favour:

* shorter structured efforts;
* skills;
* play/race-like work;
* age-appropriate total duration;
* existing coached/club sessions;
* avoiding unnecessary formal intensity accumulation.

This belongs in deterministic coaching constraints/product knowledge, not something the model improvises every time.

---

## 23. Database

Suggested entities:

```text
workout_definitions
id
owner_type
owner_id
sport
name
description
objective
steps_json
source_type
parent_workout_id
version
visibility
created_at
updated_at
```

```text
planned_workouts
id
athlete_id
calendar_item_id
workout_definition_id nullable
workout_snapshot_json
resolved_targets_json
physiology_snapshot_json
estimated_load_min
estimated_load_max
estimated_load_confidence
coaching_reason
created_by
created_at
```

The **snapshot is critical**.

If the reusable definition is edited three months later, the historical calendar must still show what the athlete was actually prescribed.

---

## 24. Initial Ahead library

Do not launch with 400 workouts.

Start with perhaps **30–50 excellent primitives** across cycling and running.

Enough to cover common coaching intents:

* recovery;
* easy;
* endurance;
* tempo;
* threshold;
* high intensity;
* progression;
* race prep/openers.

Then Ahead adapts them.

The value is not:

> **Ahead has 2,000 workouts.**

The value is:

> **Ahead knows which one makes sense now.**

---

## 25. MVP

For first release, build:

1. Vendor-neutral structured workout schema.
2. Ahead-curated workout library.
3. Workout cards + profile graph.
4. Workout detail.
5. Add workout to calendar.
6. Athlete-specific target resolution.
7. Estimated planned load.
8. Ask Ahead can select an existing workout.
9. Ask Ahead can adapt duration/repetitions of an existing workout.
10. Structured workout snapshot on planned session.
11. Activity Insight gets planned prescription for comparison.

**Do not require for MVP:**

* exporting workouts to watches;
* community/shared workouts;
* marketplace;
* AI inventing arbitrary new workout structures;
* complex drag-and-drop builder;
* Garmin/COROS workout sync.

---

## 26. Phase 2

Once the system proves itself:

**Coach-generated workouts**

Ahead can construct workouts from validated primitives when no library workout fits.

**Workout builder**

Athlete can create/edit their own.

**Save adaptation**

> Save this as one of my workouts.

**Workout learning**

Ahead can understand historical response:

> You've completed this workout four times.

> The same threshold session now produces less HR drift.

And eventually:

**Device delivery**

Canonical Ahead workout → Garmin/COROS/etc adapter.

But that is intentionally downstream of the vendor-neutral workout model.

---

## 27. Success criterion

The feature should make this interaction possible:

> **“I have 45 minutes tomorrow and race Sunday. What should I do?”**

Ahead knows the block, recent work and race.

It decides:

> **low-cost aerobic + brief race-speed exposure**

It finds or creates:

> **Race-week endurance · 45m**

The athlete sees the actual workout, why it was chosen, expected cost and where it fits.

They approve it.

Afterwards Ahead knows what was prescribed, what happened, whether the session fulfilled its purpose, and can use that evidence in the next Coach Review.

That is the important difference from the workout grid in the screenshot: **the grid is useful infrastructure, but choosing the right workout becomes part of Ahead's coaching system.**
