---
id: incident-0007
title: SessionStart payload truncated, so no rule ever reached Claude Code
date: 2026-08-26
status: merged
cost: 2h
---

## What happened

Every one of the 19 rules in `core/` was being silently dropped before it reached Claude Code.
Only the 60-line manual head of `AGENTS.md` arrived. This had been true since the SessionStart
delivery path was built, and `atrix verify --live` reported it as passing the whole time.

Found by accident: after adding a `house-style` rule, a live probe answered `NOT LOADED`.

## The measurement

Probing rules by their byte offset in the 38,128-character bundle:

| Offset | Rule | Result |
|---|---|---|
| 3,258 | `bounded-recovery` heading | present |
| 3,400 | `bounded-recovery` body (side-effect classes) | **absent** |
| 4,620 | `cache-shape` | **absent** |
| 20,673 | `house-style` | **absent** |
| 33,984 | `typescript-strict` | **absent** |

A controlled canary plugin emitting a payload of known size, with a token at each end:

| Payload | Tail token |
|---|---|
| 1,000 | present |
| 5,000 | present |
| 8,000 | present |
| 10,000 | **absent** |
| 20,000 | **absent** — model reported *"only the first 2KB preview was inlined"* |

**Claude Code inlines only a ~2KB preview of a hook payload once the payload passes ~10,000
characters.** It reports this nowhere the developer can see. The notes the hook computes — env
conflicts, exposed secrets, repeated failures, un-onboarded projects — sat below the bundle and
were therefore also being discarded.

## Why the check passed

`atrix verify --live` asked: *"what are the three escalation levels of the bounded-recovery rule?"*

That answer appears twice in the payload — once in the rule at char 3,258, and once in the manual
head under `## Recovery — bounded, always`, which is inside the surviving 2KB. The model was
quoting the manual, verbatim, and the check could not tell the difference.

**A probe whose answer exists earlier in the payload cannot detect truncation.** The check now
targets `write-adr`, the last rule alphabetically at ~36k of ~38k — the first thing any cap eats —
and asserts on a detail that appears nowhere else.

## The fix

Rules move to the workspace `CLAUDE.md`, which is the native path for always-on content and has no
such cap. The SessionStart hook keeps only the situational notes, which are small.

**Inlined, not `@`-imported.** The import was tried first and worked at the harness root:

```
@adapters/claude/plugins/atrix-core/AGENTS.md
```

and resolved to nothing from `projects/anything`, because **an import path resolves against the
agent's working directory, not against the file that contains it**. Since all real work happens in
`projects/*`, that form fails exactly where it matters. `atrix build` now writes the full bundle
into `CLAUDE.md`; parent-directory `CLAUDE.md` files load from any subdirectory, so this reaches
every project. Verified live from `projects/` for rules at char 20,673 and 36,437.

Guards added in `packages/cli/src/lib/adapters.test.ts`: CLAUDE.md contains every `## rule-name`
heading present in the bundle, and contains no `@` import. Both were confirmed to fail when the
generator is reverted, and pass when it is restored — the first attempt at these guards could not
fail at all, because `beforeAll` rebuilds the file the test was editing.

## The rule

**When content is delivered through a channel you do not control, probe the far end of it.**
Size caps, truncation and previews do not announce themselves; they look exactly like content that
was never important. Ask for the last thing in the payload, and pick a question that nothing
earlier in the payload can answer.

This is the third incident in this repo with the same shape — after
`incident-2026-08-25-rule-bundle-never-reached-claude-code` and [[incident-0004]] — and the second
where the verification designed to catch it was itself fooled. Structural checks answer "is the
file correct". Only a live probe answers "does the model see this", and only if the probe is
positioned where the failure would show.

Related: [[incident-0006]] — same lesson from the rendering side.
