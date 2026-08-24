---
name: session-handoff
description: Write a handoff so the next session or teammate resumes without re-deriving anything — what was done, what was verified, what remains, and what is known that the code does not show. Use before ending a long session, when context is running out, when handing work to someone else, or when asked for a handoff or status write-up.
group: delivery
---

# Session handoff

Long-running work fails at the seams far more often than in the middle. A handoff is how you stop
the next person — often future you — from rebuilding a mental model that already existed.

Write it to a **file**. A summary in a conversation is lost to compaction; a file survives, and
can be handed to a different agent entirely.

## Write it before you need it

The worst handoffs are written in the last 5% of a context window, which is also where the worst
work happens. Write it when you notice context filling, not when you hit the wall.

## The four things that matter

```markdown
# <topic> — <date>

## State
One paragraph: where this is now, in plain terms. Someone reading only this
should know whether the work is nearly done or barely started.

## Done and verified
- <what changed> — verified by <the command you ran and what it showed>

Separate "written" from "verified". They are different claims and conflating
them is how the next person inherits a broken assumption.

## Not done
- <what remains> — <why it was left: blocked, deferred, out of scope>

## Known but not visible in the code
- <the gotcha, the dead end you already tried, the decision and its reason>

This is the section that saves the most time and gets skipped most often.
A dead end you do not record will be walked again.

## Next step
The single concrete thing to do first. Not a list — the first action.
```

## Rules

- **Verified means you ran it.** Name the command and what it printed. "Should work" is not a
  status; "not verified" is a useful one.
- **Record dead ends.** What you tried that did not work is as valuable as what did, and nobody
  else can recover it.
- **Name the files.** `apps/api/src/booking/slots.ts:120`, not "the booking logic".
- **Say what is uncommitted**, and whether anything is pushed. Work sitting in a dirty tree that
  the handoff does not mention is work that gets lost.
- **State outstanding decisions** that need a human, so they are not silently decided by whoever
  picks it up.

## Where it goes

Into the repo the work belongs to, under a `handoffs/` directory, dated and named for the topic.
Not a scratch directory — the point is that someone else finds it.

## Then check for a rule

If something in "known but not visible" would bite anyone on any repo, that is not a handoff note.
That is `atrix learn`.
