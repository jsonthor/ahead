# PRD — Ahead Wellness

**Status:** Build  
**Product:** Ahead  
**Area:** Wellness  
**Audience:** Existing Ahead users  
**Primary question:** **What was different — and did it matter for me?**

## Principle

> **Wellness v1 is a contextual data-capture system, not an interpretation dashboard. Build high-quality longitudinal observations first. Analysis comes after enough observations exist.**

Do not replace the journal with another HRV dashboard. Do not invent a Health Score. Do not build Health Trajectory first.

The loop:

> **Wearable = what happened physiologically.**  
> **Check-in = what was different in real life.**  
> **Ahead = did those things appear to matter for me?**

Training already answers *is the work working?* (Direction, Readiness, load).  
Wellness is the human layer the watch cannot see.

---

## 1. The gap

COROS already lands sleep, HRV, resting HR, and stress on `wellness_days` / `daily_recovery`. That feed can say:

> Your HRV was lower this week.

It usually cannot say **what was different**. Alcohol, late caffeine, stress, illness, late meals, supplements, medication, soreness, mood, travel, bedtime routine — the watch does not see these.

Without a human layer, Wellness is prettier recovery charts. People will read a falling resting HR as “my lifestyle is working” the same way they used to read rising Fitness as “training is working.”

---

## 2. Invariant

> **Missing = unknown.**

A day with no check-in is not normal. It is not healthy. It is not “everything no.”  
Ask Ahead and any later analysis must keep three things separate:

| Kind | Means | Example |
| --- | --- | --- |
| **Logged fact** | The athlete answered this Daily item | “You logged alcohol on 12 evenings.” |
| **Assumed routine** | A routine was in force; no daily observation | “Creatine was an active routine during this period.” |
| **Missing** | No check-in that day | “You didn't complete a check-in on 9 days.” |

Never turn an active routine into “you definitely took this every day.”

The UI must keep **missing** and **explicitly-normal** visually different. That distinction is load-bearing.

---

## 3. Two journals, three context types

1. **Changes / experiments** — “I stopped caffeine after 2pm on 4 August.” Later.  
2. **Daily check-in** — the day-to-day variance needed for associations. **MVP.**

```
DAILY
Varies frequently. Written as observations with a temporal scope.
Alcohol, mood, stress, soreness, late caffeine

ROUTINE
Assume true until changed. No daily adherence rows.
Medication, supplements, diet pattern, bedtime target

EVENT
Something happened. Dated, not a daily question.
Illness, travel, injury, new job, holiday
```

If someone wants to test magnesium night-by-night, **“Magnesium last night?”** is a Daily catalogue item. That is not the same as a Routine named magnesium.

---

## 4. Temporal scope

The morning check-in is one UI. Storage must not dump every answer onto “yesterday.”

Every Daily item has a scope:

> **Previous-day behaviours** are attributed to the previous local calendar day.  
> **Morning state** is attributed to the current local calendar day.  
> **Overnight behaviours** are associated with the sleep episode ending on the current day.

Saturday morning:

| Answer | Belongs to |
| --- | --- |
| Alcohol yesterday: Yes | **Friday** (`previous_day`) |
| Energy: Low | **Saturday morning** (`current_morning`) |
| Soreness: High | **Saturday morning** (`current_morning`) |
| Late meal | Sleep episode ending Saturday (`overnight`) |
| Wearable sleep | Friday night → Saturday (`overnight`, import) |

Associations later compare like with like. Mixing Friday alcohol into Saturday’s row will corrupt that.

---

## 5. Daily item catalogue

v1 is a **fixed catalogue**. Athletes toggle items on or off. No free-text custom questions.

Custom questions (“Felt weird?”) have no datatype, no scope, and no outcome relationship. That comes later.

Each catalogue item:

```ts
type WellnessTemporalScope =
  | "previous_day"
  | "overnight"
  | "current_morning";

type WellnessDailyItem = {
  key: string;
  label: string;
  valueType: "boolean" | "ordinal" | "number";
  options?: string[];
  temporalScope: WellnessTemporalScope;
  defaultValue?: unknown;
  category: "behaviour" | "symptom" | "recovery" | "mood";
};
```

Default-on set:

| Key | Type | Scope |
| --- | --- | --- |
| Alcohol | boolean | previous_day |
| Late caffeine | boolean | previous_day |
| Late meal | boolean | overnight |
| Energy | Low / Normal / High | current_morning |
| Mood | Low / Normal / High | current_morning |
| Soreness | None / Some / High | current_morning |
| Illness | No / Maybe / Yes | current_morning |
| Stress | Low / Normal / High | current_morning |

Optional catalogue (toggle on). Expand to ~20–30 supported items, all with a defined scope — e.g. screen before bed (`overnight`), magnesium last night (`previous_day` or `overnight`), nasal congestion, headache, travel day. Do not add an item without `temporalScope` and `valueType`.

Sleep-focused athletes turn on alcohol, caffeine, late food, screen, bedtime. Recovery-focused athletes turn on soreness, illness, stress, energy. Same catalogue, different subset.

Do not copy WHOOP’s full daily questionnaire. Do not prefill Daily answers from Routines.

---

## 6. Morning check-in (MVP)

After overnight recovery has had a chance to land (sleep sync, then the check-in — not 6am).

**Morning check-in · about 10 seconds**

Show only enabled catalogue items. Optional one-line note.

### Everything normal

One large tap. Most days are this.

It means **use my configured usual/default answers**, not “everything healthy” and not “all behaviours = No.”

If someone usually has two drinks, their usual for Alcohol is Yes. That is the default. Surprising if undocumented; correct for analysis.

The first time they configure the journal, ask:

> **What does a normal day look like?**

Save those values as `defaultValue` on each enabled item.

> **Everything normal writes the configured Daily defaults only. It does not create routine-adherence observations. Active routines remain assumed active unless changed or interrupted.**

It is not a skip. A skip leaves the day unknown.

### Surfaces and states

The Dashboard card is primary. Do not wait to notice a gap only when they happen to open it — the card has a clear state whenever yesterday’s previous-day behaviours (or this morning’s state, as designed) are unlogged:

| State | Copy |
| --- | --- |
| Missing | **Yesterday isn't logged** · **Check in · ~10 sec** |
| Logged, including via Everything normal | **Yesterday logged** |

Not naggy. Missing and explicitly-normal stay visually different.

Also: calendar day marker (logged vs not). Settings: which catalogue items, usual answers, routines. Phone is the check-in environment; desktop uses the same card.

---

## 7. What this is for (later)

After enough days (target ~60) Ask Ahead can talk about **their** associations:

> **Late caffeine**  
> On 18 days with caffeine after 14:00, sleep averaged 27 minutes shorter and bedtime 34 minutes later.  
> Moderate evidence · other factors may contribute.

> **Alcohol**  
> HRV averaged 9% lower the morning after alcohol; resting HR averaged 4 bpm higher.  
> Strong association in your data.

> **Magnesium** (only if it was a Daily item, not a Routine)  
> Logged on 42 of the last 56 nights. No meaningful difference in sleep, HRV, or resting HR.

Do not commit Health Trajectory as the eventual headline. After three months the homepage may simply be:

> **What seems to matter**  
> Alcohol — sleep ↓28m · HRV ↓7%  
> Late caffeine — sleep onset +31m  
> High stress — RHR +3bpm  
> Creatine routine — no detectable difference  

That is more valuable than **Health: Improving**. MVP data lets us decide. Do not invent the score now.

---

## 8. Phasing

### MVP — ship this

| ID | Requirement |
| --- | --- |
| WL1 | Fixed catalogue (~20–30). Toggle on/off. No custom questions. Every item has type + temporal scope. |
| WL2 | First-run: **What does a normal day look like?** stores usual defaults. |
| WL3 | Morning check-in: enabled items + optional note. |
| WL4 | **Everything normal** writes usual Daily defaults only. Not a dismiss. Not routine ticks. |
| WL5 | Storage attributes each answer by `temporalScope` (not one “yesterday” blob). |
| WL6 | Routines: start date, assume true, prompt only on change. No adherence observations. |
| WL7 | Events: illness, travel, injury — dated. |
| WL8 | Dashboard + calendar states: missing ≠ explicitly-normal. |
| WL9 | Ask Ahead reads check-ins, routines, and events. Distinguishes **logged fact**, **assumed routine**, and **missing**. Never invents. Never promotes a routine to a daily fact. |
| WL10 | Wearable recovery stays a separate import. Do not mix it into the check-in form. |

### After people are actually logging

| ID | Requirement |
| --- | --- |
| WL11 | Dated experiments (“stopped caffeine after 2pm on 4 August”) |
| WL12 | Own-data association cards (~60 days; say when evidence is thin) |
| WL13 | Decide the Wellness homepage from the data — “What seems to matter” and/or trajectory. Do not pre-commit the badge. |
| WL14 | Athlete-authored custom questions |

### Not in v1

- Direction / Readiness / Fitness copy or scores  
- Another HRV / recovery dashboard sold as Wellness  
- WHOOP-style “report everything every day”  
- Custom free-text questions  
- Writing routine adherence as daily facts  
- Treating blank wearable fields as poor recovery  
- A Health Score or Health Trajectory badge  

---

## 9. Data (intent)

Keep vendor recovery (`wellness_days`, `daily_recovery`) import-only.

A check-in is a session. Answers are dated observations.

- `wellness_checkins` — athlete, **session local date** (the morning they filled it), `everything_normal`, note  
- `wellness_answers` — check-in, `item_key`, **`attributed_date`**, `temporal_scope`, value  
- `wellness_item_prefs` — enabled keys + usual `defaultValue`  
- `wellness_routines` — type, label, started_on, ended_on. Assumed active. No child rows per day.  
- `wellness_events` — type, start, optional end, note  
- Later: `wellness_experiments`

Saturday morning check-in produces Friday-dated alcohol and Saturday-dated energy. Analytics join wearable overnight sleep (ending Saturday) to overnight and previous-day behaviours as the item metadata specifies.

Ask Ahead tools expose answers with `attributed_date` and `temporal_scope`. Missing check-in → unknown.
