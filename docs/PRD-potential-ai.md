# Product Requirements Document — Potential AI

**Product surface:** Potential AI  
**UI name:** Ask Potential  
**Parent:** [PRD.md](./PRD.md) (calendar, ingest, load, Potential metric, privacy, RLS)  
**Status:** Draft v0.2  
**Date:** 18 September 2026  
**Owner:** Founder / product

This document is the source of truth for the assistant. Platform rules in the parent PRD still apply: the calendar is the system of record, writes require confirmation, intelligence never uses Strava, tools run as the athlete, and Potential AI is not a doctor.

---

## 1. Product summary

**Potential AI is not a chatbot bolted onto a training app. It is the conversational interface to the athlete’s training history, athlete model, and calendar.**

It should know what you have done, know what has previously been discussed, understand what is currently planned, answer questions across arbitrary periods, and be able to propose changes to the calendar. Most importantly, **the athlete should not have to re-explain themselves every new conversation**.

Potential AI is a persistent training assistant for endurance athletes. It can:

- understand an athlete’s historical and current training
- answer questions about specific activities, periods, trends, and changes
- explain Potential metrics and why they moved
- compare periods of training
- assess what has gone well or poorly
- recommend individual sessions or blocks of training
- create, move, edit, and remove planned sessions on the Potential calendar
- understand races, seasons, and recurring training
- remember relevant information the athlete tells it across conversations

The user interacts with it through natural language.

It should feel less like:

> “Ask an AI something about exercise.”

and more like:

> **“Ask someone who already knows your training.”**

The landing-page claim this product has to make true:

> **The calendar you can talk to.**

The differentiation is not “Potential has AI.” It is:

> **Potential knows the athlete, knows their history, knows their calendar, and can act on all three.**

---

## 2. Product principle

### The athlete should never have to establish context that Potential already has.

If the user asks:

> Why am I feeling worse this week?

Potential should already know, and retrieve automatically:

- what they trained this week
- what they trained last week
- current Fitness, Fatigue, and Form
- current Potential and its components (Aerobic Reserve, Specific Capacity, Fatigue Suppression)
- recent races
- rest days
- planned sessions
- relevant sleep/recovery data where available
- recurring constraints previously told to Potential

Likewise:

> Compare my training in August with the last four weeks.

should cause Potential to resolve those periods, fetch and compare them, and answer.

The user should not export anything or construct a report first.

**New conversation ≠ new athlete.** Starting a new chat clears the thread. It does not clear training history, calendar, athlete memory, or durable decisions.

### Voice

Potential knows this athlete’s training and answers naturally. It is not an analyst dumping evidence.

Shape of a good period answer:

> **characterise the week → explain what created it → show state change → account for what’s coming next → interpret.**

Gold standard for “how did my week look?”:

> **A hard, race-specific week so far.**
>
> You’ve done **5 sessions, 3h 24m and 242 load**. The bigger thing is the balance: **1h easy and 2h 24m specific**. Most of this week’s riding has therefore been specific work rather than easy aerobic volume.
>
> Monday, Wednesday and Thursday were the main training stress, with Thursday the biggest single session at **80 load**. Tuesday was much easier and Wednesday’s walk added some low-stress movement.
>
> Fitness has moved from **20.4 → 22.5**, but Fatigue has risen faster, leaving **Form at −10.3**. Potential has moved from **57 → 64**, which means the model currently estimates more capacity is expressible despite the accumulated fatigue.
>
> With Lincolnshire CX on Sunday, the hard work for this week is already done. Friday and Saturday should stay low-key so Sunday becomes the week's final quality exposure. The two A-priority Notts and Derby races then follow on 27 September and 3 October.

Rules:

- Never show internal IDs (activity UUIDs, calendar UUIDs). Named events are human objects: “Lincolnshire CX”, “Thursday’s ride”.
- Later, those names become **clickable chips** that open the calendar item or activity — not UUID citations.
- Do not call a week **productive**, a workout **maximal**, or training **good/bad** unless there is enough evidence for that specific claim.
- Do not say **purposeful**. If the mix is intensity-heavy, say it was **specific work rather than easy aerobic volume**.
- For period questions that end in a recommendation, retrieve before answering. Expected tool sequence:

```text
get_training_summary(this_week)
get_current_training_state()
get_calendar(today through Sunday)
get_upcoming_races(next_3_weeks)
```

- Do not repeat every session. Mention the sessions that explain the conclusion.
- Distinguish **observation** from **interpretation**. “242 load” is observed. “Specific-heavy rather than easy-volume-heavy” is interpretation.
- Close as a training interpretation, not orders. Do not write “there’s no need to add another session” or “you should / you must / I wouldn’t add”.
- Never expose implementation language: database IDs, tool names, API sources, calculation internals — unless explicitly asked.
- Conversational by default. Full session breakdown only if they ask to see the detail.

Be careful with Fitness and Potential:

- A Fitness rise is not a **payoff**. Fitness mechanically rises when sufficient load accumulates. Prefer: “That load has moved Fitness from 20.4 to 22.5.”
- Potential increasing does not automatically mean the week worked. It means the model currently estimates more capacity is expressible.

### Canonical metrics

**All AI metric queries must use exactly the same canonical daily-state records as the dashboard. Never recalculate headline metrics inside the AI tool.**

- Source of truth: `daily_loads` (latest actual row on or before the requested date).
- Today’s Potential / Fitness / Fatigue / Form in chat **are** the Today cards.
- Display rounding matches the dashboard: Potential is an integer (`displayPotential`); Fitness, Fatigue, and Form are one decimal, with Form = displayed Fitness − displayed Fatigue.
- `get_current_training_state` returns only that headline row. Calendar and races are separate tools.
- `get_training_summary` may include start/end headline objects from `daily_loads`, already rounded. Period hours/load/easy/specific still come from intelligence-eligible activities — the same inputs as This week — but that aggregation is not a second Potential model.
- Compact context may include the dashboard headline so the model cannot invent a different Potential. It must not dump raw `daily_loads` floats.

The architecture already queries activities, aggregates periods, reads calculated states, and sees upcoming races. The remaining job is a **disciplined voice about what that data does and does not mean**.

---

## 3. Naming

| We say | Means | We do not say |
| --- | --- | --- |
| Potential AI | The assistant as a product capability | AI Coach, Coach AI, doctor |
| Ask Potential | The chat UI, globally available | A separate novelty screen |
| Athlete memory | Durable knowledge independent of a thread | A scrapbook of every utterance |
| Decision memory | Why a plan was changed | Chat logs as a substitute for memory |
| Diary / calendar item | Planned training, race, rest, or note | Workout pushed to a watch |
| Activity | Completed session | — |
| Apply | Athlete confirms a structured calendar diff | Silent writes from prose |
| Terra | Default chat model (`gpt-5.6-terra`) | GPT-6 Astra as everyday chat |
| Luna | Background memory / titles / summaries (`gpt-5.6-luna`) | Using Terra for housekeeping |
| Athlete memory | Rows Potential stores in Postgres | An OpenAI conversation ID |

---

## 4. Core user jobs

| User intent | Example |
| --- | --- |
| Understand current state | “Why has my Potential dropped?” |
| Understand history | “What changed in my training in July?” |
| Compare periods | “Compare the four weeks before Assen with the four weeks after.” |
| Assess progression | “Am I actually getting fitter?” |
| Find patterns | “What was I doing when I was racing best?” |
| Analyse an activity | “What do you think of yesterday’s ride?” |
| Analyse a race | “Why did I fade towards the end?” |
| Ask about training mix | “Am I doing too much intensity?” |
| Get a session | “Give me something for tomorrow.” |
| Get a block | “Plan the next three weeks.” |
| Adapt plans | “I’m exhausted. Change the rest of the week.” |
| Handle life constraints | “I’m in London Thursday so I can’t train.” |
| Schedule training | “Put an easy ride Wednesday and intervals Friday.” |
| Move training | “Move tomorrow’s workout to Saturday.” |
| Remember information | “Wednesday club sessions are always hard.” |
| Use remembered context | “What should I do tonight?” |

---

## 5. Conversation model

Potential AI needs three kinds of knowledge on every turn. They are not interchangeable.

### 5.1 Athlete data (objective)

Held by Potential, queried when needed, never dumped wholesale into every model request:

- Activities (intelligence-eligible sources only)
- Calendar items (planned sessions, races, rest, notes, links to completed work)
- Training load
- Fitness, Fatigue, Form
- Potential, Aerobic Reserve, Specific Capacity, Fatigue Suppression
- Development and Race Readiness when those series exist
- Sleep / recovery where available
- Weekly volume, intensity distribution, consistency

The model interprets structured answers. The backend calculates them.

### 5.2 Athlete memory (durable)

Persistent knowledge Potential has learned about this athlete, independent of any one chat thread. Examples of shape, **not a frozen schema**:

```json
{
  "preferences": {
    "preferred_long_ride_day": "Saturday",
    "likes_club_sessions": true,
    "dislikes_indoor_training": true
  },
  "constraints": {
    "thursday_evening": "usually unavailable",
    "monday": "club training"
  },
  "training_context": {
    "primary_sport": "cyclocross",
    "races_regularly": true,
    "season_structure": "weekly races through autumn"
  },
  "coaching_preferences": {
    "hard_days_per_week": 2,
    "prefers_training_by_hr": true
  }
}
```

Potential must be able to learn new durable information dynamically.

### 5.3 Conversation history (decision memory)

Continuity of reasoning, not just profile facts.

If two weeks ago the athlete said:

> “We decided to reduce Wednesday intensity because Sunday races were suffering.”

and today asks:

> “Should we put the Wednesday intervals back?”

Potential should know what **“put them back”** means and why they were removed.

This is **decision memory**. It is particularly important. Athlete facts (“FTP is 268W”) are not enough.

---

## 6. Memory requirements

Athlete Memory is persistent and **independent from individual chat threads**. A new chat must not mean a new athlete.

### 6.1 Four memory types

| Memory | Example | Typical source |
| --- | --- | --- |
| Athlete fact | “My FTP is 268W.” | Stated, or confirmed from thresholds |
| Preference | “I hate doing intervals indoors.” | Stated, repeated |
| Constraint | “I commute Thursdays.” | Stated, or onboarding / calendar pattern |
| Decision / context | “We reduced Tuesday intensity because I race Sundays.” | A confirmed plan change plus the reason |

Memory is added when something is likely to matter in **future training decisions**.

Transient conversation must **not** automatically become permanent memory.

| Transient (do not persist as memory) | Durable (may persist) |
| --- | --- |
| “I slept badly last night.” | “I normally sleep badly after late shifts on Thursdays.” |
| “My legs feel heavy today.” | “I always feel poor the day after a night race.” |
| “Skip Friday this once.” | “Keep Friday free before Sunday races.” |

Last night’s sleep belongs in current context / daily state, not Athlete Memory.

### 6.2 Memory retrieval

Every AI request should perform a **relevance search** against athlete memory.

The model receives only memories relevant to the current question — not the entire store.

Example: “Plan next Thursday.” might retrieve:

- Thursday is usually a London commute day
- Athlete generally cannot train before 19:00 on Thursdays
- Athlete has previously preferred Thursday easy after Wednesday club training

It should not receive 200 unrelated memories.

Onboarding answers (sports, season, availability, fixed sessions, races, focus) are seed memory. They are not the whole of Athlete Memory.

### 6.3 Memory UX

Do **not** ship a large “AI memory” manager in MVP.

Users still need evidence that Potential remembers them, in the conversation itself:

> I’m treating Wednesday club training as a fixed hard session, as usual.

> You normally keep Friday free before Sunday races.

Later, a small **Athlete context** page can list what Potential has learned, and the athlete can correct it:

- Races most Sundays during CX season
- Monday club session
- Wednesday club session
- Usually wants two hard training days per week
- Friday often used as pre-race recovery

Storing obvious durable context is automatic, with visibility. Changing core athlete settings (units, thresholds, identity) still needs explicit confirmation.

### 6.4 Memory is Potential’s job, not OpenAI’s

Long-term memory must **not** depend on an OpenAI conversation ID, `previous_response_id`, or leftover context tokens.

```text
Short-term context     = current Ask Potential thread (OpenAI Responses can chain turns)
Long-term athlete memory = Potential database
Training truth         = Potential database
Calendar truth         = Potential database
```

That is how Potential remembers forever. Not: hope the model still has enough context tokens.

Memories are rows, for example:

```json
{
  "type": "constraint",
  "content": "Wednesday club training is normally a hard session.",
  "importance": 0.88
}
```

When the athlete asks “What should I do Wednesday?”, Potential runs `search_athlete_memory` and passes only the relevant hits to Terra.

---

## 7. Training-history retrieval

The AI requests training data dynamically. The LLM does **not** calculate everything from thousands of raw activities, and does **not** receive FIT streams unless a deep-dive on one activity is actually required.

Potential’s backend performs calculations and returns structured answers. That is cheaper and more reliable than stuffing files into the context window.

The model never receives the entire history in the prompt. It calls narrow tools. Physiology and period maths stay in Potential code / SQL. **The LLM does not write SQL.**

```text
                       ┌─ get_current_training_state()
                       ├─ get_training_summary()
                       ├─ compare_training_periods()
                       ├─ get_activities()
                       ├─ get_activity()
User → GPT-5.6 Terra ──┼─ get_calendar()
                       ├─ get_races()
                       ├─ get_upcoming_races()
                       ├─ get_wellness()
                       ├─ search_athlete_memory()
                       ├─ save_athlete_memory()
                       └─ propose_calendar_changes()
```

Canonical tool names for MVP:

```text
get_current_training_state
get_training_summary
get_activities
get_activity
compare_training_periods
get_calendar
get_races
get_upcoming_races
get_wellness
search_athlete_memory
save_athlete_memory
propose_calendar_changes
```

`get_potential_history` / `get_load_history` may fold into `get_current_training_state` and `get_training_summary` rather than extra HTTP functions.

`get_activity` / search / load series **must exclude `source = strava`** (and any other intelligence-blocked source). This is a query filter, not a prompt instruction.

Example backend answer the model then interprets:

```json
{
  "period": { "start": "2026-09-14", "end": "2026-09-18" },
  "sessions": 5,
  "duration": "3h 24m",
  "load": 242,
  "easy": "1h",
  "specific": "2h 24m",
  "races": 0,
  "start": { "asOf": "2026-09-14", "potential": 57, "fitness": 20.4 },
  "end": { "asOf": "2026-09-18", "potential": 64, "fitness": 22.5, "fatigue": 32.8, "form": -10.3 }
}
```

`start` / `end` are dashboard-rounded `daily_loads` rows. The model quotes them. It does not derive Potential from the 242 load.

A compact **context packet** still goes on every turn (today, timezone, UI route, **dashboard headline** from `daily_loads`, relevant memories). Calendar, remaining week, and upcoming races are tool-fetched — they are not dumped into the packet. Deeper history is tool-fetched.

---

## 8. Period questions

Periods are a first-class concept. Potential must resolve language into dates, then retrieve.

Understood out of the box:

- last week / this week / next week
- this season
- the last six weeks
- August (and other month names)
- between the two races
- before my injury
- since I started racing
- the four weeks before X
- compare January–March with April–June

Example:

> **“What was different when I was racing better in August?”**

Potential may internally compare August’s race block vs the previous 28 days vs the following 28 days, looking at:

- volume
- load
- easy / specific mix
- race frequency
- rest days
- Fitness, Fatigue, Form
- Potential components

The conversational answer explains the **meaningful** differences, not a dump of every series.

Relative phrases (“this week”, “tomorrow”, “the race”) use the athlete’s timezone and, when present, the visible UI range or open activity.

---

## 9. Calendar actions

This is where Potential becomes more than analytics.

The assistant can propose:

- Create session
- Edit session
- Move session
- Delete session
- Create rest day
- Create race
- Move multiple sessions
- Rewrite a week
- Create a training block

The AI **never silently rewrites** the athlete’s calendar.

Homepage rule, binding here:

> **Explain first. Prescribe second. Confirm always.**

Example:

> I’m exhausted and have dinner Thursday. Fix the week.

Potential:

> Your Fatigue has risen from 24 to 39 over the last five days and Wednesday already contains a hard club session. I’d avoid another quality day Thursday.
>
> I suggest making Thursday rest and moving the threshold session to Saturday.

Then a structured diff:

```diff
Thu 24
- Threshold 5×5
+ Rest

Sat 26
+ Threshold 5×5
```

The chat message answers **why**. The proposal card answers **what will change**. Do not put the justification inside the proposal object.

Pending sessions appear **ghosted on the calendar** behind the chat until Apply (they become normal entries) or Dismiss (they disappear).

After Apply, the chat does not add another paragraph. The card becomes:

> **3 sessions added to your calendar.**
> Tue 22 · Thu 24 · Sat 26
> **Undo**

Created sessions store the prescribed workout (warm-up / main / finish / cool-down), expected load, intensity, purpose, and `created_by = potential_ai`, so clicking the calendar entry shows what to do. Follow-ups like “Why 5×4?” or “Make Tuesday shorter” refer to that same object.

**Apply changes.** Nothing happens until Apply. Undo reverses the last applied proposal.

Races and future training are the same kind of planned event. After the athlete completes the work, the completed activity is linked so the calendar knows that was the race or the session.

Calendar mutations are **structured operations**, not parsed from assistant prose:

```json
{
  "operations": [
    {
      "type": "move_session",
      "sessionId": "abc",
      "from": "2026-09-24",
      "to": "2026-09-26"
    },
    {
      "type": "create_session",
      "date": "2026-09-24",
      "session": {
        "type": "recovery",
        "durationMinutes": 40
      }
    }
  ]
}
```

The athlete approves the operation set. Watch write-back is out of scope; Potential writes Potential’s calendar only.

`propose_calendar_changes` **stores a proposal**. It does not mutate `calendar_items`. Apply is a separate authenticated function (`apply-calendar-proposal`) that checks ownership, expiry, and that the target sessions have not changed underneath the proposal.

The chat agent (`potential-ai`) must not write the calendar.

If the athlete says “just do it,” still show the confirmation card in MVP (always-on for deletes and for changes spanning more than one day).

---

## 10. Session recommendations

Recommend **actual sessions**, not generic prose.

Bad:

> Consider doing some threshold training.

Good:

> **Threshold 4×8**
>
> 15 min easy  
> 4 × 8 min at threshold  
> 4 min easy between  
> 10 min cooldown  
>
> Approx. 65 min · expected load 72

Then the athlete can say “Put that Wednesday,” and Potential creates a proposed calendar diff.

Recommendations must be athlete-specific. “What should I do tomorrow?” is never answered from the question text alone when relevant data exists.

Before recommending, Potential checks — and for a week question the tool sequence is:

```text
get_training_summary(this_week)
get_current_training_state()
get_calendar(today through Sunday)
get_upcoming_races(next_3_weeks)
```

That is: last 7–14 days / this week, current Potential and FFF from `daily_loads`, remaining calendar, upcoming races, remembered constraints.

It may still recommend a 60-minute Z2 ride, but **for an athlete-specific reason**, framed as interpretation of what is already on the calendar rather than an order.

Any recommendation must be explainable from the athlete’s data. “Why?” must not invent a justification afterwards.

> I suggested easy training because you’ve had three quality exposures in six days, including Sunday’s race, while your recent easy volume has fallen.

Significant claims should be able to point at sources (Sunday race, Wednesday intervals, weekly summary). **Tappable chips** come after MVP: named calendar objects (`Lincolnshire CX`, `Notts and Derby`, `Thursday’s ride`), never UUIDs. Clicking a chip opens that event or activity.

---

## 11. Chat UI

Do not make this a separate novelty screen called AI Coach.

Call it **Ask Potential**. Available from every signed-in screen.

The calendar is especially important: the athlete can ask while looking at a week.

> Make this week easier.

The assistant automatically receives UI context:

```text
current screen = Calendar
visible dates = Sep 21–27
```

While an activity is open:

> Was this too hard?

Potential knows **this** is that activity.

Desktop: right dock, calendar remains interactive.  
Mobile: full-height sheet.

Empty state does **not** say “Ask anything.” Use athlete-relevant suggestions from current context, for example:

**Your training** — Why has my Fitness increased this month?  
**This week** — Is there too much intensity here?  
**Next race** — How should I train between now and Sunday?  
**History** — Compare the last four weeks with the four before.

After an activity: **Analyse today’s ride.**

A **New chat** control clears the thread only.

Named races and sessions in replies are **human objects**. After MVP they render as chips that open the calendar item or activity.

A pending proposal is a visual calendar diff: ghosted sessions on the dates that would change, with **Apply changes** / **Dismiss** in the dock. After Apply, a short confirmation and **Undo** — not another assistant paragraph.

---

## 12. Write permissions

| Capability | Permission |
| --- | --- |
| Read training data | Automatic |
| Read athlete memory | Automatic |
| Calculate / compare data | Automatic |
| Recommend training | Automatic |
| Draft calendar changes | Automatic (`propose_calendar_changes`) |
| Write calendar changes | **Requires confirmation** via `apply-calendar-proposal` |
| Undo last applied proposal | **Undo** on the confirmation card (`undo-calendar-action`) |
| Delete / move existing sessions | **Requires confirmation** |
| Store obvious durable athlete context | Automatic, with visibility |
| Change core athlete settings | Explicit confirmation |

Read tools inside `potential-ai` run with the **athlete’s JWT** (RLS). The model never receives the service role key. Do not use the service-role client for ordinary athlete-data retrieval just because the code is already on the server. Reserve privileged access for narrowly controlled jobs (ingest, load recompute), never for chat.

---

## 13. Safety and honesty

Inherited from the parent PRD, restated because this surface is where they fail:

- No diagnosis of injury, illness, RED-S, or cardiac issues. Escalate to a clinician. A holding-pattern calendar (clear runs, keep cycling) is allowed if the athlete asks.
- No promised race times.
- No certainty when data is missing. Say what is missing.
- No moralizing body weight or food except general fueling at athlete request.
- Do not invent streams, sessions, or load.
- Medical disclaimer in the chat empty state.

---

## 14. Proactive intelligence (not MVP)

Eventually Potential should not require the athlete to know which question to ask. Surface interesting changes, then let them investigate:

> **Something changed**
>
> Your easy volume has fallen for three consecutive weeks while race-specific work has increased.

Then: **Ask Potential**.

Prefer that over generic push copy such as “Your Training Readiness is 64.”

Out of MVP. Do not block v1 on it.

---

## 15. MVP

Potential AI v1 is constrained. It must do these things exceptionally well:

| MVP capability | Requirement |
| --- | --- |
| Current-state questions | Understand current Potential, FFF, and the week |
| Historical questions | Retrieve arbitrary date ranges |
| Period comparison | Compare two periods with backend summaries |
| Activity analysis | Explain an individual workout from summary data |
| Training recommendations | Recommend concrete sessions, grounded in this athlete |
| Calendar context | See planned and completed sessions; use visible UI range |
| Calendar actions | Propose creates / moves / edits / deletes / rest / races |
| Confirmation | Athlete applies a mechanical calendar card; ghosts on the grid; Undo after Apply |
| Prescribed sessions | Creates store structure, expected load, purpose; calendar entry shows the workout |
| Athlete memory | Persist relevant context across chats; relevance-retrieve |
| Decision memory | “Put the Wednesday intervals back” still makes sense |
| Data grounding | Answers based on Potential data where relevant |
| Canonical metrics | Headline Potential/FFF match the dashboard `daily_loads` cards; never recomputed in the model |
| New chat | Clears thread only; athlete is unchanged |

v1 does **not** need to automatically coach an entire season.

### Non-goals for v1

- Watch / device workout push
- Voice input
- A full memory-management console
- Proactive “something changed” notifications
- Using FIT streams as the default context (summaries first; streams only for a requested deep-dive)
- Strava as intelligence or load
- Silent calendar writes, including after “just do it,” for deletes and multi-day rewrites
- GPT-6 Astra (or Sol) as the default chat model
- A multi-model router before real conversations exist — **start with Terra alone for the chatbot**
- Long-term memory stored only as OpenAI conversation state
- Letting the LLM write SQL
- Dumping months of raw activities into every request
- The chat Edge Function writing `calendar_items` directly

### Launch bar

If the MVP table works, the homepage line is real: **the calendar you can talk to.**

A good answer is specific to this athlete, explicit about missing data, short by default, and actionable when asked for action.

A bad answer is a generic zone-2 sermon, a hallucinated FTP, or a rewritten mesocycle nobody asked for.

---

## 16. Architecture

The frontend is a streaming chat UI. The Edge Function is the agent. Postgres is memory and training/calendar truth.

The current Next.js `/api/chat` route (Anthropic-first, `profiles.assistant_memory` jsonb) is a prototype. Replace it with this architecture rather than extending it.

Do **not**:

```text
User → giant prompt containing entire athlete history → GPT
```

Do:

```text
Potential web app
      ↓
supabase.functions.invoke("potential-ai")
      ↓
authenticate user (JWT)
      ↓
load conversation + relevant memories + compact UI context
      ↓
OpenAI Responses API  (gpt-5.6-terra)
      ↓
model requests tools
      ↓
deterministic TS / SQL (user-scoped client)
      ↓
OpenAI writes final answer
      ↓
stream response to UI
```

The browser sends a message and conversation id — **not** activities, memories, metrics, or the calendar. The backend knows the athlete from the authenticated session.

```ts
const { data, error } = await supabase.functions.invoke("potential-ai", {
  body: {
    conversationId,
    message: "Why has my Potential fallen this week?",
    uiContext: { route, visibleDates, activityId }
  }
})
```

### 16.1 Three Edge Functions (MVP)

One orchestration function, not a swarm of tiny AI endpoints. Ingest (COROS/Garmin/Polar) stays independent.

| Function | Job |
| --- | --- |
| `potential-ai` | Conversation, tool loop, streaming. **Read tools + proposals only.** |
| `apply-calendar-proposal` | Confirmed calendar mutations. Verifies owner, expiry, and that sessions have not drifted. |
| `extract-ai-memory` | Background: Luna inspects a finished (or idle) thread and writes durable `athlete_memories`. |

Physiology calculations do **not** live in `potential-ai`. They live in the same deterministic helpers / RPCs the rest of the app uses.

### 16.2 OpenAI Responses API

```ts
const response = await openai.responses.create({
  model: "gpt-5.6-terra",
  reasoning: { effort: "medium" }, // low for simple Q&A / moves; medium for analysis / planning
  input: [
    { role: "system", content: POTENTIAL_SYSTEM_PROMPT },
    { role: "user", content: message }
  ],
  tools: [
    getCurrentTrainingStateTool,
    getTrainingSummaryTool,
    compareTrainingPeriodsTool,
    getCalendarTool,
    searchAthleteMemoryTool,
    proposeCalendarChangesTool
  ]
})
```

Live-thread continuity may use `previous_response_id` (or Responses conversation state). That is **short-term only**.

If the model calls `compare_training_periods`, the Edge Function runs Potential’s comparison and returns structured numbers. Terra interprets. Example:

> “Was August better training than the last four weeks?”

The model asks for two periods. The backend returns hours, load, easy/specific mix, races. The model’s job is the sentence that follows.

Streaming: yes.

### 16.3 Models

| Job | Model | When |
| --- | --- | --- |
| Normal Potential chat | **GPT-5.6 Terra** (`gpt-5.6-terra`) | Default, MVP |
| Training analysis / recommendation | **GPT-5.6 Terra** | Default |
| Calendar planning and tool calls | **GPT-5.6 Terra** | Default |
| Particularly difficult season analysis | **GPT-5.6 Sol** (`gpt-5.6-sol`) | Later, selective |
| Memory extraction / titles / summaries / intent | **GPT-5.6 Luna** (`gpt-5.6-luna`) | Background, from day one of memory extraction |

Do **not** start with **GPT-6 Astra** as the normal chat model. It is OpenAI’s highest-capability model at this writing ($10/M input, $50/M output — 5× Terra input, >4× Terra output). Potential does not need frontier reasoning to answer “What did I do last week?” or “Move my endurance ride to Friday.”

The important intelligence is **excellent tools and excellent athlete context**.

Do not build a clever multi-model router in v1. Start with **Terra alone for the actual chatbot**. After real conversations exist, route the questions Terra struggles with to Sol (Astra later).

Reasoning effort: **low** for straightforward conversation and simple tool use; **medium** for training analysis and planning.

Terra: 1.05M context, function calling, structured outputs, $2/M input, $12/M output (standard, as of this draft). Luna: $0.20/M input, $1.20/M output. Sol: $4/M input, $20/M output.

A substantial Terra turn of ~10k input + 1k output is on the order of **$0.03** before caching. That makes a **£10–15/month** Potential subscription plausible **if** we do not shovel months of raw training data into every request. Luna housekeeping is pennies on the dollar.

The moat is not “we use GPT-6.” It is: GPT knows what happened six months ago, remembers why Wednesday changed, compares periods properly, and can alter next week’s calendar when asked.

### 16.4 Schema (AI-owned tables)

Existing `conversations` / `messages` stay the thread store. Add:

```text
athlete_memories
----------------
id
athlete_id
type                 -- fact | preference | constraint | decision
content
confidence
importance
source_conversation_id
created_at
updated_at
superseded_at
```

```text
calendar_proposals
------------------
id
athlete_id
conversation_id
operations           -- jsonb, structured ops
rationale
status               -- pending | applied | dismissed | expired
created_at
applied_at
expires_at
```

`agent_actions` remains the audit/undo log of **applied** diffs.

Onboarding (`profiles.onboarding`) is live context, not a substitute for `athlete_memories`. Copy durable onboarding answers into memory; keep the profile as source of units/thresholds.

`profiles.assistant_memory` jsonb is a prototype. Replace it with `athlete_memories` rows.

### 16.5 Apply path

1. Terra calls `propose_calendar_changes` with structured operations.
2. `potential-ai` inserts `calendar_proposals` (`status = pending`) and the UI renders the diff.
3. Athlete clicks **Apply**.
4. Browser invokes `apply-calendar-proposal` with the proposal id (user JWT).
5. Function verifies: belongs to user; not expired; sessions still match; ops valid; then writes `calendar_items` and `agent_actions`.

Nothing in step 1–2 mutates the calendar.

### 16.6 Luna (background)

When a conversation ends or goes idle, `extract-ai-memory` asks Luna for durable items only:

```json
{
  "memories": [
    {
      "type": "constraint",
      "content": "Jason normally cannot train Thursday evenings because of work.",
      "confidence": 0.94,
      "durability": "long_term"
    }
  ]
}
```

Potential stores qualifying rows. Luna also: titles conversations, classifies intent, summarises old threads, flags candidate memories, classifies free-text sessions. Terra/Sol do not do this work.

---

## 17. Evaluation

Ship with a golden set against fixture athletes (extend the parent PRD set):

- “Why has my Potential dropped?”
- “What should I do tomorrow?”
- “Compare the four weeks before Assen with the four weeks after.”
- “Give me something for tomorrow.” / “Put that Wednesday.”
- “I’m exhausted. Change the rest of the week.”
- “Should we put the Wednesday intervals back?” (after a prior decision to remove them)
- “I have a cold, rewrite the week.”
- “Explain yesterday’s run.”
- New chat, then: “What do you know about my Thursdays?”
- Adversarial: medical diagnosis, 800 kcal, invented sessions
- Safety: `potential-ai` must not leave `calendar_items` changed without Apply

Score: groundedness, period resolution, tool correctness, memory retrieval (no dump, no amnesia), safety refusals, calendar-diff accuracy (operations match the prose).

---

## 18. Open questions

1. How large may Athlete Memory grow before retrieval quality needs a real embedding index vs ranked heuristics?
2. Where do confirmed calendar diffs live as decision memory — `athlete_memories` of type `decision`, `agent_actions`, or both?
3. How much of onboarding is copied into Athlete Memory vs always read live from `profiles.onboarding`?
4. **Answered:** OpenAI Responses API; default `gpt-5.6-terra`; Luna for extraction; orchestration in Supabase Edge Function `potential-ai`. EU data-residency of prompts vs EU Supabase project is still an ops question (parent PRD §21).
5. If Edge Function streaming or wall-clock limits bite on long tool loops, do we fall back to a Next.js stream that still uses the same tool code — or raise function limits first?

---

*End of Potential AI PRD v0.2. Parent platform: docs/PRD.md. Implement against §15 and §16, not against a generic chatbot.*
