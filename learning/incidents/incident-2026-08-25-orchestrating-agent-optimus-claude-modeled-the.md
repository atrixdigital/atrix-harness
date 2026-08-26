---
id: incident-2026-08-25-orchestrating-agent-optimus-claude-modeled-the
title: Orchestrator invented a domain model instead of confirming it with the user
date: 2026-08-25
status: distilled
cost: ~2 full agent runs (backend ~139 tool calls, frontend ~119 tool calls) built on the wrong schema; required a full domain rewrite and re-dispatch
---

## What happened

Orchestrating agent (Claude, acting as "Optimus") was asked to build Esportel, described by the
user in one line as "esports + hospitality." With no other domain detail available, the agent
invented a full entity model itself — `User.role: player | venue_owner | admin`, `Venue` owned by
`venue_owner`, `Event` hosted at a `Venue`, `Booking` of an event slot — wrote it into `SPEC.md`
and `ADR-0001`, and dispatched three parallel build agents (infra, backend, frontend) against it.
Backend implemented real TDD-verified booking/capacity logic against a live Postgres; frontend
built a full booking-flow UI with Playwright verification. Both completed successfully — well
engineered, but for the wrong product. Only when the user later described the real domain (Hosts
running tournaments, Teams with rosters, Players joining solo or via team, Sponsors, Admin — no
venue concept at all) did it become clear the entire model was fabricated and unrelated to the
actual business.

## Why it happened

The agent treated "internally consistent and plausible" as sufficient grounding for a domain
model. A two-word product description ("esports + hospitality") was extrapolated into a specific,
detailed schema without ever presenting that schema back to the user for confirmation before
implementation started. This is precisely the case `system-design.md` ("data first") and
`AGENTS.md` ("never guess at architecture — read the code, query the graph, or ask") are meant to
cover — but both assume there is *something* to read (existing code, a graph, prior art). For a
brand-new domain with zero existing code, the only available source of truth is the user's own
head, and the agent proceeded without querying it. The agent also asked one general scoping
question earlier in the conversation ("what is Esportel?") and treated the one-line answer it got
as sufficient, rather than following up with the specific entities it was about to commit to
writing code against.

## What fixed it

The user corrected the model directly ("there is no account for venue owner... what we had are
hosts/players/teams/sponsors"). The orchestrator stopped all further implementation, captured this
incident, and — instead of guessing again — asked the user closed-ended scope-confirmation
questions about the *specific* sub-systems in the corrected domain (verification, chat, bracket
format, monetization, sponsor scope) before writing a corrected `SPEC.md` v2 or re-dispatching any
build agents.

## What the system should learn

For a brand-new domain with no existing codebase to derive entities from, "ask" cannot mean one
generic scoping question early in the conversation — it means the proposed entities/actors/roles
themselves must be enumerated back to the user for explicit confirmation before any schema-first
spec is written or any implementation is dispatched. Plausibility of the invented model is not
evidence of its correctness; only the domain owner can confirm that. This generalizes beyond this
one project: any planner-role work (or orchestrator acting as one) that is about to write a
schema/ADR for a domain with zero existing code should treat "confirm the entity list" as a
mandatory checkpoint, not an optional courtesy.

## Proposed change

- [x] New or amended rule in `core/rules/`
- [ ] New or amended skill in `core/skills/`
- [ ] Nothing — one-off, recorded for the record
