# PRD — Ahead Coach Review

**Status:** Draft  
**Product:** Ahead  
**Area:** Coaching  
**Working name:** Coach Review  
**Audience:** Self-coached endurance athletes  
**Primary question:** **What did the last month tell us, and what should we do next?**

Ahead already supports day-to-day coaching through Ask Ahead. That remains unchanged.

This feature adds a different coaching interaction: a deliberate, periodic review where Ahead steps back from today's session, evaluates the athlete's recent block in context, and positions them for the next one.

It should feel closer to sitting down with a real coach once a month than asking an AI another question.

Reviews also includes a **weekly note**. That is deterministic: what landed this week, in Ahead's metrics. It does not set the next block, does not call Terra, and does not reset the monthly clock.

The athlete sees one Reviews area, two jobs:

```text
This week     — quiet, factual, Monday after the week closes
Coach Review  — sit down, interpret, set the next four weeks
```

Dashboard only prompts for Coach Review when it is ready.

Reviews persist on the athlete account (`coach_reviews`), not only in the browser. Ask Ahead receives the standing review and the athlete's stated goals (priority races, sports, week shape, focus). Near-term races are operational. An A-goal months away is still the season.

---

## 1. Product idea

Most interaction with Ahead is immediate:

> Should I train today?  
> Why did Readiness fall?  
> Move Thursday's session.  
> What should I do before Sunday's race?

Coach Review asks a different set of questions:

> What actually happened over the last month?  
> Did the training achieve what we wanted?  
> What worked?  
> What didn't?  
> Are we moving towards the athlete's goals?  
> What should change in the next block?

The review should connect:

**past block → evidence → interpretation → next block**

It is not simply a longer Ask Ahead response.

---

## 2. Relationship to existing AI

Coach Review does **not** replace current Terra usage.

Ahead should continue to escalate ordinary Ask Ahead conversations to Terra whenever the existing routing determines that the problem genuinely requires deeper reasoning.

Examples include:

- complex multi-week planning;
- multiple competing race priorities;
- difficult constraint resolution;
- ambiguous longitudinal analysis;
- substantial replanning after illness/injury/travel;
- other cases already considered sufficiently complex.

Coach Review is an **additional explicit coaching workflow**.

Its defining characteristic is not which model runs it.

Its defining characteristic is:

> **A structured retrospective of the previous training block followed by a considered plan for the next one.**

The implementation may normally use the strongest appropriate model because this is deliberately a deep reasoning task, but model selection remains an implementation concern.

Do not expose:

> Luna review  
> Terra review

to the athlete.

The athlete sees:

> **Coach Review**

---

## 3. Coaching cadence

Default cadence:

> **Every 4 weeks**

The review should become available when approximately four weeks have passed since the previous completed Coach Review.

Do not force it to occur on an exact calendar date.

A real athlete may want to review:

- after an A race;
- at the end of a training block;
- after recovering from illness;
- before starting a new phase;
- after a holiday;
- a few days earlier or later than exactly four weeks.

Therefore the product should say:

> **Your Coach Review is ready**

rather than automatically running it at midnight every 28 days.

The athlete chooses when to start it.

---

## 4. User experience

A review begins with a dedicated entry point.

Example:

> ## Your September Coach Review is ready
>
> 22 Aug – 18 Sep
>
> Ahead will look at:
>
> Training progression  
> Race and workout performance  
> Recovery  
> Your calendar and goals  
> Changes made during the block
>
> **Start review**

The review should feel like a deliberate session.

Not:

> Ask Ahead: "review my month"

---

## 5. Review period

Default analysis period:

> **Previous 28 days**

However, the coach needs contextual access beyond those 28 days.

Typical data access:

```text
Primary review period:
last 28 days

Comparison context:
previous 28 days

Longer context when relevant:
3–6 months

Current forward calendar:
next 4–8 weeks
```

Examples:

A Fitness increase of +5 has little meaning without knowing where Fitness started.

A race result may need comparison with previous races.

A Direction change may require looking before the current block.

The primary narrative remains centred on the month being reviewed.

---

## 6. Review structure

The page is:

```text
What were we trying to do?
What happened?
Did it work?
What worked?
What didn't?          (only if something actually did)
What don't we know?
What did we learn?
Immediate priority
Next-block goal
Keep / Change / Watch
Build next block
```

Do not fill a section merely because the template contains it. Empty is a valid coaching conclusion.

Every Coach Review should answer these questions, and only these, when the evidence supports them.

### 6.1 Where were we trying to go?

Establish context before analysing the numbers.

Potential sources:

- current goals;
- upcoming races;
- race priorities;
- previous Coach Review;
- previous block plan;
- athlete memory;
- recurring club sessions;
- availability;
- constraints;
- any changes made during the month.

Example:

> This block was primarily about maintaining aerobic capacity while increasing cyclocross-specific work ahead of the September race block.

If there was no explicit previous objective:

> No formal block objective was set. Based on the calendar and training completed, this period appears to have shifted towards race-specific preparation.

Do not invent a prior objective.

### 6.2 What actually happened?

Summarise the completed block rather than the planned block.

Possible evidence:

- total training time;
- training load;
- easy / specific distribution;
- session consistency;
- missed sessions;
- races;
- Direction;
- Fitness;
- Fatigue;
- Form;
- Readiness patterns;
- Araw / Sraw development;
- repeated-route observations;
- threshold/performance estimates where supported;
- wellness/check-in context once available.

Example:

> You completed 18 sessions over the block, with 9h 42m of aerobic work and 3h 18m of specific work. Fitness rose moderately while Specific capacity increased more strongly during the second half of the block.

This section should be factual.

---

## 7. Did the block work?

This is the core of Coach Review.

Ahead should evaluate whether the block moved the athlete towards its intended purpose.

Evidence hierarchy:

```text
Observed performance
    >
modelled capacity development
    >
training stimulus
    >
training completion
```

Examples of stronger evidence:

- same route faster at similar HR;
- higher power at comparable HR;
- improved pace at comparable effort;
- power-duration improvement;
- reduced fade;
- race performance where comparisons are meaningful.

Model evidence:

- Direction;
- Araw;
- Sraw;
- Fitness trend.

Training input evidence:

- load progression;
- consistency;
- intensity distribution;
- volume.

Ahead must not treat:

> Fitness increased

as proof that:

> the athlete improved.

Correct language:

> Training stimulus increased.

Stronger language requires response evidence.

---

## 8. What worked?

The review should identify a small number of meaningful positives.

Example:

> ### What worked
>
> **Specific work became more consistent**
>
> Specific capacity rose throughout the block without a comparable increase in persistent fatigue.
>
> **Wednesday quality sessions were productive**
>
> They supplied most of the block's race-specific stimulus and were followed by adequate recovery.
>
> **Aerobic work between races held up**
>
> This appears to have prevented the base from falling during a race-heavy period.

Avoid generating a generic list of everything that happened.

Prefer 1–3 meaningful findings.

---

## 9. What didn't work?

Coach Review must be willing to say something was ineffective. It must also be willing to omit this section.

If nothing obviously went wrong, return no findings. Do not invent a weakness to fill the page. Limited evidence belongs under **What we don't know yet**, not here.

Examples of a real problem:

> Tuesday and Wednesday quality sessions repeatedly created high fatigue without adding much additional specific stimulus.

> Aerobic volume fell substantially during the second half of the block.

> Three planned endurance sessions were missed, leaving the block more intensity-heavy than intended.

Again, no moral language.

Not:

> You failed to follow the plan.

Instead:

> The block ended up differently from the intended structure.

---

## 10. What did we learn?

This section separates Coach Review from a dashboard report.

Ahead should derive **coaching lessons** that can inform the next block.

For example:

> Ari appears to tolerate one substantial midweek race-specific session well, but stacking another hard session within 24 hours has repeatedly raised fatigue without clear additional benefit.

Or:

> Longer easy rides have been the most reliable way of expanding aerobic capacity between race periods.

Or:

> We still lack enough repeated-route evidence to confirm whether the recent specific block is improving performance.

These conclusions should become available to future coaching conversations where appropriate.

---

## 11. Next block

Coach Review should end by positioning the athlete for the next approximately four weeks.

Competition in the reviewed block is only:

- a calendar event whose type / intent is race;
- a completed activity explicitly linked to a race;
- or an activity the athlete classified as a race.

A workout title containing "race", "CX", "opener", or similar is not competition by itself. If that leaves the block with zero races, say `Races / competition 0`. A race after the review period belongs to next-block context, not last-block evidence.

The packet must include the next 28–42 days of races and fixed sessions before forming the strategy.

Separate operational coaching from block strategy:

- **Immediate priority** — today / this weekend (arrive fresh for tomorrow's race).
- **Next-block goal** — the four-week objective, looking at all races and commitments in that window.

It should consider:

- upcoming races;
- race priority;
- current Direction;
- current Readiness;
- Fitness/Fatigue/Form;
- aerobic/specific development;
- recent response;
- constraints;
- club sessions;
- recurring commitments;
- athlete preferences;
- previous coaching lessons.

The output should be a **block strategy before it becomes a calendar**. Keep / Change / Watch describe coaching roles and principles first. Calendar sessions are implementation, not the review's job.

Example:

> ## Next block
>
> **Immediate priority**
>
> Arrive fresh for Lincolnshire CX tomorrow.
>
> **Next-block goal**
>
> Continue developing CX-specific capacity through the upcoming race period while preserving enough aerobic work to stop the base drifting down.
>
> **Keep**
>
> Monday coached session — key quality work  
> Wednesday coached session — retain if sufficiently recovered  
> One meaningful aerobic ride each week  
> Race opener only before priority races
>
> **Change**
>
> In race weeks, one quality midweek session is enough — races supply the second stimulus.
>
> **Watch**
>
> Whether the specific work starts showing up on repeated routes or similar efforts.

Do not add a Priorities list. Immediate priority, Keep, Change, and Watch already cover it.

Do not fill Keep / Change / Watch / What worked / What didn't merely because the template has a slot. Empty is allowed.

This is substantially more valuable than immediately dumping 28 workouts into a calendar.

---

## 12. Proposed calendar

After presenting the block strategy:

> **Build the next 4 weeks**

Ahead can generate a proposed calendar.

This uses the existing proposal model:

> Ahead suggests.  
> Athlete reviews.  
> Athlete applies.

No silent calendar modification.

Example:

```text
NEXT 4 WEEKS

Week 1
Mon  Club intervals
Wed  Easy endurance
Fri  Openers
Sun  Race

Week 2
...
```

Changes remain explicit diffs where existing calendar sessions are being modified.

---

## 13. Conversation after the review

A Coach Review should remain conversational.

After the report the athlete can ask:

> Why are you reducing Tuesday?  
> What if I want to race Thursday as well?  
> Why do you think my aerobic base is slipping?  
> What evidence says Wednesday is working?  
> I can't ride next weekend — redo the block.

These follow-ups use normal Ask Ahead routing.

Terra may therefore continue to be used when the follow-up genuinely requires it.

The Review does not create a separate isolated chatbot.

---

## 14. Persisted review

A completed review becomes part of the athlete's history.

Suggested object:

```text
coach_reviews

id
athlete_id

period_start
period_end

created_at
completed_at

previous_review_id

objective_summary
block_summary
what_worked
what_didnt
lessons
next_block_objective
next_block_strategy

evidence_snapshot
model_version
```

Do not store only generated prose.

Persist structured conclusions and evidence as well.

---

## 15. Why persistence matters

Next month, Ahead should be able to say:

> Last month's review identified stacked Tuesday/Wednesday intensity as a problem. This month you reduced that pattern, and Fatigue was lower while Specific capacity continued rising.

That gives Ahead genuine coaching continuity.

Without persistence, every monthly review starts again from raw data.

A real coach remembers:

> what we tried;  
> why we tried it;  
> what happened;  
> what we decided to change.

Ahead should too.

---

## 16. Coaching decisions

Important conclusions from a review can be stored as explicit decisions.

Example:

```text
coaching_decision

"Keep only one hard midweek session during race weeks."

reason

"Two-hard-day sequences repeatedly produced excess fatigue."

valid_from
19 Sep 2026

review_at
next Coach Review
```

These should inform ordinary Ask Ahead conversations.

So if the athlete later asks:

> What should I do Tuesday?

Ahead knows the current coaching strategy.

---

## 17. Evidence snapshot

Every review should preserve enough evidence to explain itself later.

Example:

```json
{
  "fitness_start": 37.2,
  "fitness_end": 41.8,
  "direction_start": -4,
  "direction_end": 2,
  "araw_change": 0.08,
  "sraw_change": 0.19,
  "training_load": 1084,
  "easy_minutes": 510,
  "specific_minutes": 201,
  "races": 4,
  "route_evidence": []
}
```

The exact schema can evolve.

The important rule is:

> A future model should be able to understand why the previous review reached its conclusions without relying solely on prose written by an older model.

---

## 18. Required tools

Coach Review should orchestrate existing tools rather than receive one enormous prompt containing months of raw data.

Likely tools:

```text
get_current_training_state()

get_training_summary(start, end)

compare_training_periods(a, b)

get_direction_history(start, end)

get_readiness_history(start, end)

get_load_history(start, end)

get_aerobic_specific_history(start, end)

get_races(start, end)

get_calendar(start, end)

get_activity(id)

get_route_history(activity_id)

get_performance_changes(start, end)

get_wellness_summary(start, end)

get_wellness_context(start, end)

search_athlete_memory(query)

get_previous_coach_review()

get_current_coaching_decisions()

propose_calendar_changes(...)
```

Raw activity streams should only be retrieved when needed.

---

## 19. Review preparation

The backend should produce a deterministic **review packet** before deep reasoning begins.

For example:

```text
Block dates
Previous-block dates

Training totals
Load distribution
Direction change
Fitness/Fatigue/Form change
Araw/Sraw change
Readiness distribution
Completed vs missed calendar sessions
Race list
Performance evidence
Repeated routes
Wellness summary
Known constraints
Upcoming races
Previous review decisions
```

This reduces token usage and keeps canonical metrics consistent.

The model's job is to:

> interpret and coach

not:

> reconstruct basic statistics from activity records.

---

## 20. Confidence

Important review conclusions should have confidence based on evidence.

Example:

> **Specific fitness appears to be improving**  
> Moderate confidence
>
> Sraw increased substantially, but comparable performance data remains limited.

Versus:

> **Cycling efficiency improved**  
> High confidence
>
> Four repeated-route attempts were faster at similar heart rates.

Do not slap a confidence badge on every paragraph.

Use it where the strength of the inference matters.

---

## 21. Review availability

Initial rule:

A new Coach Review becomes available approximately **28 days after the previous completed review**.

For the first review:

> available after at least 28 days of usable training history.

Historical imports can satisfy this.

Therefore a new Ahead user with two years of imported history may be able to run their first review immediately.

---

## 22. Missed reviews

Reviews should accumulate very cautiously.

Do not create:

> You have 7 monthly reviews waiting.

A Coach Review is valuable because it reflects the current decision point.

If someone returns after three months, offer:

> **Your Coach Review is ready**
>
> It's been 11 weeks since your last review. Ahead will review the period since then and focus on the most recent block.

The analysis window may expand, but the forward recommendation remains focused.

---

## 23. Additional reviews

Do not design this around artificial AI quotas initially.

However, the data model should allow:

```text
review_type:
scheduled
manual
event_triggered
```

Possible later examples:

> Post-A-race review  
> Return-from-illness review  
> End-of-season review  
> Additional paid review

These should use the same review system.

---

## 24. Daily coaching remains unchanged

Coach Review must not weaken Ahead's normal coaching.

The athlete should still be able to ask at any time:

> Build me the next six weeks.

If that genuinely requires Terra under current routing, use Terra.

Do not respond:

> Wait until your monthly review.

The review is a structured coaching ritual, **not a restriction on intelligence elsewhere**.

---

## 25. Wellness integration

Once Ahead Wellness exists, Coach Review should incorporate it where relevant.

Examples:

> Sleep remained stable throughout the block.

> High soreness was reported after three consecutive race weekends.

> Late caffeine was logged on six nights and was associated with shorter sleep, but there is not enough evidence to consider it a training issue yet.

> Illness affected five days of the block, so comparisons with the previous month should be treated cautiously.

The review should not become a general health assessment.

Wellness context helps explain the training block.

---

## 26. Youth athletes

For youth athletes, coaching language and recommendations must reflect developmental context.

Avoid:

- adult training-volume expectations;
- weight-loss recommendations;
- maximising training load;
- adult recovery assumptions;
- aggressive performance optimisation.

Reviews should emphasise:

- development;
- enjoyment;
- consistency;
- skills;
- adequate recovery;
- race experience;
- sustainable training.

---

## 27. UX example

## Your September Coach Review

**22 Aug – 18 Sep**

### The block

**Direction**  
Maintaining ↑

**Fitness**  
37.1 → 41.8

**Specific capacity**  
Rising

**Aerobic capacity**  
Stable

**Races**  
4

**Performance evidence**  
Limited

---

### What happened

Training stimulus increased through the first half of the block before becoming more race-focused. Specific capacity continued to rise while aerobic capacity largely held.

Fitness increased, although this reflects accumulated training load rather than proof of improved performance.

---

### What worked

**Race-specific work**

Wednesday sessions supplied a consistent specific stimulus without a sustained deterioration in recovery.

**Aerobic maintenance**

Easy riding between races was sufficient to prevent a meaningful fall in aerobic capacity.

---

### What we don't know yet

Comparable performance evidence remains limited. The training model suggests development, but there are not yet enough repeated routes or comparable efforts to confirm the size of the performance response.

---

### What I'd change

Race weeks currently contain more intensity than necessary.

Keep the key Wednesday session but reduce secondary hard work as races become more frequent.

---

### Next block

**Goal**

Maintain aerobic capacity while continuing to develop CX-specific fitness.

**Priorities**

Keep one quality midweek session.  
Protect one meaningful aerobic ride each week.  
Use races as the second major specific stimulus.  
Keep the final 48 hours before priority races light.

**Build my next 4 weeks →**

---

## 28. Notifications

The review should have a restrained notification:

> **Your Coach Review is ready**
>
> It's been four weeks. See what changed and set the next block.

No:

> Your AI coach has exciting insights!

No artificial urgency.

---

## 29. Pricing relationship

Coach Review fits naturally into a paid Ahead coaching proposition.

Potential future structure:

> **Free**
>
> Training data  
> Direction  
> Readiness  
> history  
> deterministic analysis

> **Ahead Coach**
>
> Ask Ahead  
> daily coaching  
> calendar intelligence  
> planning  
> **periodic Coach Reviews**

Do not expose token/model limits.

The user is purchasing coaching capability, not model calls.

Pricing details are outside this PRD.

---

## 30. Success criteria

A successful Coach Review should make the athlete feel they can answer:

> **What did I learn from the last month?**

and:

> **Why does my next month look the way it does?**

Useful product metrics:

- percentage of eligible users starting a review;
- completion rate;
- percentage accepting or modifying proposed next block;
- follow-up questions after review;
- return rate for the following review;
- percentage of reviews referencing prior coaching decisions;
- percentage of recommendations backed by explicit evidence;
- number of calendar proposals resulting from reviews.

The key metric is not length of conversation.

It is whether the review changes or confirms the athlete's next block.

---

## 31. Product principles

1. **Review before prescribing.**
2. **Understand the goal of the block before judging it.**
3. **Completed training beats planned training.**
4. **Fitness/load is stimulus, not proof of adaptation.**
5. **Observed performance beats model inference.**
6. **Unknown is acceptable.**
7. **Explain what worked and what did not.**
8. **Carry lessons into the next block.**
9. **Create strategy before creating workouts.**
10. **The athlete approves calendar changes.**
11. **A monthly review does not restrict normal Ask Ahead intelligence.**
12. **The review should remember what the previous review decided.**

---

## 32. Product definition

The simplest description is:

> **Ask Ahead helps you handle training as it happens.**
>
> **Coach Review steps back, looks at what the last month taught us, and decides what the next month should be trying to achieve.**

That distinction is the feature.
