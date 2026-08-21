---
description: Capture what just cost you time as an incident, so the harness learns from it
argument-hint: [what bit you]
---

Capture an incident in the Atrix harness.

## Steps

1. Run `atrix learn "$ARGUMENTS"` (if no argument was given, write a short specific title yourself
   from what just happened — not "a bug", but "migrations ran against the wrong database").
2. Open the incident file it created and fill in the four sections **from this session's actual
   history**, not from memory of how such things usually go:
   - **What happened** — the command, the error, the wrong output. Paste the real text.
   - **Why it happened** — the root cause. If you genuinely do not know, write that; a wrong
     confident cause is worse than an honest gap.
   - **What fixed it** — the actual diff or command.
   - **What the system should learn** — the generalisable part, or "nothing" if it does not
     generalise. Most do not, and saying so is the correct outcome.
3. Tell the user it is captured and where.

## Do not

- Do not invent detail you did not observe. An incident is a record, not a story.
- Do not distill it in the same step. Capture is deliberately separate from generalising —
  conflating them is how a rule library fills with one-off workarounds.
