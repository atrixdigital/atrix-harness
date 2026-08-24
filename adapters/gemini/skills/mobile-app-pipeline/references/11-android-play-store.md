# 11 — Android / Play Store

The pipeline is iOS-first, but the architecture (references/02), backend (03), monetization (04),
analytics/retention (10), and OTA (07) are **cross-platform** — you reuse them wholesale. Only the store
configuration and submission differ. **Defer the mechanics to `expo:expo-deployment`** (it covers the
Android build + Play Store submission flow); this file is the delta + the cross-platform gotchas.

## What carries over unchanged
- Expo/RN app code, Zustand store, theme tokens, API client, analytics `track()`.
- RevenueCat (same entitlement; add the **Android** public SDK key — `extra.revenuecatAndroidKey` — and
  a Google Play service-account credential in RC).
- EAS build/submit and `eas update` OTA (same commands, `--platform android`).

## What's different (the Android delta)
- **Store:** Google Play Console, not App Store Connect. No `.p8`/ASC API — use a **Google Play
  service-account JSON** for `eas submit` and RC. `android.package` is the permanent id.
- **Products:** create subscriptions/IAPs in Play Console (base plans + offers model), product ids
  matching the app + RC. Free trials are configured as offers on a base plan.
- **Assets:** feature graphic + phone screenshots + short/full description. Play is stricter about the
  **Data safety** form (its App-Privacy equivalent) and a **content rating** (IARC questionnaire).
- **Adaptive icon:** `android.adaptiveIcon` (foreground + background) — set at scaffold time.
- **Review:** usually faster than Apple; staged/percentage rollout is first-class — prefer it for updates.

## Cross-platform gotchas
- **Version discipline still applies:** `expo.version` maps to `versionName`; `android.versionCode` must
  strictly increase per build. Bump both mindsets together.
- **Permissions:** Android declares permissions in the manifest via config plugins; the privacy-manifest
  (iOS) has no Android analog, but the **Data safety** form does — fill it honestly (same rule: under-
  declaring gets you removed, over-declaring hurts installs).
- **Test the paywall on both stores** — RC entitlement is shared, but purchase UX and restore differ.
- Google Play requires a **privacy policy URL** too (same `/privacy` page works).

## When to add Android
Ship iOS first, learn, then add Android once the core loop and monetization are validated — the marginal
cost is mostly store config, not code. Run this same pipeline with references/05–06 swapped for the Play
Console steps in `expo:expo-deployment`.
