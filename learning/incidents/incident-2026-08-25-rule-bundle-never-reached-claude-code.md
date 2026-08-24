---
id: incident-2026-08-25-rule-bundle-never-reached-claude-code
title: rule bundle never reached Claude Code sessions
date: 2026-08-25
status: merged
cost: 45m
---

## What happened

`atrix build` generates a 36KB bundle — all 18 rules and 6 methodology documents — into
`adapters/claude/plugins/atrix-core/AGENTS.md`. Nothing loaded it.

A live session made it unambiguous:

```
$ claude -p 'what are the three escalation levels of the bounded-recovery rule?
             If you have no such rule in your context, reply exactly: NOT LOADED'
             --plugin-dir .../atrix-core
NOT LOADED
```

Codex and Gemini were fine — they read the bundle file directly. **Claude Code users got the
agents, the skills and the hooks, and none of the rules.** For the agent most of this org uses,
the core of the harness was inert for its entire existence.

## Why it happened

Claude Code plugins ship **skills, agents, commands, hooks and MCP servers**. A rule file is not a
plugin component, and `claude plugin details` confirms it — `AGENTS.md` appears nowhere in the
component inventory.

The mistake was assuming that a file placed inside a plugin gets loaded because it is inside the
plugin. Every other adapter works that way — Codex and Gemini are handed a file path — so the
Claude adapter was built by analogy rather than against the actual contract.

Nothing caught it because everything that could have was structural. `adapters.test.ts` asserts
the bundle *exists* and contains the rules. `claude plugin validate` passes. The manifests are
correct. All of it was true, and none of it was the question, which was whether a model ever sees
the bytes.

## What fixed it

The SessionStart hook injects the bundle through `additionalContext` — a mechanism already built
and already tested, used for situational notes. Rules go first so they sit in the cacheable
prefix; the per-session notes go after (see `core/rules/cache-shape.md`).

The plugin root arrives as an argv parameter rather than an environment variable: the runtime
expands `${CLAUDE_PLUGIN_ROOT}` when it builds the hook command, which is a guarantee, where the
variable surviving into a child process is an assumption.

Verified by rerunning the same live query, which now answers correctly.

## What the system should learn

**Structural verification cannot answer "does the model see this".** Every offline check we had
was passing while the answer was no. The only test that could distinguish them was one that ran a
real agent and asked.

Concretely: **anything whose purpose is to reach a model needs one live assertion.** Not a full
suite — one query per delivery path, asking for something only present if the content loaded. It
is cheap, and it is the only check that is actually about the thing.

`claude plugin details` and `claude plugin validate` should have been run the day the adapter was
written. Both were available the whole time.

## Proposed change

- [x] SessionStart injects the bundle; verified live
- [x] A test asserting the hook emits the rules, so the wiring cannot silently break
- [x] `atrix doctor` runs `claude plugin validate` when the CLI is present
