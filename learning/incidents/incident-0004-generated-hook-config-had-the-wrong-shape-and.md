---
id: incident-0004
title: generated hook config had the wrong shape and would never have fired
date: 2026-08-24
status: merged
cost: 25m
---

## What happened

`atrix build` emitted `hooks.json` with the event map at the top level:

```json
{ "PreToolUse": [...], "PostToolUse": [...], "SessionStart": [...] }
```

Every installed plugin that ships hooks nests the map under a `hooks` key instead:

```json
{ "description": "...", "hooks": { "PreToolUse": [...] } }
```

The file is valid JSON, the build succeeded, all 101 tests passed, `doctor` was green, and
**none of the three hooks would ever have fired**. The safety guard, the trace recorder and the
session-context loader were all inert. `plugin.json` also declared `hooks` as a string where the
working example uses a list.

Found by diffing generated output against plugins known to work, not by any test.

## Why it happened

Every test proved that `core/` was well-formed and that `build()` ran. Not one test looked at the
**artefact we ship** and asked whether its consumer could load it. The shapes were written from
memory of the format rather than checked against a working example.

This is the "green unit tests, broken product" class: a wrong field name parses fine and fails
silently at the only moment that matters, in someone else's session, with no error.

## What fixed it

Correct the emitted shape, then add a test tier that reads the generated output and validates it
against shapes taken from plugins verified to work — manifests, hook event maps, MCP config, agent
frontmatter, cross-agent bundles.

Then prove the guard: reintroduce the bug, watch three tests go red, revert.

```diff
- { PreToolUse: [...], PostToolUse: [...], SessionStart: [...] }
+ { description: '...', hooks: { PreToolUse: [...], PostToolUse: [...], SessionStart: [...] } }
- manifest['hooks'] = './hooks/hooks.json';
+ manifest['hooks'] = ['./hooks/hooks.json'];
```

## What the system should learn

**Anything generated for another program to consume needs a test that reads the generated output**,
asserts it against a shape taken from a working example, and is proven to fail when the shape is
wrong. Testing the generator is not testing the artefact.

Corollary, and the more useful half: **derive formats from a working example, not from memory.**
Both bugs here came from writing what the format looked like rather than checking. The examples
were on this machine the whole time.

## Proposed change

- [x] `packages/cli/src/lib/adapters.test.ts` — a published-artefact test tier
- [x] `core/methodology/testing-policy.md` — verify the world, test the real entry path, prove the guard
- [ ] Nothing
