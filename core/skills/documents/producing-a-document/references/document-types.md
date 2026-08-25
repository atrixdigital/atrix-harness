# Document types

## Contents

- Audit
- Technical brief / overview
- System design
- Proposal
- Status report
- Spec
- Choosing between them

Each type has sections a reader expects. A missing one is not a stylistic slip — it is the
document failing to answer the question it was written for.

## Audit

*Ezrov-Engineering-Audit, Catering-Marketplace-Audit*

| Section | Must contain |
|---|---|
| Cover | What was reviewed, for whom, by whom, the exact commit |
| Scope and method | What you looked at, how, and **what you did not check** |
| Summary | The worst three findings, in prose, before any detail |
| Findings | Numbered, **ordered by what hurts first in production** |
| Each finding | The fact, the consequence, where it lives, what to do |

Severity is the whole product. Twenty findings in file order is a list. Ordered by production
impact, it is an argument someone can act on.

Never soften a finding to be diplomatic. Say the thing, then say what it would take to fix.

## Technical brief / overview

*FleetX-Overview, FleetX-Technical-Brief, Ezrov-Project-Overview*

Written for someone who must hold the system in their head after one read — often non-technical
or newly arrived.

- **What it is**, in two sentences, before any architecture
- **What it does for whom** — the user, not the module
- **How it is built** — the stack and the shape, not a file listing
- **What is done and what is not** — honestly, with dates
- **What it would take to go further**

Resist the file tour. Nobody has ever been helped by a directory listing in a brief.

## System design

*Ezrov-Data-Modeling-System-Design, System-Architecture-ATX-CAT-01*

- **The constraints** first — scale that actually applies, what must never break, what is allowed
  to be slow or eventually consistent
- **The data model** — get this right and the rest follows
- **The boundaries** — where one area stops meaning what another means
- **Failure** — for each external call: timeout, garbage, succeeds twice
- **The decisions and what they cost**, including what was rejected and why

A design document that lists only what was chosen is half a document. The rejected options are
what stop the same debate happening again in four months.

## Proposal

*Bookme Medellin, LegalX, SaidalX Equity, Digital-Pakistan-Government-Proposal*

Client-facing and outward-facing. Confirm every figure before it leaves.

- **What we understand you need** — in their words, proving you listened
- **What we will build** — concrete, phased, with what each phase delivers
- **What is explicitly not included** — the section that prevents the argument later
- **Timeline and price** — with the assumptions they depend on stated
- **Why us** — brief, evidenced, no adjectives

**Exclusions are not a defensive footnote.** They are the section that decides whether the
project ends well.

## Status report

*Build-Status-ATX-CAT-03*

- **Where it is**, one paragraph, in plain terms
- **Done and verified** — with what was actually run, separated from *written but unverified*
- **Remaining**, with why
- **Blocked**, with who can unblock it
- **What needs a decision** from the reader

Separating *done* from *verified* is the whole value. Conflating them is how a project reports
green for three weeks and then slips.

## Spec

*Founder_Platform_SRS*

Written so someone can build against it and someone else can accept against it.

- Numbered requirements that can be referenced in a conversation
- Each one testable — if you cannot say how you would check it, it is not a requirement
- Explicit non-goals
- Open questions, named, with who owns each

## Choosing between them

If unsure, ask what the reader will do after reading. Act on problems → audit. Understand the
system → brief. Approve an approach → system design. Approve money → proposal. Know where things
stand → status report. Build the thing → spec.
