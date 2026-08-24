# 03 — Backend pairing (optional companion API)

Only if the app needs server logic (AI, accounts, sync, server-side entitlement checks, analytics,
payments webhooks). Fully-local apps skip this. Our proven pattern is a **Next.js App Router backend on
Vercel** that the mobile app calls directly (native fetch → no CORS).

## Principles

- **Device-keyed, anonymous.** The app sends its `deviceId`; the server keys everything off it. No auth
  server to build, no login wall (better conversion + review).
- **Fail-safe everywhere.** Every route works (or degrades gracefully) even if the DB env var is absent —
  `db()` returns `null` and callers no-op. The site/app must still build and run with no database.
- **Postgres (Neon) via `postgres` (pg).** `prepare:false` behind poolers. Lazy `ensureSchema()` per lib
  (create table if not exists on first use) — no migration ceremony for a solo pipeline.
- **Rate-limit + meter at the edge of expensive paths.** A Postgres-backed atomic limiter caps per-IP
  bursts AND per-device daily/monthly quotas. This is how AI/API cost gets a hard ceiling.

## The metering contract (mirror client `plans.ts`)

The server enforces the SAME numbers the client shows. Client meter = UX (shows the paywall at the cap);
server cap = the real enforcement (can't be bypassed). Keys are UTC-day or UTC-month bucketed so client
and server reset at the same instant.

- Free tier: server verifies the device isn't Premium (against the subscription record / RevenueCat),
  then applies `FREE_DAILY_CAP` (+ any earned bonus). At the cap → HTTP 402 with a `code` the app maps to
  the paywall.
- Premium: verified against the billing provider; expensive sub-features (deep/Sonnet answers, voice
  minutes, vision) get generous monthly caps so cost is bounded even for power users.
- Never hard-fail the core feature when a *sub*-meter is exhausted — **downgrade** (e.g. fall back to the
  cheaper model) rather than return an error. A working cheaper answer beats a wall.

## Entitlement verification (server side)

Cache the subscription record device-keyed, but the DB cache can lag a just-completed purchase — so when
a cap would block, **re-verify against the billing provider (RevenueCat/Stripe) before returning 402** so
a paying member is never wrongly capped. Handle the RevenueCat webhook to keep the record fresh.

## Health-checks that prevent review disasters

- **Every third-party paid API must be funded and reachable.** Add a trivial health path or a boot log
  that fails loudly if a key is missing/unfunded. Our worst rejection was an AI key at $0 credit → the
  app returned an identical fallback every time → "app looks broken" (references/08).
- Return honest errors to the client (`{error, code}`), never a canned success that masks an outage.

## Deploy

- Vercel auto-deploys on push to the production branch. Cron jobs via `vercel.json` `crons` (guard every
  cron with a `CRON_SECRET` bearer check — fail closed if unset).
- Keep the app's `extra.apiBaseUrl` pointed at the production domain; use `EXPO_PUBLIC_API_BASE_URL` to
  point at a local backend for testing.

## Gotcha

Production deploys are outward-facing — if you're on the default branch, branch first, and only push when
the user asks. A vague "continue" is not authorization to deploy to production.
