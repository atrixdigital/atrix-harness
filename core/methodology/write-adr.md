---
name: write-adr
description: When and how to record an architecture decision so the reasoning survives the people who made it.
source: founding
applies: [**]
---

An ADR exists so that the person who asks "why on earth is it done this way" in a year gets an
answer instead of guessing. It is cheap to write and expensive to not have.

## Write one when

- The decision has more than one reasonable answer and you picked one.
- It will be **expensive to reverse** — a datastore, an auth model, a tenancy strategy, a protocol.
- Someone will otherwise "fix" it later without knowing what it was solving.

Do **not** write one for choices with an obvious default, or for things the code states plainly.

## Format

Keep it to one page. Longer ADRs do not get read, and an ADR nobody reads is worse than none —
it creates the illusion of a record.

```markdown
# ADR-007: Kysely over Prisma for the booking service

Status:   accepted            # proposed | accepted | superseded by ADR-012
Date:     2026-08-20
Deciders: <who was in the room>

## Context
What forces are at play. The constraint, the problem, what we already run.

## Decision
What we are doing. Present tense, active: "We use X."

## Consequences
What this makes easy. What it makes hard. What we now have to live with —
including the bad parts, honestly.

## Alternatives considered
Each with one line on why it lost. This is the section that gets read.
```

## Rules

- **Never delete or rewrite an accepted ADR.** Supersede it with a new one and link both. The
  record of a decision that turned out wrong is more valuable than the tidy version.
- Record the alternatives honestly, including the one you nearly picked.
- If the decision came from a specific failure, link the incident. `learning/incidents/` and
  `docs/adr/` describe the same history from two directions.
