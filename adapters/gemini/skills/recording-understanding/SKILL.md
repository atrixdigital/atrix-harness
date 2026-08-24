---
name: recording-understanding
description: >
  Record hard-won comprehension of how a codebase actually works into the repo's
  UNDERSTANDINGS.md, so the next session does not re-derive it. Use after figuring out
  a non-obvious mechanism, tracing an unclear flow, discovering why something is built
  the way it is, or when asked what you have learned about a system.
group: delivery
---

# Recording understanding

Agents re-derive the same architecture every session. The graph tells you *what calls what*;
it cannot tell you **why the retry lives in the consumer instead of the producer**, or that the
second cron exists because the first one silently stopped firing.

`UNDERSTANDINGS.md` is where that goes. It is the only artefact in this system that is
**descriptive rather than prescriptive**.

## What goes where

| Artefact | Answers | Scope |
|---|---|---|
| `AGENTS.md` | What should I do? | Prescriptive, per repo |
| `UNDERSTANDINGS.md` | How does this actually work, and why? | Descriptive, per repo |
| `learning/incidents/` | What went wrong, for everyone? | Org-wide |
| `handoffs/` | Where is this work right now? | One task, temporary |

If it tells someone what to do, it is a rule. If it explains what is *already true*, it is an
understanding.

## Write one when

- You spent real time working out a mechanism that the code does not state.
- You traced a flow across several files or services to answer one question.
- You found out **why** something is the way it is — a constraint, a history, a workaround.
- You discovered an invariant nothing enforces: "these two tables must be written in this order".
- You ruled something out. A confirmed dead end is worth as much as a discovery and is lost
  completely if unwritten.

Do **not** write one for something the code plainly says. Restating a function signature in prose
is noise that makes the real entries harder to find.

## The format

Append; never rewrite. Each entry:

```markdown
## <the thing understood, as a claim>

**Date:** 2026-08-24
**Confidence:** confirmed | inferred | uncertain
**From:** apps/api/src/booking/slots.ts:120, plus running the slot generator against 3 venues

<The explanation. Lead with the mechanism, then why it is that way if you know.>

<If you ruled something out, say so explicitly — that is the expensive part to rediscover.>
```

Three fields carry the weight:

- **Confidence.** `confirmed` means you executed something or read the definitive code.
  `inferred` means it is consistent with what you saw. `uncertain` is honest and useful — an
  entry marked uncertain gets checked; a wrong entry marked confirmed gets trusted.
- **From.** Where the understanding came from, specifically enough to re-verify. An
  understanding you cannot re-check is a rumour.
- **Date.** Understandings go stale. A dated entry can be judged; an undated one cannot.

## Superseding

When an understanding turns out to be wrong or has been overtaken, **do not delete it**. Add a
line to the original and write a new entry:

```markdown
> **Superseded 2026-09-02** — the retry moved into the producer in #412. See "Retry ownership (v2)".
```

The record of what the team used to believe explains code that was written under that belief.

## Then check upward

If the understanding would be true of *any* Atrix repo, it is not an understanding — it is a rule
or a skill. Run `atrix learn` instead.

If it is only true of this repo, `UNDERSTANDINGS.md` is exactly right.
