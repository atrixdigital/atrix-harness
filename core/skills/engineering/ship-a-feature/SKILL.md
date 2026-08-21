---
name: ship-a-feature
description: The default end-to-end loop for adding a feature to an existing codebase — understand, plan, implement, verify, evaluate, land. Use whenever the task is to build something new in a repo that already exists, rather than a one-line fix.
group: engineering
---

# Ship a feature

The daily loop. Six stages; skipping one is how features arrive broken.

## 1. Understand — before any plan

Query the graph, do not read the repo file by file:

```
atrix_search "<the thing you're extending>"
atrix_context <symbol>          # its neighbourhood
atrix_impact  <symbol>          # what breaks if you change it
```

Find the pattern that already exists. **Most features are a fourth instance of something the repo
does three times already.** Matching that pattern beats inventing a better one — see
[references/existing-patterns.md](references/existing-patterns.md).

Read the repo's `AGENTS.md` for stack, commands and gotchas.

## 2. Plan — only once you can name the files

A plan you cannot express as "these files change, this way" is not a plan yet; go back to stage 1.
For anything touching 3+ files, get the plan approved before writing code.

## 3. Implement — narrow and in the house style

- Match the surrounding code: naming, comment density, error handling, idiom.
- Edit existing files rather than adding new ones.
- Do not add error handling for states that cannot occur.
- Do not widen scope. A related bug you notice is a note, not a detour.

## 4. Verify — you run it, not you read it

Typecheck, lint, and the **relevant** tests. Then exercise the actual path: call the endpoint,
load the page, run the command. See [references/verification.md](references/verification.md) for what
"relevant" means per change type.

## 5. Evaluate — hand it to someone who did not write it

For anything non-trivial, invoke the `evaluator` role with a written rubric. Self-assessment is
unreliable in a specific and dangerous way: it is most confident about work that looks complete
and is not wired up.

## 6. Land — and feed the system

Commit with a message that says why, not what. Then ask: **did anything here cost me time that it
should not have?** If yes, `atrix learn "<what bit you>"`. That is the difference between a team
that gets faster and a team that keeps rediscovering the same trap.

## Bounded recovery applies throughout

If a stage fails: retry (×2) → patch (×2) → replan. Then stop and report. Never loop.
