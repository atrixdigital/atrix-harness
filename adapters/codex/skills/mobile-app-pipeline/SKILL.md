---
name: mobile-app-pipeline
description: End-to-end pipeline to ideate, build, configure, and SHIP iOS (Expo/React Native) apps to the App Store — the proven Expo+backend architecture, RevenueCat monetization, App Store Connect setup via REST API, EAS build+submit, and the hard-won App Store rejection playbook so we never repeat a rejection. Use whenever building a new mobile app from scratch, adding a store/monetization/submission step to an existing app, preparing an App Store submission, or diagnosing a rejection.
group: product
---

# Mobile App Pipeline — ideate → build → ship (iOS-first, Android-ready)

This skill is the operating manual for taking a mobile app from an idea to **live on the App Store**,
distilled from real launches (MSK — AI CTO Agent, PlayO, MSK Agent) and every rejection we ate along
the way. It is **iOS-first** but the architecture stays Android-ready.

**Prime directive: submitting for review and setting prices are outward-facing, hard-to-reverse,
user-owned decisions. Confirm exact values with the user and get an explicit "yes" before you submit,
set a price, or change anything live.** Everything else in the pipeline you can drive autonomously.

## The pipeline at a glance

| | Stage | What happens | Reference |
|---|---|---|---|
| 1 | IDEATE | scope, name, monetization model, one-sentence promise | [01-ideate-and-scope.md](references/01-ideate-and-scope.md) |
| 2 | BUILD | scaffold the proven Expo architecture, screens, state | [02-app-architecture.md](references/02-app-architecture.md) |
| 3 | BACKEND | *(optional)* companion API: device-keyed, metered, fail-safe | [03-backend-pairing.md](references/03-backend-pairing.md) |
| 4 | MONETIZE | RevenueCat single-entitlement, paywall that can't no-op | [04-monetization.md](references/04-monetization.md) |
| 5 | CONFIGURE | App Store Connect: app record, subs, metadata, privacy | [05-appstore-setup.md](references/05-appstore-setup.md) |
| 6 | ASSETS | screenshots (NO pricing) + metadata + privacy nutrition | [06-screenshots-metadata.md](references/06-screenshots-metadata.md) |
| 7 | SHIP | EAS build + auto-submit; version-bump discipline; OTA | [07-build-and-submit.md](references/07-build-and-submit.md) |
| 8 | REVIEW | preflight gate, submit, handle rejections | [09-preflight-checklist.md](references/09-preflight-checklist.md) · [08-rejection-playbook.md](references/08-rejection-playbook.md) |
| 9 | GROW | analytics, retention loops, OTA fixes, update cadence | [10-post-launch-retention.md](references/10-post-launch-retention.md) |
| + | ANDROID | Play Store path (mostly reuses 1–9) | [11-android-play-store.md](references/11-android-play-store.md) |

**Two ways to ship a change** (know which you need — see [07-build-and-submit.md](references/07-build-and-submit.md)):
- **JS-only change** (UI, copy, logic, most bug fixes) → `eas update` **OTA**, live in minutes, no review,
  no version bump. This is your default for fixes and fast iteration.
- **Native change** (new native dep, permission, config-plugin, `app.json` native field, SDK upgrade) →
  full **EAS build + submit** through review, with a marketing-version bump.

Read the relevant reference file(s) before executing a phase. `scripts/preflight.mjs` automates the
pre-submission checks. Low-level ASC REST mechanics live in the sibling skill
**`appstore-connect-automation`** (the JWT signing, pagination, asset upload, subscription ordering) —
this skill orchestrates; that one supplies the API helper (`scripts/asc.mjs`).

## When to use which reference

- **"Build me a new app / MVP"** → 01 (scope) → 02 (scaffold) → then decide backend (03) + monetize (04).
- **"Set up the App Store / subscriptions"** → 05, and `appstore-connect-automation` for the API calls.
- **"Make screenshots / write the listing"** → 06.
- **"Build and submit" / "ship it"** → run `scripts/preflight.mjs`, read 09, then 07.
- **"Apple rejected us"** → 08 first (find the exact reason + fix), then re-run 09 before resubmit.
- **"It's live, what now"** → 10.

## Composes with — delegate, don't duplicate

This skill is the **orchestrator + the hard-won launch knowledge** (rejection playbook, ASC config,
version discipline). For the mechanical Expo work, **defer to the official skills and tools** — they're
maintained and deeper than anything restated here:

- **`appstore-connect-automation`** — the ASC REST mechanics (JWT signing, pagination, asset upload,
  subscription ordering). This skill's [05-appstore-setup.md](references/05-appstore-setup.md) says WHAT; that skill does HOW.
- **`expo:expo-deployment`** — iOS/Android store deploys, and the **Android/Play Store** path ([11-android-play-store.md](references/11-android-play-store.md)).
- **`expo:expo-cicd-workflows`** — authoring `.eas/workflows/*.yml` (CI build+submit pipelines).
- **`expo:expo-dev-client`** — dev/internal-distribution builds for on-device testing before submit.
- **`expo:building-native-ui`**, **`expo:expo-tailwind-setup`**, **`expo:expo-ui`** — screen/UI construction.
- **`expo:native-data-fetching`** — the fetch/React-Query/streaming patterns referenced in references/02.
- **`expo:eas-update-insights`** — OTA update health (crash rate, embedded-vs-OTA split, rollout gating).
- **`expo:upgrading-expo`** — SDK upgrades between releases.
- **`expo:add-app-clip`** — optional iOS App Clip target.
- **`ux-reviewer`** agent — after every new UI screen.

**Live Expo MCP tools** (load via ToolSearch when driving a real build — you don't have to shell `eas`):
`mcp__plugin_expo_expo__build_run` / `build_submit` / `build_list` / `build_info` / `build_logs`,
`workflow_run` / `workflow_logs`, `testflight_crashes`, `testflight_feedback`, `read_documentation`.
Use these to kick builds, submit, tail logs, and pull TestFlight crashes/feedback from inside the session.

## The meta-lessons (violate these and you WILL get rejected or blocked)

These are load-bearing. Each is expanded in the references, but internalize them here:

1. **Bump the marketing version (`expo.version`), not just the build number, for every release.**
   A version string that's already live on the App Store cannot accept a new build → auto-submit fails
   with "You've already submitted this version." `buildNumber`/`ios.buildNumber` alone is not enough.
   (references/07)

2. **A paywall must never present a subscribe button that can't actually purchase.** If RevenueCat
   offerings haven't loaded, gate the button (`storeReady`) and show a real state — never a silent
   no-op. This is App Review 2.1(b) and it's an instant rejection. (references/04, 08)

3. **The app's core feature must actually work in review — including your paid API dependencies.** Our
   "chat returns the same response" rejection was the Anthropic key at $0 credit. Fund and health-check
   every third-party API before submitting; on failure show an honest error, never a canned reply that
   looks like the app is broken. (references/08)

4. **Screenshots must show the real app UI and NOT display pricing, subscription terms, or other
   platforms.** Pricing in a screenshot = 2.3.7 rejection. Generate on-brand screenshots from actual
   screens. (references/06, 08)

5. **You need a functional Terms/EULA + Privacy Policy link in the app AND in the metadata.** Missing or
   dead links = 3.1.2(c). Ship real `/terms` and `/privacy` URLs and link them in-app (paywall + profile)
   and in App Store Connect. (references/05, 08)

6. **Set `privacyPolicyUrl` on `appInfoLocalizations`, not `appStoreVersionLocalizations`** (the latter
   409s). Fill the Privacy "nutrition label" (App Privacy) honestly — under-declaring is a rejection,
   over-declaring hurts conversion. (references/05)

7. **The FIRST subscription must be submitted attached to a NEW app version.** Standalone submission of a
   first IAP fails; later ones can go alone. And a sub stays `MISSING_METADATA` until EVERY available
   territory is priced + localized + has a review screenshot. (references/04, `appstore-connect-automation`)

8. **Export compliance: set `ITSAppUsesNonExemptEncryption: false`** in `infoPlist` (when true, standard
   HTTPS-only) so every build doesn't stall on an encryption questionnaire. Add the **privacy manifest**
   (`NSPrivacyAccessedAPITypes` reasons for UserDefaults/FileTimestamp/BootTime/DiskSpace). (references/02, 05)

9. **Login-gated apps need working demo reviewer credentials in App Review notes.** For device-keyed
   anonymous apps, say so explicitly so the reviewer doesn't look for a login. (references/09)

10. **A rejected submission owns the version.** Before re-staging you must CANCEL the old submission
    (`PATCH canceled:true`), poll to COMPLETE, then re-create — otherwise you get 409 "This resource
    cannot be reviewed." (references/08)

11. **OTA updates only reach a MATCHING `runtimeVersion`.** With `policy:"appVersion"`, bumping
    `expo.version` starts a new runtime, so an `eas update` cannot patch older installs — ship JS fixes to
    the current version's channel, and reserve version bumps for native releases. Never assume an OTA
    reaches everyone. (references/07)

## Credentials & environment (never commit; keep local)

The pipeline needs, per app:
- **App Store Connect API key** (`AuthKey_<KEYID>.p8`, App Manager role) + **Key ID** + **Issuer ID** —
  NOT the IAP `SubscriptionKey_*.p8` (that 401s against the ASC API). See `appstore-connect-automation` §0.
- `ASC_APP_ID` (numeric app id), `bundleIdentifier`, Expo `projectId`.
- **RevenueCat** iOS public SDK key (+ the ASC In-App-Purchase key uploaded to RC's dashboard).
- Backend/API keys (funded!) if there's a companion backend.

Store secrets in a per-app `secrets.env` outside the repo (e.g. `~/.config/<app>/secrets.env`) and/or CI
secrets — never in the tree. Remind the user they can revoke the ASC API key after a launch.

## How to drive this autonomously

You can scaffold, wire billing, configure ASC (create the app record, subs, metadata, upload
screenshots), build, and prepare the submission without hand-holding. **Stop and get explicit user
confirmation only at the real-world gates:** setting any price/trial terms, and pressing submit-for-review.
Always run `scripts/preflight.mjs` and walk references/09 before you propose submitting.
