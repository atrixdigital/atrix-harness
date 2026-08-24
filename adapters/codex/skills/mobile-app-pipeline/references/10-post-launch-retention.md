# 10 — Post-launch: analytics, retention, update cadence

Shipping is the start. This phase is how the app gets better and keeps users.

## Instrument first — you can't improve what you can't see

Wire a **batched, device-keyed, fire-and-forget** `track()` before launch (or in the very next update).
Store events in an append-only table keyed by `deviceId` with `session_id`, `premium`, `app_version`,
`created_at`. Minimum viable taxonomy (~12 events):

- lifecycle: `app_open`, `onboarding_start/complete`
- core loop: `first_action`, `action_done` (+ any signal that predicts retention)
- monetization: `paywall_shown{trigger}`, `purchase_completed`
- retention loops: feature usage, re-engagement opens

Derive the **retention curve** (D1/D7/D30 by weekly cohort) and the **aha metric** (the earliest action
most correlated with D30). Optimize onboarding toward the aha; kill features that don't move the curve.

## Retention model — match the app's real cadence

- **Consultative/episodic apps** (advisor, booking, utility): don't fake daily hooks. Retention = "share
  of the jobs that run through the app." Win via a compounding moat (memory/history the user invests in,
  made *visible*) + value-first re-engagement (a useful thought, never "come back!").
- **Habit apps** (tracker, social): daily streaks/notifications are legitimate — but tie mechanics to real
  value, not hollow gamification.

Proven loops: onboarding that seeds personalization, a "what the app knows about you" surface that grows
(switching cost), context-aware re-engagement push (fail-closed cron), referral / share-to-unlock,
streaks measured on *outcomes* not opens.

## Update cadence — OTA for speed, builds for native

- **Ship JS-only fixes OTA** with `eas update` — live in minutes, no review, no version bump. This is how
  you fix a bad copy string, logic bug, or UI glitch the day it's reported. Most post-launch fixes qualify.
- **Native changes** (deps, permissions, config plugins, SDK upgrade) → full build + submit + **bump
  `expo.version`** (references/07 — the version trap bites on updates too).
- **Watch OTA health** with `expo:eas-update-insights` after every update: crash rate, adoption, and the
  embedded-vs-OTA user split. Roll back a regressing update before it spreads.
- **Close the feedback loop** each release: pull `mcp__plugin_expo_expo__testflight_feedback` and
  `testflight_crashes`; fix the top crash before adding features.
- Ship updates weekly-ish. Most only need a version bump + review; no new ASC config unless you add IAPs.

## Growth surfaces (when ready)

- SEO/landing pages on the companion backend domain, App Store keyword iteration (promotional text is
  updatable without review), referral loops, and — for AI apps — "generative engine optimization"
  (llms.txt, structured data) so the product shows up in AI answers.

## The loop closes

Post-launch data feeds the next **ideate** (references/01): the retention curve and event correlations
tell you what to build next. Run the pipeline again for the next feature or the next app.
