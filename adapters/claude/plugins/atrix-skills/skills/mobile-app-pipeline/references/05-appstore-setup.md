# 05 — App Store Connect setup (via REST API)

Do this by **API, not hand-clicking** — faster, repeatable, scriptable across apps. The low-level
mechanics (JWT ES256 signing with `ieee-p1363`, pagination, 3-step asset upload, subscription ordering)
live in the sibling skill **`appstore-connect-automation`**; use its `scripts/asc.mjs` helper
(`token()`, `api()`, `getAll()`, `uploadAsset()`, `priceAllTerritories()`). This file is the checklist of
WHAT to configure and the app-record gotchas.

## 0. Auth (get this right first)

Three values, and the right key type:
- **`AuthKey_<KEYID>.p8`** = App Store Connect API key (App Manager role) → manages app content/metadata.
  This is the one you need. `aud: appstoreconnect-v1`.
- **`SubscriptionKey_*.p8`** = In-App-Purchase key → App Store *Server* API only; **401s** here. (It's the
  one RevenueCat wants in ITS dashboard.)
- **Key ID** (in the filename) + **Issuer ID** (account-level UUID, top of the API keys page).

Check `~/.appstoreconnect/` first — a prior `eas`/fastlane run often left the `.p8` there. Verify auth
with a read (`GET /v1/apps` → 200) before anything else. Env: `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_P8`,
`ASC_APP_ID`.

## 1. App record

- Create the app (bundle id, name, primary language, SKU) if it doesn't exist, or reuse `ASC_APP_ID`.
- **App name** (≤30 chars) + **subtitle** (≤30) live on `appInfoLocalizations`.
- **Category**, content rights, **age rating** (fill the questionnaire honestly).

## 2. Version + metadata (`appStoreVersions` + `appStoreVersionLocalizations`)

- Create a version matching `expo.version`. Set release type (manual or automatic).
- Per-locale: **description**, **keywords** (100 chars, comma-separated, no spaces wasted), **promotional
  text**, **support URL**, **marketing URL**, **what's new**.
- **Screenshots** attach to the version (references/06).

## 3. Privacy (two separate things — both required)

- **Privacy Policy URL** → set on **`appInfoLocalizations`** (setting it on the version localization
  **409s**). Ship a real `/privacy` page.
- **App Privacy "nutrition label"** (data collection disclosures) → declare honestly what you collect
  (for our device-keyed apps: usually "Identifiers → Device ID", "Usage Data" if you have analytics, and
  nothing linked to identity). Under-declaring = rejection; over-declaring tanks conversion.

## 4. Subscriptions (if monetized)

Follow the exact ordered flow in references/04 + `appstore-connect-automation` §2. Remember: **every
available territory must be priced** (equalizations; price points paginate ~800 entries — a naive
first-page "closest" gives wildly wrong prices), and the **review screenshot is the last
`MISSING_METADATA` blocker**. First sub submits attached to the first version.

## 5. Build association + export compliance

- Relate the uploaded build to the version (`PATCH /v1/appStoreVersions/{id}/relationships/build`).
- With `ITSAppUsesNonExemptEncryption:false` in the app (references/02), export compliance auto-resolves;
  otherwise you'll answer the encryption questionnaire per build.

## 6. App Review information

- **Demo account** if login-gated (references/09). For anonymous device-keyed apps, add a review note:
  "No login required — the app works immediately; it's keyed to an anonymous device id."
- Contact info + notes explaining anything non-obvious (e.g. "AI answers require network; keys are
  funded").

## Idempotency & flakiness

Apple throws transient 500s on bulk writes and **state lags after bulk writes** (a fully-configured sub
can still read `MISSING_METADATA`). Make every script **read-existing-then-write** (idempotent), retry
failures, and **force state recompute with a no-op `PATCH`** rather than polling forever. See the
gotchas in `appstore-connect-automation` §4.

Next: references/06 (assets) → references/07 (build+submit) → references/09 (preflight) → submit.
