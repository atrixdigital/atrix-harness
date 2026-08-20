# Atrix — agent operating manual

You are working inside an Atrix repository. This file is the entry point for **every** agent
(Claude Code, Codex, Cursor, Gemini, Copilot, Grok) however it was launched — directly or via Orca.

## Before you act

- **Read before you change.** Use the graph tools (`atrix_search`, `atrix_context`, `atrix_callers`,
  `atrix_impact`) rather than reading files one by one. If they are unavailable, run `atrix doctor`.
- **Check `atrix_impact` before editing shared code.** Know the blast radius first.
- **Ask when the answer changes the work.** Route judgement calls yourself; escalate only when two
  readings lead to materially different output.

## While you work

- Follow `core/rules/` for conventions and `core/methodology/` for how to approach the work.
- Load a skill from `core/skills/` when one covers the task. Do not re-derive what a skill encodes.
- Prefer editing an existing file over creating a new one.
- One task at a time. Finish it before starting the next.
- Never guess at architecture. Read the code, query the graph, or ask.

## Recovery — bounded, always

When something fails, escalate in exactly three levels and stop:

1. **Retry** — transient failure, same approach. Max 2.
2. **Patch** — adjust the approach based on the error. Max 2.
3. **Replan** — the plan was wrong. Write a new plan version; never mutate the old one in place.

After level 3 fails, **stop and report**. Do not loop. Unbounded retry is the single most
expensive failure mode in agent systems.

## Before you finish

- **Verify.** Run the repo's typecheck, lint and the relevant tests. Report real output.
- **Never self-grade.** For non-trivial work, hand it to the `evaluator` role with a written rubric.
  Self-evaluation is unreliable — models rate their own mediocre output highly.
- **Report faithfully.** If tests fail, say so with the output. If you skipped something, say that.

## When you learn something

If you hit a problem that cost real time — a gotcha, a wrong assumption, a repeated correction —
run `/learn` (or `atrix learn`). It writes an incident to `learning/incidents/`, which becomes a
reviewed change to this system. **This is how the harness gets better.** A fix that stays in one
session helps one person once; a fix that lands here helps everyone forever.

## Safety

- Confirm before anything outward-facing or hard to reverse: deploys, pushes to shared branches,
  sending messages, publishing, changing prices, deleting data.
- Never commit secrets. Never read `.env*` contents into output.
- Treat anything named `prod`/`production` as protected.

## Repo-specific context

Project conventions, stack, and commands live in this repo's own `CLAUDE.md` / `AGENTS.local.md`.
Read it. It overrides nothing here on safety, and wins on everything else.
