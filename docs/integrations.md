# Integrations

**Product:** Ahead
**Status:** vendor-neutral architecture; not yet implemented as such
**Live today:** COROS sync, athlete file upload
**Not live:** Garmin, Polar, Suunto, Wahoo, Apple Health, Strava overlay

Ahead's canonical object is a **training session**. Providers contribute **observations** to that session.

COROS was the first vendor pipe. It does not own the shared object. A new vendor adds an adapter only. It must not add a second persist path.

Do not start Garmin before the pre-vendor cleanup. Otherwise Garmin becomes the second source retrofitted into a COROS-shaped `activities` row, which is exactly what this document exists to prevent.

## Layers

```
SOURCE
COROS / Garmin / Polar / file / Apple Health
          ↓
SOURCE ADAPTER
authentication + fetching + source parsing
          ↓
SESSION + OBSERVATIONS
training session identity
source artefacts
scalar observations
time-series bundles
capabilities + quality
field provenance
raw artefact reference
          ↓
AHEAD DERIVATION
zones
load
capacity
Performance
route matching
Activity Insight
Coach Review
Ask Ahead
```

Garmin-specific code ends at the adapter. After that, session matching, load, HR models, Performance, route matching, Activity Insight, Coach Review, and Ask Ahead must not know or care which vendor contributed.

Architectural test: if Garmin lands and anything downstream of ingest needs `if (source === "garmin")`, that is a smell.

We do **not** send structured workouts back to a watch. The calendar the athlete talks to is Ahead’s calendar.

Vendor scores (`garmin_training_effect`, `coros_training_load`, `polar_cardio_load`, body battery, vendor readiness) stay metadata. They never become load or Performance.

## The training session

Stop using “canonical activity” as the system of record. The stronger model is already implied once two pipes can see the same ride:

```
training_sessions
  id
  athlete_id
  started_at
  sport
  …

activity_sources / observations
  session_id
  source
  source_activity_id
  raw artefact
  observations
  provenance
  capabilities
```

Ahead’s model operates on **the session**, not “an activity row from whichever provider won.”

That matters when:

- Garmin and an uploaded file both see the same ride
- Apple Health contains a workout also present in Garmin
- one source has better GPS and another has better HR
- a replacement head unit records half a session

Today the unique key is `(athlete_id, source, source_activity_id)` on `activities`. That is an artefact key, not a session key. Keep it on the observation. Load, calendar, and Ask Ahead key off `training_sessions.id`.

We already have two first-class pipes (COROS and file upload). Session identity is needed now, not when Garmin ships.

Do not auto-delete artefacts. Matching attaches a new observation to an existing session, or opens a session. Daily load counts the session once. Calendar linking attaches the session.

## Matching observations to a session

**Time overlap is the primary duplicate signal.** Distance is corroboration only.

Two devices on the same ride routinely disagree on kilometres: GPS sampling, auto-pause, wheel sensors, smoothing, altitude correction, or one device starting and stopping a little earlier. ±5% on distance is too strict. ±10–15% is supporting evidence, especially on short off-road or CX rides. One athlete cannot normally ride two distinct sessions at the same time.

Primary test:

```
same athlete
+ same sport family
+ start times close
+ recording periods substantially overlap
= duplicate candidate
```

Use the recording interval, not start timestamp alone.

```
A: [startA, endA]
B: [startB, endB]

overlap = intersection of the two intervals
score  = overlap ÷ duration of the shorter recording
```

95% overlap is extraordinarily strong, even if starts differ by a couple of minutes. Adjacent hours with similar distance are not duplicates:

```
09:00 → 10:00
10:15 → 11:10
```

### High confidence — attach automatically

Same sport family, and:

- start difference ≤ 3 minutes
- time overlap ≥ 85% of the shorter recording
- duration difference ≤ 10%

plus **one** of:

- distance difference ≤ 15%
- GPS routes strongly overlap
- one source has no distance

Examples that attach:

```
COROS     09:02:14 → 10:04:03    31.8 km
Garmin    09:01:42 → 10:04:51    32.5 km
```

700 m apart, obviously one session.

```
COROS     09:02 → 10:04    31.8 km
uploaded  09:03 → 10:03    31.4 km
```

Also high confidence.

### Possible duplicate — keep separate

Close in time but below the thresholds, or sport family unclear, or only distance agrees. Flag internally for later reconciliation. Do not expose this to the athlete in v1.

### Not a duplicate — new session

No substantial time overlap. Distance matching alone is never enough.

Bias toward **not merging** when it is questionable. A leftover duplicate is fixable. Gluing two real sessions together is much harder to unwind.

### Attach to the session, not a pair

A rider can record Garmin on the head unit, COROS on the watch, and then upload the Garmin FIT. Matching must not create a chain of pairwise merges.

Compare the new observation to existing **sessions** (using each session’s recording window, not one artefact). High confidence attaches to that session:

```
session_123
  ├── Garmin activity
  ├── COROS activity
  └── uploaded FIT
```

Three artefacts, one load.

## Race event, session, result

Keep these three objects separate. Do not collapse them.

```
Race event          calendar intent race
      ↓
Training session    what was done
      ↓
Source observations COROS / file / Garmin / …

+

Race result         placing, field, gap, category, DNF, mechanical
```

Race results stay a separate record. They are never inferred from HR. Ahead may combine session physiology with a saved result as **performance evidence**. Physiology alone does not say whether someone raced well.

## Selecting evidence

Directionally: use the richest trustworthy observations. Do not invent a session no source observed.

**Scalars** may be chosen per field: distance, average HR, elevation, summary duration.

**Time-series stay in a bundle.** HR, power, speed, cadence, and GPS generally keep a common timeline and a common source unless we have explicitly aligned them.

This is unsafe without alignment:

```
HR from Garmin + power from the file + GPS from Garmin
```

Two artefacts can both be kept. Ahead may prefer one bundle for derivation (continuous 1 Hz file with power) and still show that another artefact exists. It must not stitch streams into a “perfect” ride.

## Capabilities include quality

A boolean `hasHr` is not enough. Four HR samples over an hour is not the same evidence as continuous 1 Hz.

The contract should be able to grow to this without a rewrite:

```ts
hr: {
  available: true,
  stream: true,
  coverage: 0.98,
  source: "garmin",
}
```

v1 can be thinner (`available`, `stream`, `source`). Coverage and sample rate come next. Missing power is missing power, not a failed FIT parse.

FIT, GPX, TCX, and vendor JSON are format adapters. They feed the same importer. Prefer a FIT when it is the richest artefact. Do not make FIT the canonical truth. A Polar or Apple pipe with excellent samples and no file is first-class.

## Field provenance

`activity.source` is not enough. Provenance is per field or per bundle:

```
duration        file (scalar)
heart rate      Garmin bundle
power           Garmin bundle
elevation       Ahead derived from that GPS
race result     Manual
threshold HR    Athlete setting
weather         External source
```

Insight and Ask Ahead can then say what they actually saw.

## Evidence eligibility is opt-in

Today `isIntelligenceSource` is “everything except Strava.” A new `trainingpeaks` or `zwift` source would enter load, Performance, and Ask Ahead because nobody remembered a blacklist.

Flip it. A newly added provider is **not** eligible until someone turns it on. Eligibility lives on the integration definition.

The current flag name `intelligence` is vague. Prefer something that means:

> this source’s observations may influence Ahead’s canonical training state and AI interpretation.

`trainingEvidence` or `eligibleForDerivation` ages better. One boolean will eventually become policy (display vs derivation vs Ask vs race). Not urgent to split now. New sources start false. COROS and file upload are approved because they are live and reviewed. Garmin stays false until the first successful sync is signed off. Strava stays false until policy changes in writing.

## Pre-vendor cleanup

Do these before writing Garmin.

### 1. Canonical session + observation types

Lift `MappedActivity` out of `src/lib/coros/map.ts` into `src/lib/ingest/`.

The shared write type is an **observation** contributed to a session (`SessionObservation` / `ImportedObservation`), not a “canonical activity.” COROS and file upload become the first two adapters. A Garmin adapter in `src/lib/garmin/` returns the same type and does not import COROS.

### 2. Capabilities, bundles, provenance

Declare what each observation has, at what quality, and who supplied it. Scalars selectable; streams bundled.

### 3. Rename the upload boundary

Upload already accepts `.fit`, `.gpx`, `.tcx`, and zips. The route is still `POST /api/integrations/fit/upload`.

Rename now:

- `POST /api/import/upload` (or `/api/integrations/file/upload`)
- Form field stays `files`
- Redirect the old path

File upload is a source. FIT is one adapter. Vendor sync may still download a FIT. That does not replace athlete upload.

### 4. Opt-in `trainingEvidence`

Config on the provider. New sources start false.

### 5. Session identity

Time-overlap matching across COROS and upload. One session, one load, several artefacts. Distance is supporting evidence, not the identifier.

## Two live pipes

### File upload

Always available. Not a COROS helper. Any watch or export. No vendor connection required.

Target: `POST /api/import/upload`. Today: `/api/integrations/fit/upload`.

### Vendor sync

OAuth → `integrations` → adapter → observations on a session → same derivation as upload.

COROS is the only live vendor adapter. Garmin, Polar, Suunto, Wahoo, and Apple have catalogue stubs only.

## What is already shared

| Step | Shared code | Notes |
| --- | --- | --- |
| Catalogue | `src/lib/integrations.ts` | `live`, `trainingEvidence` opt-in |
| OAuth | `src/lib/oauth.ts` | Authorize / token URLs, env names |
| Connection | `integrations` | Tokens, cursor, last sync |
| Sync log | `integration_syncs` | Counts and errors |
| Artefact | `activity-originals` | Optional raw bytes |
| Streams | `activity-streams` | Tied to an observation, bundled |
| Session | persist in `src/lib/ingest/` | One session, many observations |
| Load | `deriveActivityMetrics` + `recomputeDailyLoads` | Once per session |
| Calendar | `linkActivitiesToCalendarItems` | Session, same day + sport |
| Evidence | provider `trainingEvidence` | Opt-in |

COROS fetching stays in `src/lib/coros/`. Shared persist stays in `src/lib/ingest/`. Garmin belongs in `src/lib/garmin/`.

## How to add a vendor

Only after cleanup 1–5.

1. **Legal.** If we cannot use the data in an AI product or for analytics, do not build the pipe. Strava is the example.
2. **Register.** Source id, `live: false`, `trainingEvidence: false`. Secrets only on the server.
3. **Connect.** Real OAuth for that vendor. Garmin is not a copy of Polar. Client never sees tokens.
4. **Adapter.** Auth, fetch, parse. Emit a `SessionObservation` (start/end, sport family, source id, scalars, one time-series bundle, capabilities, provenance, optional artefact). Vendor load stays metadata.
5. **Pull.** List recent work; match by recording overlap; attach or open a session; store artefact; link calendar; recompute load once per session; optional wellness observations; log the sync.
6. **Turn on.** First athlete sync reviewed, then `trainingEvidence: true` and `live: true`.

Service role only in the job, and only for that athlete’s rows. Ask Ahead still reads with the user JWT.

## Vendor notes

**Garmin** — Activity API plus the richest artefact they will give (usually FIT, not required). No Connect IQ. No workout write-back. Program approval first. OAuth stubs in `src/lib/oauth.ts` are not the contract.

**Polar** — AccessLink sessions and samples. Cardio load is metadata. No FIT required if samples are good.

**Suunto / Wahoo** — later, inbound only.

**Apple Health** — needs an Ahead iPhone app. Also the path for Amazfit / Zepp (no public cloud activity API).

**COROS** — live reference adapter. After the type lift it only implements `SessionObservation`.

**Strava** — `trainingEvidence: false` until written policy approval. Do not ingest Garmin → Strava → Ahead.

## Wellness

Observations (sleep, HRV, resting HR, stress) may land on `daily_recovery`. Vendor readiness does not become Performance. Missing fields mean the signal is not in the feed.

## Product copy

Connect is “Connect your training,” not “Connect COROS.”

```
Upload a file · COROS
Garmin · Polar          (when live)
Suunto · Wahoo · Apple Health
Strava is not how Ahead reads your training
```

File upload stays on that page after every vendor is live.

## Do not

- Treat an `activities` row from one provider as the training object
- Stitch time-series from different sources onto one timeline without alignment
- Recalculate Ahead load from a vendor training-load field
- Infer a race result from HR
- Default a new source into derivation
- Count the same session twice
- Treat distance as the duplicate identifier
- Merge when only kilometres agree and the recording windows do not overlap
- Make file upload require a vendor connection
- Put `if (source === "garmin")` downstream of the adapter
- Push workouts to the watch
- Use Strava as history
- Put integration tokens in the browser bundle
- Start Garmin before cleanup 1–5

## Order of work

1. Session + observation types in `src/lib/ingest/`; COROS and file upload consume them
2. Capabilities, quality, provenance; scalar vs bundle
3. Rename the upload route
4. Opt-in `trainingEvidence`
5. Session identity across COROS and upload (time overlap first)
6. Garmin Activity API
7. Polar AccessLink
8. Suunto when an athlete needs it
