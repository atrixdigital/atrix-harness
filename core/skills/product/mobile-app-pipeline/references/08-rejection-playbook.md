# 08 — App Store rejection playbook

Every rejection here is one we actually hit (or an API 409 that blocked a submission), with the **root
cause** and the **fix**, plus the **prevention** now baked into the pipeline. When Apple rejects, find the
guideline number in their message, jump to it here, fix, then **re-run references/09 before resubmitting**.

> Golden rule for resubmission: **a rejected submission still OWNS the version.** You must CANCEL it
> (`PATCH .../reviewSubmissions/{id} {canceled:true}`), poll until it's COMPLETE/gone, THEN re-stage —
> otherwise you get 409 **"This resource cannot be reviewed."**

---

## Contents

- Guideline 2.1(b) — "Subscribe button does nothing" / app incomplete
- Guideline 2.1(a) — core feature returns "the same response" / looks broken
- Guideline 2.3.7 — screenshots show pricing / promotional content
- Guideline 3.1.2(c) — missing/dead Terms (EULA) & Privacy links
- Guideline 5.1.1 / privacy — App Privacy label incomplete or mismatched
- Export compliance stalls (every build asks the encryption questionnaire)
- API-side 409s that block submission (not guideline rejections, but they stop you)
- The pre-submission mindset

## Guideline 2.1(b) — "Subscribe button does nothing" / app incomplete

**What happened:** the paywall showed a subscribe CTA, but RevenueCat offerings hadn't loaded, so tapping
it silently no-oped. Reviewer flagged a non-functional purchase.

**Fix:** gate the button behind a `storeReady` flag (true only once `getOfferings()` returns real
packages); re-fetch offerings on tap; surface the real purchase error. Never render a live subscribe CTA
that can't transact.

**Prevention:** references/04 paywall pattern is now mandatory. Preflight checks the paywall has a
`storeReady`-style guard.

---

## Guideline 2.1(a) — core feature returns "the same response" / looks broken

**What happened:** the AI chat returned an identical fallback message every time → looked broken. **Root
cause: the Anthropic API key was at $0 credit**, so every call failed and hit the canned fallback.

**Fix:** fund the key; make the fallback an honest error, not a canned "success" that masks the outage.

**Prevention:** every third-party paid API must be **funded + health-checked before submit** (references/03).
Never ship a fallback that's indistinguishable from a working reply. Preflight reminds you to verify keys.

---

## Guideline 2.3.7 — screenshots show pricing / promotional content

**What happened:** a screenshot displayed subscription pricing/'​free trial' text. Apple disallows pricing
and promotional claims in screenshots.

**Fix:** regenerate screenshots from real screens with **no price, trial, discount, or other-platform
text** — feature captions only.

**Prevention:** references/06 screenshot rules; the generator never includes price strings. Preflight has
a manual "screenshots price-free?" gate.

---

## Guideline 3.1.2(c) — missing/dead Terms (EULA) & Privacy links

**What happened:** no functional link to Terms of Use / EULA (and/or Privacy Policy) in the required
places.

**Fix:** ship live `/terms` and `/privacy` pages; link them **in-app** (paywall + profile) **and** in App
Store Connect (Privacy Policy URL on `appInfoLocalizations`; EULA link in the app + description).

**Prevention:** references/05/06. Preflight checks the URLs resolve (HTTP 200) and are wired in-app.

---

## Guideline 5.1.1 / privacy — App Privacy label incomplete or mismatched

**What happened / risk:** the App Privacy "nutrition label" under-declared collected data, or the
`privacyPolicyUrl` write 409'd.

**Fixes:**
- Set **`privacyPolicyUrl` on `appInfoLocalizations`**, NOT `appStoreVersionLocalizations` (the latter
  409s).
- Fill the App Privacy questionnaire honestly (device id, usage/analytics, etc.). Under-declaring →
  rejection; over-declaring → conversion hit.

**Prevention:** references/05 privacy section.

---

## Export compliance stalls (every build asks the encryption questionnaire)

**What happened:** builds stalled waiting on an encryption compliance answer.

**Fix/Prevention:** set `ITSAppUsesNonExemptEncryption: false` in `infoPlist` (valid when you only use
standard HTTPS). Baked into the app.json template (references/02).

---

## API-side 409s that block submission (not guideline rejections, but they stop you)

- **`privacyPolicyUrl` 409** on the version localization → set it on `appInfoLocalizations` instead.
- **"This resource cannot be reviewed" 409** → an old rejected submission owns the version; cancel it
  (`PATCH canceled:true`), poll to COMPLETE, then re-stage.
- **`reviewSubmissionItems` returns no relationships** → don't rely on them; `PATCH submitted:true`
  directly (the item id decodes to the version numeric id).
- **"You've already submitted this version"** on auto-submit → the marketing version (`expo.version`) is
  still the live one; bump it (references/07). This is a version-discipline bug, not an Apple flake.
- **Subscription stuck `MISSING_METADATA`** despite everything set → not all territories priced, OR state
  lag → force recompute with a no-op `PATCH` on the subscription localization.
- **Transient 500s on bulk writes** → Apple flakiness; make scripts idempotent and retry.

---

## The pre-submission mindset

Most of our rejections were **self-inflicted and preventable**: an unfunded key, a price in a screenshot,
a no-op button, a stale version string. The preflight (references/09 + `scripts/preflight.mjs`) exists so
these are caught *before* Apple catches them. Run it every single time.
