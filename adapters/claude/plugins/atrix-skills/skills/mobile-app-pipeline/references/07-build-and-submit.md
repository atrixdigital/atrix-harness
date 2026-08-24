# 07 — Build & submit (EAS)

## Version discipline — the #1 build/submit trap

**Bump the MARKETING version (`expo.version` in app.json) for EVERY release — not just the build
number.** A marketing version string that's already live on the App Store cannot accept a new build →
`eas build --auto-submit` fails with **"You've already submitted this version."** (We lost a build to
exactly this — build #10 auto-submit failed because `expo.version` was still `1.0.0`, which was live;
bumping to `1.1.0` fixed it, build #11 submitted fine.)

- `expo.version` = marketing string (1.1.0, 1.2.0) → the App Store version. **Bump every release.**
- `ios.buildNumber` / auto-increment = the build under a version. Multiple builds can share one version
  *before* it's submitted, but a *live* version needs a new marketing version for a new build.
- `runtimeVersion.policy: "appVersion"` ties OTA/runtime to `expo.version` — another reason to bump it.

Pick semver by change size: patch (1.1.0→1.1.1) fix, minor (1.1.0→1.2.0) features, major for big releases.

## OTA vs native build — decide first (this is half of shipping)

- **JS-only change** (UI, copy, business logic, most bug fixes): ship via **`eas update --branch
  <channel>`** — an over-the-air JS bundle, live in minutes, **no App Review, no version bump**. This is
  the default for fixes and fast iteration. Users on the matching runtime get it on next launch.
- **Native change** (new native dependency, permission/usage string, config-plugin, any `app.json` native
  field, SDK upgrade): requires a **full EAS build + submit** through review + a marketing-version bump.
- **Runtime compatibility:** OTA updates only reach builds with a matching `runtimeVersion`. With
  `policy: "appVersion"`, bumping `expo.version` starts a NEW runtime — so an OTA can't patch an older
  build. Plan: native releases bump the version; OTA fixes target the current version's channel.
- Check rollout health with **`expo:eas-update-insights`** (crash rate, install/launch counts,
  embedded-vs-OTA split). Gate or roll back a bad update before it spreads.

## Build

- `eas build --platform ios --profile production` (configure `eas.json` profiles). Or `--auto-submit` to
  build + submit to TestFlight/App Store in one shot. **Or drive it from inside the session** with the
  Expo MCP tools (no shell needed): `mcp__plugin_expo_expo__build_run` (kick a build), `build_list` /
  `build_info` (status), `build_logs` (tail failures), `build_submit` (submit a finished build).
- **CI workflows**: author `.eas/workflows/*.yml` with **`expo:expo-cicd-workflows`** (build → submit on
  push to the release branch). Our apps auto-ship this way. **Respect any standing "don't push / don't
  ship" instruction** — some projects (e.g. PlayO-mobile) require explicit per-release go-ahead before
  the triggering branch is pushed; build + typecheck locally only until told otherwise.
- **On-device pre-submit testing**: use **`expo:expo-dev-client`** for a dev/internal-distribution build
  so you can exercise real purchases, push, and native features before wasting a review cycle.
- Before ANY EAS build: `npx expo-doctor` (catches config/dependency drift), `npm run typecheck`,
  `npm run lint` (0 errors), `npx expo export --platform ios` must all pass. Don't spend build minutes on
  a bundle that doesn't compile.

## Submit

- **Auto-submit** relates the build to the version and submits to TestFlight; from there, promote to App
  Store review.
- **Manual/API submit** (`appstore-connect-automation`): the submission flow is `reviewSubmissions` +
  `reviewSubmissionItems`. Note: `reviewSubmissionItems` list may not return relationships — submit
  directly via `PATCH submitted:true` (the item id decodes to the version numeric id).
- **First release** must include the first subscription attached to the version (references/04).

## Before you press submit

**This is an outward-facing, hard-to-reverse, user-owned action. Run `scripts/preflight.mjs`, walk
references/09, then get an explicit "yes" from the user with the exact version + what's being submitted.**
Never auto-submit for App Store review off a vague "continue."

## After submit

- TestFlight processing takes minutes; App Store review typically hours-to-a-day.
- If **rejected** → references/08 (diagnose the exact reason, fix, and note that a rejected submission
  must be **cancelled** before re-staging or you'll 409).
- Pull TestFlight **crashes** and **beta feedback** from inside the session with
  `mcp__plugin_expo_expo__testflight_crashes` and `testflight_feedback` — fix the top crash before
  promoting a build to production.
