---
name: appstore-connect-automation
description: >
  Automate App Store Connect end-to-end via its REST API using an App Store Connect
  API key (.p8) — instead of clicking through the web UI. Use for ANY iOS App Store
  Connect task: creating/configuring subscriptions & in-app purchases, setting prices
  (incl. global territory equalization), free trials/intro offers, uploading review
  screenshots, editing app metadata (name/subtitle/description/keywords), managing
  app versions, selecting builds, and submitting for review. Trigger whenever the
  user asks to set up, update, price, or submit anything in App Store Connect / for
  an iOS app, especially if they'd otherwise do it by hand in the dashboard.
group: product
---

# App Store Connect automation (API-first)

**Default strategy: never hand-click App Store Connect when the REST API can do it.**
Use an App Store Connect API key to script subscriptions, pricing, metadata, screenshots,
and submissions. This is faster, repeatable, and scriptable across projects.

## 0. Get the credentials (3 values)

You need THREE things — the `.p8` file alone is NOT enough:

| Value | Where | Notes |
|---|---|---|
| `.p8` private key | `~/.appstoreconnect/AuthKey_<KEYID>.p8` (altool/fastlane store it here) or **App Store Connect → Users and Access → Integrations → App Store Connect API → Team Keys** | The original filename `AuthKey_<KEYID>.p8` encodes the Key ID. |
| **Key ID** | same page, or from the `AuthKey_<KEYID>.p8` filename | ~10 chars |
| **Issuer ID** | top of the **App Store Connect API** tab | account-level UUID (same across the account's team keys) |

**CRITICAL distinction — two different key types that look alike:**
- **`AuthKey_*.p8`** = App Store Connect API key → manages app **content/metadata** (what this skill uses). `aud: appstoreconnect-v1`.
- **`SubscriptionKey_*.p8`** = In-App Purchase key → App Store **Server** API (receipts/transactions) only. **Returns 401** against the App Store Connect API. RevenueCat wants this one for its dashboard; the ASC API does not.

If the user only has the IAP key, they must generate an **App Store Connect API** key (App Manager role is enough; Admin if a call 403s). Check `~/.appstoreconnect/` first — it's often already there from a prior `eas`/fastlane run. To recover a Key ID from a renamed file, `find ~ -iname "AuthKey_*.p8"`.

## 1. Mint the JWT (ES256) — the part everyone gets wrong

Node's `crypto.sign` defaults to DER signatures; the JWT spec needs raw r‖s. Use
`dsaEncoding: "ieee-p1363"`. See `scripts/asc.mjs` for the ready helper.

```js
const sig = crypto.sign("sha256", Buffer.from(`${header}.${payload}`),
  { key: p8, dsaEncoding: "ieee-p1363" });
```
Header `{alg:"ES256", kid:KEY_ID, typ:"JWT"}`, payload `{iss:ISSUER, iat, exp: iat+1100, aud:"appstoreconnect-v1"}`. Tokens last ≤20 min — regenerate inside long loops.

Always **verify auth first** with a read: `GET /v1/apps` → expect `200` + the app list.

## 2. Subscription setup — exact order (order matters!)

Apple enforces dependencies. Do them in this sequence or you get cryptic 409s:

1. **Subscription Group** → `POST /v1/subscriptionGroups` (or reuse existing via `GET /v1/apps/{id}/subscriptionGroups`).
2. **Subscription** → `POST /v1/subscriptions` with `productId` (e.g. `monthly`, `yearly`), `subscriptionPeriod` (`ONE_MONTH`/`ONE_YEAR`). **Product IDs must match the app code** — confirm them.
3. **Availability FIRST** → `POST /v1/subscriptionAvailabilities` `{availableInNewTerritories:true, availableTerritories:[all 175 from GET /v1/territories]}`. Pricing/offers 409 with *"You need to set up availabilities first"* otherwise.
4. **Price (all territories)** → take the base (e.g. USA) price point, then `GET /v1/subscriptionPricePoints/{id}/equalizations` and `POST /v1/subscriptionPrices` for **every** territory. The UI auto-equalizes; the API does not — and a subscription stays `MISSING_METADATA` until **every available territory is priced**.
   - Price points are **paginated** (`limit=200`, follow `links.next`; ~800 points). Pick the one closest to your target price.
5. **Free trial / intro offer** → `POST /v1/subscriptionIntroductoryOffers` `{duration:"ONE_WEEK", numberOfPeriods:1, offerMode:"FREE_TRIAL"}` + a **`territory` relationship** (required; loop territories for global).
6. **Localization** → `POST /v1/subscriptionLocalizations` `{locale:"en-US", name, description}` (name ≤30 chars). Plus group localization `POST /v1/subscriptionGroupLocalizations`.
7. **Review screenshot** (3-step asset upload — last thing keeping state at `MISSING_METADATA`):
   - `POST /v1/subscriptionAppStoreReviewScreenshots` `{fileName,fileSize, subscription}` → returns `uploadOperations[]` + `id`
   - For each op: `fetch(op.url, {method:op.method, headers:from op.requestHeaders, body: bytes.subarray(offset,offset+length)})`
   - `PATCH /v1/subscriptionAppStoreReviewScreenshots/{id}` `{uploaded:true, sourceFileChecksum: md5hex}`
   - No real screenshot yet? Generate an on-brand paywall PNG (PIL) to reach `READY_TO_SUBMIT` for sandbox testing; tell the user to swap a real grab before final review.

State goal: `MISSING_METADATA` → **`READY_TO_SUBMIT`**. Verify with `GET /v1/subscriptions/{id}`.
> The **first** subscription must be submitted **with a new app version** (attach it on the version page). Later ones can be submitted standalone.

## 3. App metadata, versions, builds, submission

Same key, same pattern:
- **Metadata** (name, subtitle, description, keywords, promo, URLs): `appStoreVersionLocalizations` (`PATCH`/`POST`), `appInfoLocalizations` (name/subtitle).
- **Versions**: `appStoreVersions` (create a new version, set release type).
- **Build selection**: relate an uploaded build to the version (`PATCH /v1/appStoreVersions/{id}/relationships/build`).
- **Screenshots**: `appScreenshotSets` + `appScreenshots` (same 3-step asset upload as review screenshots).
- **Submit for review**: `reviewSubmissions` + `reviewSubmissionItems` (App Store Connect API ≥ the submission flow). **Always confirm with the user before submitting** — it's an outward-facing, hard-to-reverse action.

## 4. Hard-won gotchas (don't relearn these)

- **IAP key ≠ ASC API key** → 401 if you use the wrong one. (#0)
- **Availability before pricing**, always. (#2.3)
- **Every available territory must be priced** or it's `MISSING_METADATA`. Use equalizations. (#2.4)
- **Price points paginate**; a naive first-page "closest" gives wildly wrong prices ($24.90 for a $228 target). (#2.4)
- **Intro offers require a `territory`** relationship.
- **Transient 500s** from Apple are common on bulk writes → make every script **idempotent** (read existing first, skip, retry the failures).
- **Review screenshot is the last `MISSING_METADATA` blocker** after price+localization.
- **State lags after bulk writes.** A subscription can stay `MISSING_METADATA` even when fully complete (availability + all-territory prices + localization + trial + screenshot all present and identical to a sibling that's already `READY_TO_SUBMIT`). Apple recomputes state on *edit*, not on a timer. **Force it with a no-op `PATCH /v1/subscriptionLocalizations/{id}`** (re-save the name/description) → flips to `READY_TO_SUBMIT` immediately. Don't just poll and wait — nudge it.
- JWT must be **ieee-p1363** signature encoding, not DER. (#1)

## 5. Safety / authorization (required)

- **Prices and submissions are real-world, user-owned decisions.** Before writing any **price**, free-trial terms, or **submitting for review**, state the exact values and get an explicit **yes** (use AskUserQuestion). Never invent prices — pull them from the app's own config or ask.
- Use the key **only locally** to call Apple's API; never exfiltrate the `.p8`.
- Do **not** touch the **Paid Applications agreement** or **banking/tax** — direct the user to do those by hand (financial credentials).
- Remind the user they can **revoke** the API key after (Users and Access → Integrations).

## Reusable helper

`scripts/asc.mjs` — drop-in: env-configured (`ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_P8`, `ASC_APP_ID`), exports `token()`, `api(method, path, body)`, `getAll(path)` (pagination), and `uploadAsset(reservePath, filePath, subjectRel)`. Copy it next to a task script and import, or run with `node` directly.
