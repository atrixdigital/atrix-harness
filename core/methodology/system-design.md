---
name: system-design
description: How to approach designing a system or a significant feature before writing code.
source: founding
applies: [**]
---

## Start from the constraints, not the diagram

Before any boxes and arrows, write down:

- **Scale that actually applies.** Not "what if we're Uber" — what is true in 12 months. Designing
  for imaginary scale is the most expensive mistake available to a small team.
- **What must never break.** Money, auth, data loss. These get the conservative choice.
- **What is allowed to be slow, wrong, or eventually consistent.** Naming this explicitly is what
  buys you simplicity everywhere else.
- **Who operates it at 3am.** A design nobody on the team can debug is a bad design regardless of
  its properties.

## Then the shape

1. **Data first.** Get the model right and most of the system falls out. Get it wrong and no amount
   of service architecture saves you. Write the schema before the endpoints.
2. **Boundaries second.** Where does one area stop meaning what another means (see `ddd`)? Those
   seams are where you can later split a process; everywhere else, don't.
3. **Failure third.** For each external call: what happens when it times out, returns garbage, or
   succeeds twice? If you have not answered this, the design is not finished.
4. **Interfaces last.** Endpoints and UI are the easiest part to change and the least worth
   agonising over early.

## Bias toward boring

Prefer the thing the team already runs. A second database, a new queue, an extra language — each
is a permanent operational cost paid by everyone, forever, to solve a problem that usually had a
duller answer.

**One process until it hurts.** Split when you have a measured reason: independent scaling,
independent deploy cadence, or a hard isolation requirement. Not because a diagram looked tidier.

## Write it down

Anything with more than one reasonable answer gets a short ADR (`write-adr`). The decision matters
less than the reader in six months knowing *why*, and what was rejected.

## Then check it

Give the design to someone who did not write it, with the constraints, and ask where it breaks.
Design review before implementation is the cheapest review there is.
