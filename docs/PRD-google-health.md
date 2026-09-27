# PRD — Google Health Recovery Integration

**Product:** Ahead
**Feature:** Google Health
**Scope:** Recovery and overnight health only
**Status:** Build
**Priority:** High
**Do not import:** workouts, steps, activity load, exercise, GPS

Google is a **recovery-only provider**, not another training provider.

As of September 2026, build this against the **Google Health API**, not the old Fitbit Web API or Google Fit. Google is turning down the legacy Fitbit Web API in September 2026. The new API covers Fitbit devices and Pixel Watches, including Fitbit Air.

---

## 1. Goal

Allow an athlete to connect their Google Health account and use supported Fitbit / Pixel Watch data as Ahead’s recovery source.

Google should contribute:

- sleep
- HRV
- resting heart rate
- respiratory rate
- oxygen saturation
- overnight temperature where supported

Google must **not** contribute training activities in v1.

This allows configurations such as:

```text
Amazfit / file / future vendor
  ↓
training sessions

Google Health
  ↓
sleep / HRV / RHR / overnight vitals

        ↓

Ahead
Performance
Activity Insight
Ask Ahead
Coach Review
```

The athlete does not need to train with the same device they sleep with. Ahead combines the evidence without ever importing the same exercise twice.

---

## 2. Product principle

## Training source and recovery source are independent.

Do not model an integration as:

> “This athlete uses Garmin.”

Model capabilities separately:

```ts
{
  provider: "google_health",
  capabilities: {
    activities: false,
    recovery: true,
    sleep: true,
    hrv: true,
    restingHeartRate: true,
    respiratoryRate: true,
    oxygenSaturation: true,
    sleepTemperature: true
  }
}
```

Another athlete might have:

```ts
{
  provider: "coros",
  capabilities: {
    activities: true,
    recovery: true
  }
}
```

Ahead should be able to accept activities from provider A and recovery from provider B without either owning the athlete.

This sits on the same adapter boundary as [integrations.md](./integrations.md): vendor-specific code stops at the adapter. Downstream must not need `if (provider === "google_health")`.

---

## 3. Use the Google Health API

Do **not** implement:

- legacy Google Fit
- legacy Fitbit Web API
- Android Health Connect as the server integration
- Fitbit OAuth

Use:

> **Google Health API v4 + Google OAuth 2.0**

Google describes the Google Health API as the successor to the Fitbit Web API. Pixel Watch and Fitbit hardware are supported sources.

This should appear to users simply as:

> **Google Health**

Supporting copy:

> Sleep and recovery data from compatible Pixel Watch and Fitbit devices.

---

## 4. OAuth scopes

Request only:

```text
https://www.googleapis.com/auth/googlehealth.sleep.readonly
https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly
```

Do **not** request:

```text
googlehealth.activity_and_fitness.readonly
```

That is intentional. Google separates sleep and health-metric permissions from activity/fitness permissions, so Ahead can make this a genuinely recovery-only connection.

The consent screen should not ask to “see your activity and fitness data” when Ahead has already told the athlete it only wants overnight recovery.

---

## 5. Initial data types

### Required MVP

#### Sleep

Google data type: `sleep`

Store:

- sleep start
- sleep end
- minutes asleep
- minutes awake
- time in bed
- deep sleep
- light sleep
- REM
- awake segments
- sleep type / source metadata where available

Google exposes both classic and staged sleep records, plus summary fields such as total minutes asleep and stage summaries.

Ahead derives:

```text
sleep_duration_minutes
sleep_start
sleep_end
sleep_efficiency
deep_minutes
rem_minutes
light_minutes
awake_minutes
```

Do not make Google’s proprietary Sleep Score part of Ahead’s canonical recovery model.

#### Daily HRV

Google data type: `daily-heart-rate-variability`

Ahead canonical: `hrv_rmssd_ms`

Google’s current API represents HRV using RMSSD, which fits Ahead’s existing recovery model.

#### Daily resting HR

Google data type: `daily-resting-heart-rate`

Ahead canonical: `resting_hr_bpm`

Google provides a daily resting-heart-rate value directly.

---

## 6. Secondary recovery metrics

Import these where supported. Do not require them for a valid recovery day.

| Google type | Ahead canonical |
| --- | --- |
| `daily-respiratory-rate` | `respiratory_rate_bpm` |
| `daily-oxygen-saturation` | `spo2_pct` |
| `daily-sleep-temperature-derivations` | `sleep_temperature_c`, `sleep_temperature_baseline_c`, `sleep_temperature_delta_c` |
| `respiratory-rate-sleep-summary` | optional; only if it adds information beyond daily respiratory rate |

Google currently exposes nightly temperature together with a 30-day baseline where supported. Combining sleep sessions with HRV, respiratory rate, oxygen saturation and sleep-temperature derivations is the overnight-health context Google recommends.

---

## 7. Do not import activities

This is a hard v1 constraint.

Even though Google Health exposes exercise, steps, distance, heart rate, VO2 max, and active minutes, the Ahead Google integration does not request or ingest them.

The Google adapter must have `activities: false` and must never call the Activity & Fitness endpoints or scopes.

That prevents:

```text
Amazfit ride
   ↓
file / Amazfit activity

same ride
   ↓
Google Health
   ↓
duplicate Ahead session
```

Google is a **wellness pipe**.

File upload stays first-class training ingest. Connecting Google Health must not require a training vendor, and a training vendor must not require Google Health.

---

## 8. Integration architecture

Add:

```text
src/lib/google-health/
  oauth.ts
  client.ts
  types.ts
  sleep.ts
  vitals.ts
  map-recovery.ts
  sync.ts
```

Google-specific code stops there.

```text
Google Health API
        ↓
Google recovery adapter
        ↓
canonical recovery observations
        ↓
recovery resolver
        ↓
daily_recovery
        ↓
Performance / Insight / Ask Ahead / Reviews
```

Do not allow anything downstream to require `if (provider === "google_health")`.

Today COROS can land sleep, HRV, resting HR, and stress directly on `daily_recovery`. Google Health must not write that row itself. Observations first, then resolve.

---

## 9. Canonical recovery observations

Create or extend a generic structure such as:

```ts
type RecoveryObservation = {
  athleteId: string
  localDate: string
  source: "google_health"
  sleep?: {
    startAt?: string
    endAt?: string
    durationMinutes?: number
    timeInBedMinutes?: number
    awakeMinutes?: number
    stages?: {
      deepMinutes?: number
      remMinutes?: number
      lightMinutes?: number
      awakeMinutes?: number
    }
  }
  hrvRmssdMs?: number
  restingHrBpm?: number
  respiratoryRate?: number
  spo2Pct?: number
  sleepTemperature?: {
    nightlyC?: number
    baselineC?: number
    deltaC?: number
  }
  provenance: Record<string, FieldProvenance>
  retrievedAt: string
}
```

Missing values stay missing.

---

## 10. Raw observations versus canonical recovery

Do not let Google write directly over `daily_recovery`.

Prefer `recovery_observations` for vendor/source observations. Then:

```text
resolveDailyRecovery(athleteId, date)
```

builds Ahead’s canonical day.

Example:

```text
Sleep       Google Health
HRV         Google Health
RHR         Google Health
Training    Amazfit / file
```

That is legitimate.

---

## 11. Recovery source preferences

The athlete sets an ordered list **per metric**, not a provider-wide winner.

```ts
recovery_source_priority = {
  sleep: ["coros", "google_health"],
  hrv: ["coros", "google_health"],
  resting_hr: ["google_health", "coros"]
}
```

Resolver, for each metric on each day:

1. Walk the athlete's list.
2. Use the highest-priority source that has a valid value.
3. If none have a value, leave the field missing.

Do not average. Do not silently promote a new source to first.

When a second recovery source appears, append it last and prompt:

> New recovery source detected. Choose where it should sit in your recovery priority.

Changing priority does **not** rewrite past `daily_recovery` rows unless the athlete chooses **Recalculate recovery history using this priority**. New days use the new order.

---

## 12. Field-level provenance

Each canonical recovery value must retain its source.

```text
Sleep        8h 11m     Google Health
HRV          64 ms      Google Health
Resting HR   55 bpm     Google Health
Training                 Amazfit
```

Internally:

```ts
{
  hrv_rmssd_ms: 64,
  hrv_source: "google_health",
  resting_hr_bpm: 55,
  resting_hr_source: "google_health",
  sleep_minutes: 491,
  sleep_source: "google_health"
}
```

This matters when more than one wearable integration is connected.

---

## 13. Multiple Google devices

Google Health can contain overlapping records from more than one device (Pixel Watch plus Fitbit Air).

Google’s API provides a **reconcile** operation for overlapping records. Use Google’s reconciled result where appropriate rather than deciding which watch “won.”

For sleep:

```text
Google reconcile
      ↓
main sleep record
      ↓
Ahead
```

Do not add Pixel sleep and Fitbit sleep together.

---

## 14. Date assignment

Recovery data needs strict local-date semantics.

A sleep episode `23:18 → 07:04` is stored against **the date the sleep episode ended**.

Overnight sleep ending on 27 Sep 2026 07:04 becomes recovery for `2026-09-27`.

That matches how Ahead uses overnight recovery when making today’s training decision.

Keep:

```text
timezone_at_sleep
start_at
end_at
recovery_date
```

---

## 15. Sync strategy

### Initial connection

Backfill **90 days** for sleep, daily HRV, and resting HR. Optionally backfill secondary vitals for the same period.

90 days gives Ahead enough baseline immediately without importing years of wellness history. Extend later if API cost and limits make it trivial.

### Ongoing

Use Google Health webhooks/subscriptions where the recovery types support them.

Fallback scheduled sync:

```text
morning sync
+
periodic reconciliation
```

Google sleep/recovery values can change after the first device sync. Today’s incomplete recovery row should be refreshable.

---

## 16. Sync timing

Do not assume recovery exists at midnight.

Typical sequence:

```text
07:04 wake
07:09 wearable syncs
07:12 Google Health finalises values
07:15 Ahead webhook/poll
```

`daily_recovery` should support `pending`, `partial`, and `complete`.

Example:

```text
07:07  sleep present, HRV missing
07:16  sleep present, HRV present, RHR present
```

Recalculate today’s recovery context when new observations arrive.

---

## 17. Missing data rules

Existing Ahead invariant:

> **Missing ≠ bad.**

If Google gives sleep and RHR but null HRV, Ahead must not interpret that as poor HRV. It means HRV unavailable.

No sleep record does not mean 0 hours sleep.

---

## 18. Ahead recovery model

Do not import a Google/Fitbit readiness or recovery score as Ahead truth.

Google contributes observations. Ahead derives its own interpretation.

Example:

```text
HRV      64 ms · In range
RHR      55 bpm · In range
Sleep    8h11 · Above range
```

Those feed the existing recovery nudge / contextual reasoning.

Vendor scores may be stored as metadata if the API ever exposes them. They must not become Performance, Strain, or Recovery.

---

## 19. AI representation

Ask Ahead should see something like:

```json
{
  "recovery": {
    "date": "2026-09-27",
    "sleep": {
      "minutes": 491,
      "status": "above_range",
      "source": "google_health"
    },
    "hrv": {
      "rmssd_ms": 64,
      "status": "in_range",
      "source": "google_health"
    },
    "resting_hr": {
      "bpm": 55,
      "status": "in_range",
      "source": "google_health"
    },
    "respiratory_rate": {
      "value": 14.2,
      "status": "in_range"
    },
    "coverage": "complete"
  }
}
```

The AI does not need “Pixel Watch 4” unless the athlete asks about the data source.

---

## 20. Product UI

### Integrations card

**Google Health**

Sleep and recovery from compatible Pixel Watch and Fitbit devices.

**Recovery**

Sleep · HRV · Resting HR · overnight vitals

**Connect**

Do not show Activities. This integration does not support them.

---

## 21. Connection screen

Before OAuth:

## Connect Google Health

Use your Google Health sleep and overnight recovery data in Ahead.

Ahead will request access to:

- Sleep
- Heart-rate variability
- Resting heart rate
- Supported overnight vitals

**Ahead will not import workouts or activity history from Google Health.**

**Connect Google Health**

That last sentence tells an athlete whose training is Amazfit or a file that the training source stays the training source.

---

## 22. Dashboard behaviour

Once Google is connected, Overnight simply works:

```text
Overnight

Sleep
8h 11m
In range

HRV
64 ms
In range

Resting HR
55
In range
```

A small source indicator can appear on detail:

> Source · Google Health

Do not plaster Google branding through the main Ahead UI.

---

## 23. Settings

Under the connected integration:

**Google Health**

Connected

Recovery data
✓ Sleep
✓ HRV
✓ Resting heart rate
✓ Overnight vitals

Training activities
**Not imported**

Last synced
07:16

Disconnect

---

## 24. Example athlete

```text
TRAINING
Amazfit / file
↓
runs / rides
↓
Ahead training sessions

RECOVERY
Google Health (Pixel / Fitbit Air)
↓
sleep, HRV, RHR, temperature, SpO2
↓
Ahead recovery observations

COMBINED
Ahead
Run yesterday: 58 load
Sleep: 8h03
HRV: normal
RHR: normal
↓
Performance
Activity Insight
Ask Ahead
Coach Review
```

That is the multi-device setup Ahead’s integration architecture should support.

---

## 25. Do not

- Do not implement the old Fitbit Web API.
- Do not implement Google Fit.
- Do not request activity/fitness scope.
- Do not import Google exercises.
- Do not allow Google activity data to affect training load.
- Do not assume Google is the athlete’s training device.
- Do not import Google’s proprietary recovery/readiness interpretation as Ahead truth.
- Do not replace missing metrics with zeros.
- Do not make Google-specific recovery code leak downstream.
- Do not assume every supported device exposes every recovery metric. Device capabilities differ; Google’s compatibility matrix varies by device.

---

## 26. Implementation order

### Phase 1 — plumbing

1. Add `google_health` provider.
2. Mark capabilities `activities: false`, `recovery: true`.
3. Configure Google Cloud project and Google Health API.
4. Add OAuth start/callback/disconnect.
5. Request only Sleep + Health Metrics readonly scopes.
6. Securely persist refresh/access tokens.

Google’s developer checklist requires a Google Cloud project, enabled Health API, OAuth credentials, consent configuration, and compliance with its health-data policies.

### Phase 2 — canonical recovery

7. Add generic `recovery_observations` persistence if not already present.
8. Add field provenance.
9. Implement `resolveDailyRecovery`.
10. Add recovery-source preference handling.

This phase is the pre-vendor cleanup for recovery, analogous to the session/observation cleanup in [integrations.md](./integrations.md). Do not land Google before it.

### Phase 3 — Google mapping

11. Fetch/reconcile `sleep`.
12. Fetch `daily-heart-rate-variability`.
13. Fetch `daily-resting-heart-rate`.
14. Fetch respiratory rate.
15. Fetch oxygen saturation.
16. Fetch sleep-temperature derivations.
17. Map all into canonical recovery observations.

### Phase 4 — sync

18. Backfill 90 days.
19. Add incremental sync.
20. Add webhook/subscription support.
21. Retry incomplete current-day data.
22. Record sync telemetry/errors.

### Phase 5 — product

23. Add Google Health integration card.
24. Add connection disclosure.
25. Surface source on recovery detail.
26. Confirm Ask Ahead sees canonical recovery.
27. Confirm Performance recalculates appropriately.
28. Confirm Activity Insight can use Google recovery context.
29. Confirm Coach Review can use recovery trends.

---

## 27. Acceptance tests

The critical test:

```text
Athlete connects Amazfit/file training source
+
Google Health recovery source
```

Then:

**Yesterday’s run** exists exactly once.

**Training load** comes only from the actual training source.

**Today’s sleep** comes from Google.

**Today’s HRV/RHR** come from Google.

Ask Ahead can answer “I slept badly and ran hard yesterday. Should today’s session change?” without knowing or caring that the run and recovery came from different manufacturers.

Disconnecting Google removes future Google recovery sync and does **not** affect the athlete’s training history.

---

Recovery-only gives Google a precise role in Ahead, eliminates activity duplication, and supports the real-world behaviour: wear one thing to train, another thing to sleep, and let Ahead combine the evidence.
