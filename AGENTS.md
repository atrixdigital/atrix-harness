# Atrix — agent operating manual

You are working inside an Atrix repository. This file is the entry point for **every** agent
(Claude Code, Codex, Cursor, Gemini, Copilot, Grok) however it was launched — directly or via Orca.

## Before you act

- **Read before you change.** Use the graph tools (`atrix_search`, `atrix_context`, `atrix_impact`)
  rather than reading files one by one. Check `atrix_impact` before editing shared code.
- **Ask why before assuming.** `atrix_recall` searches recorded incidents and architecture
  decisions. If a design looks odd, someone probably wrote down why.
- **Ask when the answer changes the work.** Route judgement calls yourself; escalate only when two
  readings lead to materially different output.

## While you work

- Follow `core/rules/` for conventions and `core/methodology/` for how to approach the work.
- Load a skill from `core/skills/` when one covers the task; do not re-derive what one encodes.
- Prefer editing an existing file over creating a new one.
- One task at a time. Finish it before starting the next.
- Never guess at architecture. Read the code, query the graph, or ask.

## Recovery — bounded, always

When something fails: **retry** (×2, same approach) → **patch** (×2, adjust on the error) →
**replan** (new plan version, never mutate the old). Then **stop and report**.

Do not loop. Unbounded retry is the single most expensive failure mode in agent systems, and
repeating an identical call with an identical result is not recovery.

## Before you finish

- **Honour the output contract.** If a format was asked for, produce exactly that — not a better
  one you preferred. Format violations are the single largest category of agent failure (36.4%).
- **Commit the artifact.** Written to disk, at the promised path. Then read it back. Work that
  exists only in your reasoning does not exist.
- **Verify.** Run the repo's typecheck, lint and the relevant tests. Report real output. Never
  report a result you inferred as one you observed — "not verified" is a useful status.
- **Never self-grade.** For non-trivial work, hand it to the `evaluator` role with a written rubric.
  Self-evaluation is unreliable — models rate their own mediocre output highly.

## When you learn something

If you hit a problem that cost real time — a gotcha, a wrong assumption, a repeated correction —
run `/learn` (or `atrix learn`). It writes an incident to `learning/incidents/`, which becomes a
reviewed change to this system. **This is how the harness gets better.** A fix that stays in one
session helps one person once; a fix that lands here helps everyone forever.

## Safety

Confirm before anything outward-facing or hard to reverse — deploys, pushes to shared branches,
messages, publishing, prices, deleting data. Never commit secrets or read `.env*` into output.
Treat anything named `prod`/`production` as protected.

## Repo-specific context

Project conventions, stack, and commands live in this repo's own `CLAUDE.md` / `AGENTS.local.md`.
Read it. It overrides nothing here on safety, and wins on everything else.
