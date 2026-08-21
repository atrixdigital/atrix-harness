---
id: incident-0002
title: adapters went stale because build was not rerun
date: 2026-08-21
status: dismissed
cost: unknown
---

## What happened

A PR changed `core/rules/safety.md` but did not rerun `atrix build`, so `adapters/`
still carried the previous text. Consumers installing the plugin got the old rule.

## Why it happened

`adapters/` is generated but committed, so nothing forced regeneration. The
contributor had no signal that the two were out of sync.

## What fixed it

A CI step that reruns `atrix build` and fails if `git diff --quiet -- adapters`
reports changes.

## What the system should learn

<!-- The generalisable part. This becomes a rule, a skill change, or nothing.
     "Nothing" is a valid and common answer — not every incident generalises. -->

## Proposed change

- [ ] New or amended rule in `core/rules/`
- [ ] New or amended skill in `core/skills/`
- [ ] Nothing — one-off, recorded for the record
