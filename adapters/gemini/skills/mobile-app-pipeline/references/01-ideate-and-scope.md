# 01 — Ideate & scope

Goal of this phase: turn a fuzzy idea into a **one-page spec** concrete enough to scaffold, and lock the
handful of decisions that are expensive to change later (name/bundle id, monetization model, whether
there's a backend). Don't over-plan — decide these, then build.

## The one-page spec (fill this in with the user)

1. **One-sentence promise.** "An AI CTO in your pocket for founders." If you can't say it in a sentence,
   the App Store subtitle and the onboarding won't land either.
2. **Primary user + primary job.** Who opens this, and what single job do they hire it for?
3. **Core loop.** The 2–4 screen loop the user repeats (e.g. ask → stream answer → save/share). Everything
   else is secondary.
4. **Cadence.** Is it a daily-habit app (social, tracker, game) or a consultative/episodic app (advisor,
   booking, utility)? This decides your retention model — don't fake daily hooks on an episodic app.
5. **Monetization model** (decide now — see below).
6. **Backend?** Does it need one (accounts, AI, sync, payments-server, analytics) or is it fully local?
7. **Name + bundle id.** `com.<owner>.<app>`. The bundle id is permanent once the app record exists.
8. **The "aha".** The first-session moment that proves value. Design onboarding to reach it fast.

## Monetization model — pick ONE, keep it simple

Our proven default is **binary Free / Premium via a single RevenueCat entitlement.** Do not build
multiple paid tiers unless there's a real reason — every tier multiplies App Store, RevenueCat, and
pricing work, and rarely lifts revenue early.

| Model | When | Notes |
|---|---|---|
| **Free + single Premium sub** (default) | Almost always | One entitlement, one monthly + one annual product, one paywall. See references/04. |
| Free only | Portfolio / lead-gen / pre-monetization | Still need Terms/Privacy; no IAP review complexity. |
| One-time purchase | Rare for our stack | Non-consumable IAP; no RevenueCat needed but it's still nice. |
| Usage-metered free tier → paywall | AI/API-cost apps | Meter the expensive path (see references/03 metering) so free-tier cost has a ceiling. This is how we gate AI apps. |

**Decision to lock:** free-tier limits (daily message cap, etc.), what Premium unlocks, monthly + annual
price points, and free-trial length. You (Claude) propose sensible numbers; the **price and trial are a
user decision** — confirm them before writing any price into ASC.

## Scope discipline

- **MVP = the core loop + onboarding + paywall + Terms/Privacy.** That is a shippable app. Everything
  else is a fast-follow update (you can ship updates weekly).
- Prefer **1 great core screen** over 5 mediocre ones. Reviewers and users both punish shallow breadth.
- If the app has AI or any third-party paid API, **budget for funded keys** from day one — an unfunded
  key looks like a broken app to a reviewer (real rejection, see references/08).

## Output of this phase

A short spec doc committed to the repo (`docs/SPEC.md` or similar) capturing the eight items above plus
the locked monetization numbers. Then move to references/02 to scaffold.
