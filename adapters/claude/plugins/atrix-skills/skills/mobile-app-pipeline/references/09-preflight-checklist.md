# 09 — Pre-submission preflight checklist

Run **every time** before submitting for App Store review. `scripts/preflight.mjs` automates the
mechanical checks; the human/judgment checks are below. Do not propose submitting until all pass.

## Automated (run `node scripts/preflight.mjs <app-dir>`)

- [ ] `expo.version` (marketing) is **greater than the current live version** (not just buildNumber).
- [ ] `ios.bundleIdentifier` set and valid.
- [ ] App **icon** file exists; splash image set.
- [ ] `eas.json` exists with a build profile (ideally `production`).
- [ ] `ITSAppUsesNonExemptEncryption` present in `infoPlist`.
- [ ] `privacyManifests` / `NSPrivacyAccessedAPITypes` present.
- [ ] A `NS...UsageDescription` string exists for each sensitive permission plugin in use.
- [ ] `extra.apiBaseUrl` points at production (not localhost / a preview URL).
- [ ] RevenueCat key present in `extra` (if monetized).
- [ ] Terms + Privacy URLs resolve (HTTP 200).
- [ ] `--build`: `expo-doctor`, `typecheck`, `lint`, `expo export --platform ios` all succeed.

## Manual / judgment (you must confirm)

**Paywall & purchases**
- [ ] Subscribe button gated on `storeReady`; no live CTA that can no-op (2.1(b)).
- [ ] Price, period, trial terms, auto-renew disclosure, **Restore Purchases**, Terms + Privacy all on the
      paywall.
- [ ] Real purchase tested on a device / sandbox; restore works.

**Core feature actually works in review**
- [ ] Every third-party paid API is **funded** and reachable; failure shows an honest error, not a canned
      reply (2.1(a)).
- [ ] The core loop works from a fresh install with no special setup.

**Screenshots & listing**
- [ ] Screenshots show real UI, **no pricing / trial / promo / other-platform text** (2.3.7).
- [ ] Subtitle, description, keywords truthful and match the shipped build.

**Privacy & legal**
- [ ] `/terms` (EULA) + `/privacy` live, linked in-app AND in ASC (3.1.2(c)).
- [ ] `privacyPolicyUrl` set on `appInfoLocalizations`; App Privacy label filled honestly.

**App Review info**
- [ ] Login-gated → working **demo credentials** in review notes. Anonymous/device-keyed → a note saying
      "no login required."
- [ ] Review notes explain anything non-obvious (network needed, keys funded, how to reach the paywall).

**Subscriptions (first release)**
- [ ] First sub attached to the version; `READY_TO_SUBMIT` (all territories priced + localized + review
      screenshot).

**Build & version**
- [ ] `expo.version` bumped; correct build associated; export compliance resolved.

## Then — and only then

State to the user the **exact version and what's being submitted**, and get an explicit **yes** before
running the submit. If resubmitting after a rejection, confirm the prior submission was **cancelled**
first (references/08).
