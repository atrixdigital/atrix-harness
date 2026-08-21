---
description: Turn a captured incident into a reviewable proposed change to the harness
argument-hint: [incident-NNNN]
---

Distill an incident into a candidate change.

## Steps

1. Run `atrix distill $ARGUMENTS` (with no argument it lists what is pending). It refuses
   incidents that are not filled in — if it does, finish the write-up first.
2. Read the incident in full, then fill in the candidate it drafted:
   - **The generalisation** — what is true beyond this one occurrence.
   - **Who this bites** — if it is one repo, it belongs in that repo's `AGENTS.md`, not here.
   - **Proposed change** — the actual diff. New rules carry `source: <incident-id>` in frontmatter.
   - **Why this earns its place** — it costs context in every session forever. What does it buy?
   - **How we would know it stopped mattering** — the prune condition.
3. If the change is a rule, apply it under `core/`, then run `atrix build` and `atrix doctor`.
4. Report what you propose and why. **Do not commit or push** — learned changes are human-reviewed
   before they reach every repo in the org.

## The most likely correct outcome is dismissal

Ask first whether a machine can catch this instead — a CI check, a hook, a type, a test. If it can,
that beats a rule: it costs nothing at runtime and cannot be forgotten. **Rules are for judgement
that cannot be automated.**

If you dismiss it, say so in the candidate with the reasoning and set `status: dismissed`. See
`learning/candidates/incident-0002.md` for the worked example. A rule library grows by refusing
things.
