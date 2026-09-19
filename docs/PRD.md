# Product Requirements Document

**Product:** Potential (working name)
**Type:** Endurance training platform
**Status:** Draft v0.4
**Date:** 18 September 2026
**Owner:** Founder / product
**Primary surfaces:** Web app (desktop-first, mobile-capable)
**UI system:** Radix UI primitives, custom visual design
**Backend:** Supabase (Auth, Postgres + RLS, Storage, Edge Functions, Realtime)

---

## 1. Summary

Potential is a training platform for endurance athletes who want to plan, record, and *understand* their training in one place.

It occupies the same category as TrainingPeaks, Intervals.icu, and Stride: a calendar of planned and completed sessions, load and fitness tracking, and activity analysis. It is not a social network (Strava) and not a marketplace of generic plans.

The product thesis is:

> Serious athletes do not lack data. They lack a private, trustworthy interpreter of that data — one that can also act.

Two things must be first-class, not bolted on:

1. **A training calendar** that is the system of record for planned sessions, completed activities, races, rest, and life constraints.
2. **Potential AI** — the conversational interface to the athlete’s training history, athlete model, and calendar. Spec: [PRD-potential-ai.md](./PRD-potential-ai.md).

The assistant is not a FAQ bot and not a generic coaching LLM. It is a grounded agent over the athlete’s own records, with tools that read and write the same objects the calendar uses. New conversation ≠ new athlete.

---

## 2. Problem

Endurance athletes currently split their training life across three incomplete tools:

| Need | Typical tool | Gap |
| --- | --- | --- |
| Log and share activities | Strava | Weak planning, weak load management, noisy social layer |
| Follow a plan / work with a coach | TrainingPeaks | Expensive, dated UX, athlete is a recipient of workouts, interpretation is coach-dependent |
| Deep analysis | Intervals.icu | Excellent for power users; steep, chart-first, little narrative understanding |
| Adaptive AI plans | Stride / Runna-class apps | Plan generation is strong; self-understanding and calendar agency are shallow or opaque |

What athletes actually ask, repeatedly:

- “Am I fitter than last month, or just more tired?”
- “Why did Tuesday feel terrible when the numbers look fine?”
- “I have a wedding Saturday — rewrite the week.”
- “What should I do tomorrow given my HRV, sleep, and the race in 11 days?”
- “Show me whether my long runs are actually making me more durable.”

Today those questions require a coach, a spreadsheet, or an hour inside Intervals.icu. Potential answers them in conversation, then writes the resulting decision onto the calendar.

---

## 3. Product principles

1. **The calendar is the product.** Every feature either puts something on the calendar, explains something already on it, or measures what happened against it.
2. **Explain before prescribe.** The assistant must show *why* before it changes training. Citations to the athlete’s own sessions, wellness, and goals are mandatory for coaching claims.
3. **The athlete stays in control.** The bot can propose calendar writes. The athlete confirms. Undo is always available for agent actions.
4. **Honest physiology, not magic.** Fitness, fatigue, and form are trend models, not performance oracles. The product never claims to diagnose injury, illness, or overtraining as a medical fact.
5. **Accessible by default.** Radix primitives for all overlays, menus, dialogs, and form controls. Custom calendar and charts must still be keyboard-operable and screen-reader labelled.
6. **Privacy is a feature.** Health and training data never trains public models. Conversations are private to the athlete unless they explicitly share.
7. **Ship a sharp athlete product first.** Coaching business, plan marketplace, and team features wait until a single athlete can run their season on Potential alone.

---

## 4. Goals and non-goals

### 4.1 Launch goals (12 months)

- An endurance athlete can plan a week, complete sessions, see load and fitness, and have a useful conversation about it without leaving Potential.
- The chatbot can create, reschedule, and delete training sessions on the calendar as a first-class workflow.
- Core activity data arrives from **Garmin, COROS, Polar, and/or FIT upload** so the product is usable on day one without depending on Strava.
- Design quality is visibly above TrainingPeaks; analysis quality is credible next to Intervals.icu for the metrics we choose to own.

### 4.2 Non-goals (v1)

- Coach dashboards, athlete billing, or a plan marketplace
- Live GPS recording / in-workout audio coaching
- Indoor virtual worlds (Zwift competitor)
- Social feed, kudos, clubs, or leaderboards
- Clinical recovery, medical diagnosis, or physiotherapy
- Supporting every endurance sport on day one
- Pixel-perfect clone of TrainingPeaks PMC trademarks or Intervals.icu custom-scripting

---

## 5. Users

### 5.1 Primary: self-coached endurance athlete

Age roughly 25–55. Training 4–12 hours/week. Owns a Garmin, Wahoo, Coros, Apple Watch, or similar. Has used Strava. May have tried TrainingPeaks or Intervals.icu and bounced off complexity, cost, or loneliness of the data.

Jobs to be done:

- Know what to do this week
- Know whether the plan is working
- Adjust when life, illness, or fatigue intervenes
- Arrive at an A-race fit and fresh, not just “trained a lot”

### 5.2 Secondary (post-MVP)

- Athlete with a human coach (shared calendar, comments)
- Small coaching practice (10–40 athletes)
- Multisport athlete (swim/bike/run + strength)

v1 is built so these can land on the same calendar and data model later. Do not build their UI now.

### 5.3 Anti-user (v1)

- People who only want a social running club
- Athletes who will never sync a device or upload a file
- Coaches looking for a TP replacement in month one

---

## 6. Competitive position

| | TrainingPeaks | Intervals.icu | Stride-class | Potential |
| --- | --- | --- | --- | --- |
| Calendar as system of record | Strong | Strong | Medium | Strong |
| Structured workouts | Strong | Strong | Medium | MVP: structured + unstructured |
| Fitness / fatigue / form | Strong (TSS/CTL/ATL/TSB) | Strong, configurable | Lighter | Strong, Banister-style, **non-trademarked names** |
| Activity analysis | Good | Best-in-class | Light | Good, deepen after calendar+chat |
| Human coaching | Core business | Optional | Weak | Later |
| Conversational AI | Weak | None | Plan-centric | **Core: interpret + act** |
| Self-understanding | Coach-mediated | Chart-mediated | Plan-mediated | **Narrative + evidence** |
| UX | Dated | Power-user | Modern | Modern, Radix, calm |
| Price posture | Premium | Free + supporter | Freemium | Freemium (see §16) |

**Differentiation, one sentence:** Potential is the training calendar you can talk to, and that talks back with your own evidence.

Do not compete with Intervals.icu on infinite custom charts in year one. Do not compete with TrainingPeaks on coach workflow. Do not compete with Strava on social. Win on *comprehension plus agency*.

**Legal note:** TrainingPeaks trademarks TSS, IF, NP, CTL, ATL, TSB, and PMC. Potential will implement a Banister impulse-response / fitness-fatigue model and label metrics **Fitness, Fatigue, Form, and Training Load**. Internally we may store `load`, `fitness`, `fatigue`, `form`. We will not use TP’s trademarked names in product copy.

---

## 7. Product shape

Three primary surfaces, always available:

```
┌─────────────────────────────────────────────────────────────┐
│  Home  ·  Calendar  ·  Activity  ·  Insights  ·  You        │
│                                              [Ask Potential]│
├──────────────────────────────┬──────────────────────────────┤
│                              │                              │
│   Context (calendar,         │   Chat (sheet / dock)        │
│   activity, fitness chart)   │   grounded in that context   │
│                              │                              │
└──────────────────────────────┴──────────────────────────────┘
```

The chat can be opened from anywhere. It receives the current page as context (selected day, open activity, visible date range) plus the athlete’s durable profile.

---

## 8. User journeys

### 8.1 First session (activation)

1. Sign up with email or Google.
2. Choose sports (run, ride, swim, strength), typical weekly volume, and next A-goal if any.
3. Connect **Garmin, COROS, or Polar**, or **upload FIT/GPX**, or skip and start from a blank calendar. Strava is an optional overlay and is **not** the source for Ask Potential or Fitness/Fatigue/Form.
4. Optional: 2-minute chatbot onboarding — “What are you training for, and what does a good week look like?”
5. Land on **this week’s calendar**, with either imported history or a proposed first week (explicitly marked as a draft until accepted).

Activation success: at least one planned session on the calendar **and** one completed activity in the account within 24 hours.

### 8.2 Weekly planning

Athlete opens Calendar (week view). They add a long run, two quality sessions, easy days, and a rest day — by click, by duplicating last week, or by asking the chatbot:

> “Build next week around a Saturday 2.5h ride, keep TSS-equivalent load similar to this week, and protect Thursday evening.”

The bot proposes a week. Athlete reviews a diff against the current calendar and accepts all, some, or none.

### 8.3 After a hard session

Activity syncs. Athlete opens it. They see duration, distance, intensity, load, and planned-vs-actual if it was scheduled.

They ask: “I faded after 70 minutes. Was that fitness, fueling, or just heat?”

The bot answers using that activity’s streams (if present), recent similar sessions, wellness that morning, and weather if available. It does not invent missing data.

### 8.4 Life happens

> “I’m wrecked and have a work dinner Thursday. Move quality work to Friday if Form is this negative, otherwise make Thursday a recovery spin and drop Saturday 20 minutes.”

Bot proposes calendar mutations with a preview. Athlete confirms. Undo toast appears.

### 8.5 Race week

Athlete asks whether they are on track. Bot shows Fitness/Fatigue/Form trend into the event, planned load vs typical taper heuristics, and flags missing sessions. It does not guarantee a result.

---

## 9. Functional requirements

Priority: **P0** = MVP, **P1** = soon after launch, **P2** = later.

### 9.1 Accounts and profile

| ID | Requirement | P |
| --- | --- | --- |
| A1 | Email + password and Google OAuth via **Supabase Auth**; session in Next.js via `@supabase/ssr` | P0 |
| A2 | Athlete profile: display name, timezone, units (metric/imperial), date format | P0 |
| A3 | Sport list with per-sport thresholds: FTP (bike), threshold pace (run), LTHR, max/resting HR, weight | P0 |
| A4 | Availability windows (e.g. weeknights after 18:00, long session weekend) | P1 |
| A5 | Equipment (shoes, bikes) with distance/time usage | P2 |
| A6 | Data export (JSON/CSV of activities, calendar, wellness) and account deletion | P0 |

### 9.2 Calendar

The calendar is the system of record.

**Views**

- Week (default, desktop)
- Month
- Agenda / list (default, narrow mobile)
- Day (activity-dense days)

**Event types**

| Type | Examples |
| --- | --- |
| `session` | Planned workout (run, ride, swim, strength, other) |
| `activity` | Completed session, linked or unlinked to a plan |
| `event` | Race, A/B/C priority, travel |
| `note` | Life constraint, illness, travel, “kids home” |
| `rest` | Explicit rest day |

A calendar day can hold multiple items. Planned session and completed activity can be **linked** (planned-vs-actual) or sit side by side if unmatched.

| ID | Requirement | P |
| --- | --- | --- |
| C1 | Create / edit / delete session on a day | P0 |
| C2 | Drag and drop to move a session between days (desktop) | P0 |
| C3 | Duplicate session or copy week forward | P0 |
| C4 | Recurring sessions (e.g. strength Mon/Thu for N weeks) with “this / all future” edit | P1 |
| C5 | Session fields: sport, title, description, planned duration, distance, intensity target, structured steps (optional), planned load, tags | P0 |
| C6 | Color by sport; optional color by intensity | P0 |
| C7 | Week summary: hours, distance by sport, planned load vs completed load | P0 |
| C8 | Link completed activity to planned session (auto by day+sport, manual override) | P0 |
| C9 | Race / event with priority and target | P0 |
| C10 | Weather overlay for next 7 days on the athlete’s location | P2 |
| C11 | ICS export of planned sessions | P1 |
| C12 | Keyboard: arrow between days, Enter opens item, N new session, `?` shortcuts | P0 |

**Session editor**

- Unstructured: title + notes + duration/distance + RPE or intensity
- Structured (P0 basic): steps with duration or distance and a target (power, HR, pace, or RPE). Enough to describe “20min Z2, 5x4min threshold, 15min Z2”.
- Structured advanced (P1): ramp, repeat groups, cadence targets, export to `.fit` / `.zwo`

### 9.3 Activities

| ID | Requirement | P |
| --- | --- | --- |
| T1 | Manual activity entry | P0 |
| T2 | Upload athlete-owned FIT, GPX, TCX — one file or a zip of files. First-class ingest, not a COROS-only path. Intelligence-eligible. | P0 |
| T3 | Strava import as **optional display overlay only**. Never intelligence. Never LLM context. Never Fitness/Fatigue/Form. Requires written Strava approval to change this. | P2 |
| T4 | Activity detail: map (if GPS), summary stats, splits or laps, notes | P0 |
| T5 | Time-series charts for power, HR, pace, elevation, cadence when streams exist | P0 |
| T6 | Planned vs actual comparison when linked | P0 |
| T7 | Garmin Connect **Activity API**: ingest completed activities + FIT files. No Connect IQ app. Apply to the developer program immediately. | P0 |
| T7b | COROS: ingest completed training (self-service OAuth first; Partner API later) | P0 |
| T7c | Polar AccessLink: ingest training sessions | P0 |
| T7d | Apple Health via a Potential iPhone app. Amazfit/Zepp piggybacks here — no public Zepp cloud activity API. | P1 |
| T8 | Interval detection and interval table | P1 |
| T9 | Power / pace duration curve (season and 42-day) | P1 |
| T10 | Best efforts / PRs by sport | P1 |

v1 analysis bar: an athlete looking at a ride or run should understand intensity, load contribution, and whether it matched the plan. Intervals.icu-depth interval science is P1+.

### 9.4 Load, fitness, fatigue, form

Use a Banister-style exponentially weighted model on daily training load.

- **Training Load** of a session: prefer power-based when a power stream and FTP exist; else HR-based; else pace-based; else duration × RPE estimate. Surface which method was used.
- **Fitness:** EWMA of daily load, default time constant 42 days
- **Fatigue:** EWMA, default time constant 7 days
- **Form:** Fitness − Fatigue (previous-day convention, documented)

| ID | Requirement | P |
| --- | --- | --- |
| L1 | Compute daily load and Fitness / Fatigue / Form from **intelligence-eligible** activities only | P0 |
| L2 | Chart on Insights and optionally under the calendar | P0 |
| L3 | Per-sport load and combined load (configurable) | P1 |
| L4 | Planned future load dashed on the same chart | P0 |
| L5 | Athlete-visible explanation of the model, assumptions, and limits | P0 |
| L6 | Configurable time constants | P2 |

Copy must say these are **trend indicators**, not race-day predictions.

### 9.5 Wellness / “how I am”

Canonical spec: [PRD-wellness.md](./PRD-wellness.md).

Imported recovery (sleep, HRV, resting HR, stress) is already on `wellness_days` / `daily_recovery`. That is not Wellness. Wellness is the human layer the watch cannot see.

**v1 is a contextual data-capture system, not an interpretation dashboard.** Morning check-in from a fixed catalogue. Each item has a temporal scope (previous day / overnight / this morning). **Everything normal** writes usual defaults, not “healthy,” and does not tick routines. Missing ≠ explicitly-normal. Ask Ahead must distinguish logged fact, assumed routine, and missing. Analysis and any homepage (“What seems to matter” vs trajectory) wait until people are logging.

| ID | Requirement | P |
| --- | --- | --- |
| W1 | Catalogue check-in + usual-day defaults + Everything normal | P0 |
| W2 | Answers stored with temporal scope (not one yesterday blob) | P0 |
| W3 | Routines (assume true, no daily ticks) and dated Events | P0 |
| W4 | Ask Ahead: logged vs assumed vs missing; never invent | P0 |
| W5 | Dashboard/calendar: missing ≠ explicitly-normal | P0 |
| W6 | Own-data associations (~60 days); homepage TBD from data | P1 |
| W7 | Experiments; custom questions | P2 |

### 9.6 Insights (non-chat)

A page for people who want to see, not ask:

- Fitness / Fatigue / Form
- Weekly hours and load, trailing 6–12 weeks
- Consistency (planned sessions completed)
- Simple narrative cards generated on a schedule: “This week vs last week”, “Load is rising faster than Fitness”

| ID | Requirement | P |
| --- | --- | --- |
| I1 | Fitness chart + weekly totals | P0 |
| I2 | Consistency / adherence | P0 |
| I3 | Auto weekly summary (also emailed optionally) | P1 |

### 9.7 Ask Potential

Canonical spec: [PRD-potential-ai.md](./PRD-potential-ai.md). Summary requirements:

| ID | Requirement | P |
| --- | --- | --- |
| B1 | Ask Potential on every page; New chat clears the thread only | P0 |
| B2 | Ground answers in the athlete’s data; refuse to invent streams, wellness, or calendar items | P0 |
| B3 | Tools: period summaries, comparisons, calendar, activities, wellness, load / Potential series | P0 |
| B4 | Propose structured calendar ops: create / update / delete / move / rest / race / block | P0 |
| B5 | Writes require a confirmation card before Apply | P0 |
| B6 | Cite sources (activity IDs, dates, metrics) inline | P0 |
| B7 | UI context: visible week, open activity, current route | P0 |
| B8 | Athlete memory independent of threads; relevance retrieval; decision memory | P0 |
| B9 | Safety: medical disclaimer; escalate away from diagnosis; no disordered-eating coaching | P0 |
| B10 | Streaming responses; concrete session prescriptions, not generic prose | P0 |
| B11 | Voice input | P2 |
| B12 | Proactive “something changed” surfaces | P2 |

### 9.8 Coach Review

Canonical spec: [PRD-coach-review.md](./PRD-coach-review.md).

Ask Ahead stays day-to-day. Reviews has two cadences: a deterministic weekly note (what landed) and a Terra Coach Review (~4 weeks) that sets the next block. Persist reviews on the athlete. The monthly coach must see stated goals and A-races beyond the next 42 days. Near-term CX does not rewrite a July half. Do not expose model names. Weekly does not reset the monthly clock. Dashboard only prompts for Coach Review when it is ready. Fitness up is stimulus, not proof. Do not invent a prior block objective. Do not queue missed reviews. Titles such as CX or opener are not races. Immediate weekend advice is separate from the next-block objective.

| ID | Requirement | P |
| --- | --- | --- |
| CR1 | Dedicated “Coach Review is ready” entry; athlete starts it | P1 |
| CR2 | Structured review: intent → what happened → did it work → lessons → next block | P1 |
| CR3 | Persist review + evidence snapshot + coaching decisions | P1 |
| CR4 | Strategy before calendar; existing proposal/apply model | P1 |
| CR5 | Follow-ups stay in Ask Ahead; review does not restrict daily coaching | P1 |
| CR6 | Weekly review is deterministic, 7-day, no next-block strategy | P1 |

### 9.9 Notifications

| ID | Requirement | P |
| --- | --- | --- |
| N1 | In-app + optional email: today’s session, missed planned session, activity processed | P1 |
| N2 | Chat follow-up: “Yesterday’s long run is in — want a recap?” | P1 |

---

## 10. Chatbot specification

Canonical spec: **[PRD — Potential AI](./PRD-potential-ai.md)**.

Potential AI is not a chatbot bolted onto a training app. It is the conversational interface to the athlete’s training history, athlete model, and calendar. UI name: **Ask Potential**. New conversation ≠ new athlete.

The remainder of this section is a pointer, not a second spec. Implementation follows the Potential AI PRD: OpenAI Responses + `gpt-5.6-terra`, Edge Function `potential-ai`, Potential-owned `athlete_memories`, structured calendar proposals, confirmation via `apply-calendar-proposal`. Platform constraints in this document still bind: user-JWT tools, no Strava in intelligence, no silent calendar writes, no medical diagnosis.

**Canonical metrics:** Ask Potential must read headline Potential / Fitness / Fatigue / Form from the same `daily_loads` rows the dashboard Today cards use, already rounded for display. It must never recalculate those numbers inside the model or a chat tool.

---

## 11. Information architecture

### 11.1 Navigation

- **Home** — today, next session, Form sparkline, wellness prompt, last activity
- **Calendar** — planning surface
- **Library** — (P1) reusable workouts
- **Insights** — charts and summaries
- **Activity** — opened from calendar or list; not a top-level dump
- **You** — profile, thresholds, integrations, billing, data export
- **Ask** — chat dock / sheet

### 11.2 Objects (logical model)

```
Athlete
  Profile, Sports[], Thresholds[], Integrations[]
  Goal / Event[]
  WellnessDay[]
  CalendarItem[]        # session | event | note | rest
    StructuredWorkout?
    linked Activity?
  Activity[]
    Streams, Laps, Map, Load, Analysis
  DailyLoad[]           # derived
  Conversation[]
    Message[], ToolCall[], CalendarDiff[]
```

---

## 12. UX and Radix UI

### 12.1 Design intent

Calm, dense enough for a week of training, not a dashboard of widgets. Light and dark. Desktop is the planning environment; phone is for “what’s today”, check-in, and chat.

Avoid TrainingPeaks’ visual noise and Intervals.icu’s “settings for everything” first impression. Power can exist one click down.

### 12.2 Why Radix

Radix provides accessible, unstyled primitives. Potential owns visual design; Radix owns interaction correctness (focus trap, keyboard, ARIA).

**Use Radix for:** Dialog, Alert Dialog, Popover, Tooltip, Hover Card, Dropdown Menu, Context Menu, Navigation Menu, Tabs, Accordion, Collapsible, Select, Checkbox, Radio Group, Switch, Slider, Toast, Toggle, Toggle Group, Scroll Area, Separator, Avatar, Progress, Toolbar, Slot.

**Recommended stack:** React + Radix Primitives (or Radix Themes if we want a faster first visual system), Tailwind CSS, a thin internal component layer (shadcn-style wrappers around Radix are acceptable if we treat them as *our* design system, not a theme we cannot leave).

### 12.3 What Radix does not give us

Radix has **no Calendar primitive**. The training calendar is custom:

- Grid of days with stacked items
- Drag-and-drop (dnd-kit or equivalent)
- Context menu on items and empty days (Radix Context Menu)
- Click empty day → Popover or Dialog for new session
- Item open → Dialog (session editor) or sheet on mobile
- Keyboard grid navigation we own; announce selection via live region

Date pickers inside forms: compose Radix Popover + a small date grid, or a dedicated date library with accessible grid semantics. Do not use a native `<input type="date">` as the only calendar.

Charts: a dedicated chart library (e.g. visx, Recharts, or Canvas for streams). Not Radix. Charts need titles, axis units, legends, and a text alternative (table or summary).

Chat: custom message list + Radix Scroll Area, Dialog/Sheet for mobile, Alert Dialog for destructive calendar applies.

Command palette (P1): `cmdk` or equivalent, not Radix.

### 12.4 Key interaction specs

**New session**

- Empty day click / `N`: Popover anchored to the day (desktop); Drawer/Dialog (mobile)
- Fields in one screen; structured builder as an optional section
- Save keeps you on the calendar

**Chat + calendar**

- Desktop: chat as a right dock, 360–420px, calendar remains interactive
- Mobile: chat as a full-height sheet
- Applying a diff highlights affected days for ~2s

**Accessibility**

- WCAG 2.2 AA on all P0 flows
- Calendar items have names like “Tuesday 22 Sep, planned run, Threshold 8x400, 55 minutes”
- Do not rely on color alone for sport or intensity
- Reduced-motion: skip drag animations and chart tweens

---

## 13. Technical direction

Supabase is the backend. There is no second application database and no separate auth vendor. Next.js is the web app (SSR, Radix UI). Chat orchestration is a **Supabase Edge Function**. All durable state lives in Supabase.

### 13.1 Stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Web | Next.js (App Router) + TypeScript | Marketing + authenticated app |
| UI | Radix + Tailwind + internal components | See §12 |
| Auth | **Supabase Auth** | Email/password + Google. Cookie session via `@supabase/ssr` |
| Database | **Supabase Postgres** | Source of truth. Generated types via `supabase gen types` |
| Authorization | **Row Level Security** | On from migration 1. `athlete_id = auth.uid()` |
| Files | **Supabase Storage** | Original FIT/GPX and compressed stream blobs; bucket RLS |
| Secrets | **Supabase Vault** + project secrets | Garmin / COROS / Polar / optional Strava tokens, LLM keys never in the client |
| Jobs | **Edge Functions** + `pg_cron` / queue | Parse FIT, Garmin/COROS/Polar ingest, load recompute. Heavy FIT parse must not block the request path |
| Realtime | **Supabase Realtime** (`postgres_changes`) | Calendar + activity status so chat applies and uploads appear live |
| AI | OpenAI Responses API, default `gpt-5.6-terra` | Called only from Edge Function `potential-ai`. Luna for memory extraction. See [PRD-potential-ai.md](./PRD-potential-ai.md) §16 |
| Types | Official Supabase TS client | Database types checked in; no hand-rolled API layer for CRUD |

### 13.2 Responsibility split

**Supabase owns**

- Identity (`auth.users`) and athlete profile
- Calendar, activities, wellness, load series
- Conversations, athlete memory, calendar proposals
- File blobs
- RLS as the security boundary
- Webhooks and background work (Edge Functions), including Potential AI
- Realtime fan-out after writes

**Next.js owns**

- Rendering and Radix UI
- Marketing pages

The Ask Potential dock streams from `supabase.functions.invoke("potential-ai")`. CRUD for calendar, wellness, and profile goes **browser → Supabase** with the user session (RLS). Do not proxy every read through Next.js. Calendar **Apply** goes to `apply-calendar-proposal`, not through the model.

The LLM never gets the **service role** key. Chat tools open a Supabase client with the **user access token**, so a prompt cannot read another athlete.

**Service role** is allowed only in trusted jobs: Garmin/COROS/Polar ingest, FIT parse, load recompute, admin export. Those jobs still write rows owned by a specific `athlete_id`. Strava jobs, if they exist, must not write intelligence-eligible load.

### 13.3 Physical model (Postgres)

Logical objects in §11.2 map to tables. Every athlete-owned table includes `id uuid`, `athlete_id uuid not null references profiles(id)`, timestamps, and RLS.

| Table | Purpose |
| --- | --- |
| `profiles` | `id` = `auth.uid()`. Timezone, units, display name, location (optional) |
| `athlete_sports` | Enabled sports |
| `thresholds` | Per-sport FTP, threshold pace, LTHR, HR rest/max, weight; effective-dated |
| `goals` | A/B/C events, target date |
| `calendar_items` | Planned session or race. Day, sport, title, duration, `planned_load`, `workout` JSON (prescribed structure), `created_by` (`athlete` \| `potential_ai`), `linked_activity_id` |
| `workout_structure` | PotentialWorkout JSON (not a Garmin/COROS/Apple payload). Translators live in application code. |
| `activities` | Canonical **PotentialActivity**. `source` + `source_activity_id`. Observations (HR, power, pace, duration, elevation, laps). `load` / `intensity` computed by Potential. Vendor metrics in a metadata jsonb only. `intelligence_eligible` generated from source. |
| `activity_laps` | Device or computed laps |
| `wellness_days` | One row per athlete per date |
| `daily_loads` | Derived. Date, load, fitness, fatigue, form, formula version |
| `integrations` | Provider, status, scoped tokens (encrypted). Never select tokens from the client |
| `ingestion_jobs` | Queue: pending / running / failed / done |
| `conversations` | Chat threads (short-term). New chat clears these only |
| `messages` | Role, content, citations jsonb |
| `athlete_memories` | Durable facts / preferences / constraints / decisions. Independent of threads |
| `calendar_proposals` | Structured ops pending Apply. `potential-ai` writes these; never writes `calendar_items` |
| `agent_actions` | Audit of applied calendar diffs (undo) |

**Storage buckets** (all private except marketing assets):

- `activity-originals` — FIT / GPX / TCX
- `activity-streams` — downsampled gzip JSON or similar; not 1Hz in a `jsonb` column
- `avatars` — optional

**Do not** store full GPS/power traces in Postgres rows. Summaries and load live in `activities`; streams live in Storage and are fetched only for the activity detail page or a chat deep-dive.

### 13.4 RLS (non-negotiable)

Policies for athlete data, in words:

- `select` / `insert` / `update` / `delete` where `athlete_id = auth.uid()`
- `profiles`: user can read/update only `id = auth.uid()`
- Storage: object path prefixed by `athlete_id`; policy matches `auth.uid()`
- `integrations`: client may read `provider` and `status` only — **not** token columns (column grants or a view)
- Service-role jobs bypass RLS; they must set `athlete_id` explicitly and never take it from untrusted webhook JSON without verifying the connected account

Coach sharing is **out of v1**. Do not weaken RLS with “if a coach flag then all rows”. When coaching exists, it will be an explicit membership table and new policies.

Enable RLS on every public table before the table is used in the app. CI should fail if a new table is created with RLS off.

### 13.5 Auth

- Supabase email + password and Google provider
- Next.js middleware refreshes the session (`@supabase/ssr`)
- Signup trigger: `on auth.users created` → insert `profiles` row
- Password reset and magic-link via Supabase-hosted templates, branded
- Account deletion: delete Storage objects, then `auth.admin.deleteUser` so cascade (or explicit purge function) removes athlete rows. Product requirement A6.

OAuth for **Garmin, COROS, Polar, and (optional) Strava** is not Supabase Auth. It is an integration: Edge Function starts OAuth, stores tokens in `integrations`, encrypts via Vault. Strava tokens, if ever stored, may only be used for display-only sync.

### 13.6 Ingestion pipeline

1. Client uploads to `activity-originals`, **or** a Garmin / COROS / Polar sync job runs. Strava is not the default ingest path.
2. Insert `ingestion_jobs` + a **PotentialActivity** row (`source`, `source_activity_id`, observations). Vendor training-load fields go in `vendor` metadata — they do not become `load`.
3. Worker (Edge Function, or a Node worker if FIT parse exceeds Edge CPU/memory/time limits) reads the file or provider payload, parses, writes stream blob, updates summary columns.
4. Attempt link to `calendar_items` on that local date + sport.
5. `recompute_daily_load(athlete_id, from_date)` — SQL function, incremental, deterministic, versioned. **Only intelligence-eligible activities** (not `source = strava`) enter this recompute, using **Potential** load.
6. Realtime notifies the calendar; optional chat prompt “activity ready” only for intelligence-eligible rows.

Recompute must be **SQL-side** so chat tools and the UI never diverge. Same inputs → same Fitness series.

If Edge Function limits bite on long FIT files, keep the job table in Supabase and run parse on a small Node worker that still uses the service role against the same project. Do not move the database.

### 13.7 Potential AI on Supabase

Canonical spec: [PRD-potential-ai.md](./PRD-potential-ai.md) §16.

1. Browser invokes Edge Function `potential-ai` with `{ conversationId, message, uiContext }`. OpenAI key lives in Supabase secrets, never the client.
2. Function verifies the user JWT and opens a **user-scoped** client. Do not use the service role for athlete reads.
3. Compact context + relevant `athlete_memories` go to **OpenAI Responses** (`gpt-5.6-terra`). Deeper history is tool-fetched. Tools are TypeScript/SQL helpers — the LLM does not write SQL. **`get_activity` / search / load series must exclude `source = strava`**.
4. `propose_calendar_changes` inserts `calendar_proposals`. The UI shows Apply. `apply-calendar-proposal` is the only function that mutates `calendar_items`.
5. Persist `conversations` / `messages` under RLS. After the thread idles, `extract-ai-memory` (Luna) may write durable memories.

Logging of prompts and tool traces: separate table with RLS (athlete can read own; operators use service role in a locked-down internal tool). Retention cap.

### 13.8 Realtime

Subscribe to `calendar_items`, `activities.status`, and `daily_loads` for the signed-in athlete. This is how a chat “Apply” from the dock updates the week grid without a full refetch, and how an upload flips from processing → ready.

Auth-scoped channels only. No public calendar channel.

### 13.9 Local development

- `supabase start` + `supabase db reset` for schema
- Seed a fixture athlete for chatbot golden tests
- Never commit `.env` with the service role key or `OPENAI_API_KEY`
- Migrations in `supabase/migrations`; no dashboard-only schema changes after Phase 0

---

## 14. Integrations

The only ingest question: **can Potential legally and technically receive completed activity data?**

```
device → vendor cloud → Potential
              ↓
     PotentialActivity
              ↓
     Potential load / fitness / fatigue / form
              ↓
     Ask Potential
```

Potential does **not** send workouts back to Garmin, COROS, or Amazfit. The calendar the athlete talks to is Potential’s calendar.

Never store a “Garmin activity” as the system of record. Importers translate:

```
GarminActivity | COROSActivity | PolarSession | FIT file
        ↓
PotentialActivity
```

Once it is inside Potential, the source is almost irrelevant. Observations (HR, power, pace, duration, elevation, laps, GPS, cadence) drive **Potential** load, intensity, fitness, fatigue, and form. Vendor interpretation metrics (`garmin_training_effect`, `coros_training_load`, `polar_cardio_load`) are metadata only. The training model must not change because the athlete changed watch.

### 14.1 Hard constraint: Strava is not the intelligence layer

Strava API Policy effective **1 June 2026** (§5.3, §5.4, §5.5, §3.5, §5.10): no API data (or derivatives) in an AI application, including a model context window; no analytics; no persistent index; MCP is personal use; no transfer to an AI provider even with consent.

`isIntelligenceSource('strava') === false` is a code gate. Do not use Garmin → Strava → Potential as the primary ingest.

### 14.2 MVP ingest

| Platform | Ingest completed workouts? | Route | Intelligence | MVP |
| --- | ---: | --- | --- | --- |
| **Garmin** | ✅ | Connect **Activity API** (+ FIT file) | Yes | **Yes** |
| **COROS** | ✅ | OAuth now; Partner API later | Yes | **Yes** |
| **Polar** | ✅ | AccessLink | Yes | **Yes** |
| **FIT / GPX / TCX upload** | ✅ | Athlete-owned file, or a zip of files. Independent of Garmin / COROS / Polar. | Yes | **Yes** |
| **Apple Watch** | ✅ | HealthKit via iPhone app | Yes | Later |
| **Amazfit / Zepp** | ⚠️ No public cloud activity API | Apple Health, once iOS exists | Yes, via Apple | Not first-class |
| **Strava** | Technically yes; policy blocks AI/analytics | Strava API | **No** | Overlay only |
| Wahoo / Suunto | later | vendor cloud | Yes | Later |

Connect page:

> Connect your training
>
> Garmin · COROS · Polar · Upload FIT
>
> Strava (optional overlay)
>
> More coming soon — Apple Health (Amazfit via Health)

Apply to the **Garmin Connect Developer Program** immediately. Use the Activity API, not a Connect IQ app, not the Training API (we are not pushing structured workouts to the watch). Program access has no general licensing fee; business approval is required.

COROS self-service is the fastest watch proof; Partner API later for multi-user OAuth, webhooks, daily health, FIT downloads. Polar AccessLink is a straightforward OAuth2 session ingest.

### 14.3 Amazfit

Zepp documents on-watch APIs, not `Connect Amazfit → OAuth → GET /users/activities` for a SaaS. Do not list Amazfit as a first-class integration. Fallback once an iPhone app exists:

```
Amazfit → Zepp → Apple Health → Potential
```

### 14.4 Calendar Apply

Chat diffs update **Potential’s** calendar only. The watch is not a write target in this architecture.

---

## 15. Non-functional requirements

| ID | Requirement |
| --- | --- |
| NF1 | Calendar week view interactive in <100ms after data is local; first load of a week <1.5s p95 on broadband |
| NF2 | Activity detail with streams usable within 3s of open for a 5h ride |
| NF3 | Chat time-to-first-token <2s p50; mutating tools complete <1s after confirm |
| NF4 | 99.9% monthly uptime for app + ingestion |
| NF5 | Encryption in transit; encryption at rest (Supabase-managed Postgres + Storage) |
| NF6 | GDPR export/delete. **Host the Supabase project in an EU region** (e.g. London or Frankfurt) unless a later decision says otherwise |
| NF7 | WCAG 2.2 AA on P0 flows |
| NF8 | `agent_actions` audit log of proposed and applied calendar writes; athlete-visible undo |
| NF9 | Offline: not required for MVP; phone should still show cached “today” if we add a PWA later |
| NF10 | RLS enabled on all athlete tables and Storage buckets; no service-role key in the browser bundle |

---

## 16. Privacy, safety, compliance

- Training, wellness, and chat are **personal health-adjacent data**. Default private. Enforced with Supabase RLS, not “hidden” UI routes.
- Do not use athlete content to train foundation models.
- Clear medical disclaimer in onboarding, chat empty state, and Settings.
- Chat safety layer: injury/chest-pain/eating-disorder prompts get a refusal + “see a professional” path, no improvisation.
- Age: 16+ for v1 (or 13+ with no chat — decide before launch; chat + health data is a poor mix for children).
- If we ever sell to coaches, tenant isolation is a new RLS membership model — not a service-role hole.
- Strava, Garmin, COROS, Polar, and LLM credentials live in Vault / Edge secrets, never `NEXT_PUBLIC_*`.

This is not a medical device. Do not market HRV or Form as clinical.

---

## 17. Monetization (direction)

Not a pricing memo. For scope control:

| Tier | Idea |
| --- | --- |
| Free | Calendar, manual + upload, last 30 days of analysis, limited chat turns |
| Potential | Unlimited history, Garmin/COROS/Polar/FIT sync, Fitness chart, full chat with calendar writes, structured workouts on Potential’s calendar |
| Later: Coach | Seats, shared calendars |

Chat is the paid wedge. Do not empty the free tier so far that nobody reaches the “aha” of a rewritten week.

---

## 18. Success metrics

### 18.1 Product

| Metric | Why | Early target (directional) |
| --- | --- | --- |
| Activation: planned session + completed activity in 24h | Empty calendars do not retain | ≥40% of signups |
| W7 retention (came back in week 7) | Training products die after novelty | Track; aim ≥25% of activated |
| Weekly active athletes with ≥3 sessions logged or planned | Habit | Leading indicator |
| Chat: % of conversations that apply ≥1 calendar write | Agency, not novelty chat | ≥20% of chats that discuss planning |
| Chat thumbs-up / groundedness eval pass rate | Quality | Eval ≥80% on golden set before launch |
| Time-to-plan a week (new vs returning) | UX | Qualitative + session recordings |

### 18.2 Counter-metrics

- Chat mutation revert rate (too high = untrustworthy agent)
- Support tickets: “bot invented a workout I didn’t want”
- Sync failure rate

---

## 19. Phased delivery

### Phase 0 — Foundations (weeks 1–4)

Supabase project in EU, Auth (email + Google), `profiles` trigger, RLS-backed `calendar_items`, Next.js + `@supabase/ssr`, Radix design system, `supabase/migrations` in CI, deploy pipeline.

### Phase 1 — MVP athlete (weeks 5–14)

- Week/month calendar, drag-drop, week copy
- Manual activities + FIT/GPX upload
- Garmin Activity API ingest (once approved)
- COROS ingest
- Polar AccessLink ingest
- Load + Fitness/Fatigue/Form chart (Potential load on intelligence-eligible sources only)
- Wellness check-in
- Ask Potential against [PRD-potential-ai.md](./PRD-potential-ai.md) MVP table: period retrieval, athlete memory, confirmed calendar diffs
- Activity detail with basic streams
- Export/delete account

**MVP launch criterion:** a self-coached cyclist or runner can live on Potential for four weeks without another planning tool.

### Phase 2 — Depth (post-MVP)

Apple Health + Amazfit-via-Health, Wahoo, interval detection, power/pace curves, workout library, weekly email recap, ICS out. Strava display overlay only if still useful and still compliant. Pushing structured workouts to watches is out of this architecture.

### Phase 3 — Coaching and teams

Shared calendar, comments, coach roster. Only after Phase 1 retention is real.

---

## 20. Risks

| Risk | Mitigation |
| --- | --- |
| Chat that hallucinates load or invents sessions | Tools + confirmation + eval set + “I don’t have that data” |
| Service role used in the browser or in chat tools | User-JWT clients for all athlete CRUD; CI grep for leaked keys |
| FIT parse exceeds Edge Function limits | Job table in Supabase; fall back to a small Node worker, same DB |
| RLS off on a new table | Migration checklist + automated test that a second user cannot read athlete A | 
| Strava API Policy (1 June 2026) forbids using API data to operate an AI app or for analytics | Do **not** use Strava as the intelligence or load layer. Filter `source = strava` out of chat tools and `daily_loads`. Garmin + COROS + Polar + FIT are the primary pipes. |
| TP trademark / look-alike metrics | Original names, original copy, original chart design |
| Scope explosion into Intervals.icu | Freeze analysis to P0 list until calendar+chat retain |
| Health-data liability | Disclaimers, safety layer, no diagnosis |
| Calendar UX is hard | Steal interaction patterns, not visuals; prototype week view early |
| AI cost at scale | Terra not Astra; Luna for extraction; tools instead of dumping history; cap free turns |
| Empty-inbox problem (no data) | Onboarding must get *some* history or a draft week onto the calendar |

---

## 21. Open questions

1. **Brand:** keep “Potential” or rename before public use?
2. **Sports at MVP:** run+ride only, or swim+strength from day one?
3. **Answered:** Ingest is Garmin Activity API + COROS + Polar + FIT. No watch write-back. Strava overlay only. Amazfit is not first-class; Apple Health later.
4. **Structured workouts:** how complete before we call MVP done?
5. **Answered:** Potential AI uses OpenAI Responses (`gpt-5.6-terra` default) from Edge Function `potential-ai`. See [PRD-potential-ai.md](./PRD-potential-ai.md) §16. Remaining: prompt residency vs EU Supabase project.
6. **Age gate and whether minors can use the product without chat**
7. **Do we generate a first training week automatically**, or only on request?
8. **Location for weather / timezone** — profile field vs browser?
9. **Mobile:** responsive web vs iOS in year one?
10. **Coaching:** is it a 2027 business line or a distraction to ignore in messaging?
11. **FIT parse runtime:** stay on Edge Functions, or a Node worker against the same Supabase project if files are large?

---

## 22. MVP scope checklist

Ship when all of the following are true:

- [ ] Sign up, profile, units, thresholds (Supabase Auth + RLS `profiles`)
- [ ] RLS: second user cannot read athlete A’s calendar, activities, or chat
- [ ] Week calendar: create, edit, delete, drag, copy week (direct Supabase client)
- [ ] Session can be unstructured or basic structured
- [ ] Race/event on calendar
- [ ] Manual activity + FIT/GPX + Garmin / COROS / Polar ingest
- [ ] Activities stored as PotentialActivity; vendor load is metadata only
- [ ] Activity `source` recorded; Strava rows cannot enter chat context or load recompute
- [ ] Link planned ↔ completed
- [ ] Daily wellness
- [ ] Training load + Fitness / Fatigue / Form chart
- [ ] Activity detail with map + primary streams
- [ ] Ask Potential: grounded Q&A, period compare, athlete memory across chats, confirmed calendar writes + undo ([PRD-potential-ai.md](./PRD-potential-ai.md) §15)
- [ ] Radix-based accessible overlays and forms
- [ ] Dark/light, week view usable at 1280px and 390px
- [ ] Account export and delete
- [ ] Safety copy and chat refusals for medical queries
- [ ] Golden-set eval passing for chatbot

Everything else is a later conversation.

---

## 23. Appendix A — Example chatbot transcripts (normative tone)

**Athlete:** Why am I so flat on Thursdays?

**Potential:** In the last six weeks you have five Thursday sessions. Four of them sit after a Wednesday evening ride of 90+ minutes, and your wellness sleep that night averaged 6.1h versus 7.4h on other nights. Load isn’t the outlier — Wednesday→Thursday recovery is. I would not add more Thursday intensity. I can move next Thursday’s intervals to Friday and put a 40-minute spin Thursday instead. Apply?

**Athlete:** I think I have a stress fracture. What should I delete?

**Potential:** I can’t diagnose a stress fracture. If you have focal bone pain that worsens with impact, that’s a clinician and usually time off running. I can clear run sessions from the calendar and leave cycling/strength if you want a holding pattern — but the medical call is not mine.

---

## 24. Appendix B — Glossary (product language)

| We say | Means | We do not say |
| --- | --- | --- |
| Training load | Session stress from duration × intensity | TSS® |
| Intensity | How hard relative to threshold | IF® unless citing TP |
| Fitness | Slow EWMA of load (~42d) | CTL® |
| Fatigue | Fast EWMA of load (~7d) | ATL® |
| Form | Fitness − Fatigue | TSB®, PMC® |
| Session | Planned work | Workout (ok as synonym) |
| Activity | Completed, with or without device data | — |
| Ask Potential | The assistant UI | AI Coach, doctor |
| Athlete memory | Durable facts, preferences, constraints, decisions — independent of a chat thread | A new athlete every conversation |

---

*End of PRD v0.4. Backend: Supabase. Potential AI: [PRD-potential-ai.md](./PRD-potential-ai.md).*
