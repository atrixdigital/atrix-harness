# 04 — Monetization (RevenueCat, single entitlement)

Our default: **binary Free / Premium, one RevenueCat entitlement, one monthly + one annual product, one
paywall.** Keep it this simple until data says otherwise.

## RevenueCat setup

1. In RevenueCat: create the project, add the iOS app, paste the **iOS public SDK key** (`appl_...`) into
   `app.json` → `extra.revenuecatIosKey`. Upload the **App Store In-App-Purchase key**
   (`SubscriptionKey_*.p8`) to RC's dashboard — note this is the IAP key, NOT the ASC API key.
2. One **entitlement** (e.g. "Pro"). One **offering** with two **packages**: monthly + annual.
3. Product IDs must match what you create in App Store Connect (references/05) exactly.

## The billing adapter (client)

Wrap RC behind an adapter with a mock fallback so dev/sim/Expo Go work:
- `configure(deviceId)` — set the RC app user id to the deviceId (ties purchases to the anonymous device).
- `getOfferings()` — returns purchasable packages; empty until the store vends products.
- `purchase(pkg)` / `restore()` — real transactions; map `PurchaseCancelled` to a no-op (not an error).
- `getEntitlement()` — authoritative when it can answer; the store falls back to the server record.

## The paywall — the #1 rejection surface (App Review 2.1(b))

**A subscribe button must never silently no-op.** If offerings haven't loaded, the button cannot
purchase — so gate it. Proven hardening:

- `storeReady` state: only `true` once `getOfferings()` returns real packages. Until then, show local
  fallback prices for display but **disable/relabel the purchase button** — never present a live
  subscribe CTA that does nothing.
- On tap, **re-fetch offerings** if needed and **surface the real purchase error** to the user (and to
  yourself) — don't swallow it.
- Show **price, billing period, and trial terms** clearly. Include **Restore Purchases**, and links to
  **Terms of Use (EULA)** and **Privacy Policy** right on the paywall (3.1.2(c) needs these functional).
- Apple requires the standard auto-renewable-subscription disclosure text near the CTA (renews unless
  cancelled, manage in Settings). Include it.

## App Store Connect side (the exact order matters — see appstore-connect-automation §2)

Subscriptions have hard dependencies; do them in order or you get cryptic 409s:
1. Subscription **group** → 2. **subscription** products (productId matches the app) → 3. **availability**
FIRST (all territories) → 4. **price** in EVERY available territory (use equalizations; price points
paginate) → 5. **intro/free-trial** offer (needs a `territory` relationship) → 6. **localization**
(name ≤30 chars, description) → 7. **review screenshot** (3-step asset upload).

A subscription stays `MISSING_METADATA` until availability + all-territory pricing + localization + trial
+ review screenshot are ALL present. If it's stuck despite everything being set, force a recompute with a
no-op `PATCH` on the localization. The **first** subscription must be submitted **attached to a new app
version** (attach on the version page); later subs can submit standalone.

**Price and free-trial length are user decisions.** Pull them from the locked spec (references/01) or
ask via AskUserQuestion; state exact values and get a yes before writing them. Never invent a price.

## Metering the free tier (for API-cost apps)

Pair the paywall with server + client metering (references/03). Free users hit a daily cap → paywall;
Premium gets generous caps on the expensive paths. This is what makes an AI app's unit economics safe.
