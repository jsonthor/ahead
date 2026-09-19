# PRD — Race results

**Status:** v1
**Product:** Ahead
**Area:** Races / Performance evidence

A race activity is training evidence. It is not a result.

Ahead can read duration, HR, power, pace and load from the file. It cannot legitimately conclude “you raced well” from that. Placing, field, category, gap, DNF and mechanicals are a separate record.

## Three objects

- **Race event** — calendar intent `race` (date, title, A/B/C).
- **Race result** — place / field / category / gap / feel / factor / status.
- **Activity** — the recorded file linked to that event.

## v1

Manual entry after a completed activity is linked to a race, or classified as one.

```text
How did it go?
Where did you finish?
How many started?
Category / gap / feel / factor
Save race result
```

No timing-provider import yet.

## Evidence hierarchy

1. Race results — strongest real-world outcome
2. Comparable race/course performances
3. Repeated training routes — supporting evidence between races
4. Modelled capacity — physiological evidence
5. Training load — input, not performance evidence

Coach Review and Ask Ahead must not infer placing from HR. Missing results stay unknown.
