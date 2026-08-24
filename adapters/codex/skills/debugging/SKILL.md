---
name: debugging
description: Find the actual cause of a failure rather than a plausible one — reproduce, read the real error, bisect with evidence, and prove the fix. Use when something is broken, a test fails unexpectedly, behaviour differs between environments, or an error message needs diagnosing.
group: engineering
---

# Debugging

The goal is not *a* cause. It is **the** cause. Those diverge constantly, and the gap is where
"fixed" bugs come back.

## 1. Reproduce it, or say you cannot

Get the exact command, input and environment that produces the failure. If you cannot reproduce
it, **everything after this is speculation and you must label it as such.**

An intermittent failure is still reproducible — you just need the missing variable. Time of day,
row count, cold cache, second request, concurrent write, a specific record.

## 2. Read the actual error

The whole stack trace, the real log line, the actual response body. Not your recollection of what
that error usually means.

The most expensive debugging sessions start with someone pattern-matching a message to a cause
they have seen before. Read the text in front of you.

## 3. Check the environment before the code

Cheap to rule out, and disproportionately often the answer:

- Wrong `.env` loaded — a tool reading `.env` while the app runs on `.env.local`.
- Stale generated client after a schema change. **This one lies**: the app returns confident wrong
  results and a health check passes.
- Wrong database, wrong port, wrong branch, wrong tenant.
- A dev server that has not restarted since the change.

## 4. Bisect with evidence, not intuition

Narrow the surface by *observing*, not by reasoning about which layer seems likely. A log, a
breakpoint, a direct query, a curl.

`atrix_callers` and `atrix_impact` tell you what actually reaches the failing code, which is
usually smaller and stranger than the mental model.

## 5. Find the first wrong value

Walk back from the symptom to the earliest point where the data stopped being correct. **That
point is the bug**; everything downstream is a consequence. Fixing a consequence produces a fix
that works today and fails differently next month.

## 6. Your theory must explain everything

It must account for *all* the observed behaviour, including the parts that seem irrelevant. A
theory explaining most of it is usually wrong — and the leftover detail is usually the real cause.

If the behaviour is inconsistent, seriously consider that **it is two bugs**. Two bugs
interleaving look exactly like one incomprehensible bug.

## 7. Fix minimally, then prove it

Fix the cause. Do not refactor while you are in there — a fix bundled with cleanup cannot be
reviewed or reverted independently.

Then reproduce the original failure and show it now passes. A fix you have not re-run against the
original reproduction is a hypothesis.

## Bounded recovery applies

Retry (×2) → change approach (×2) → step back and question the framing. Then stop and report what
you know and what you ruled out. Grinding past that point is where hours disappear.

## If it cost real time

`atrix learn "<what actually bit you>"`. Environment traps and stale-client bugs recur across
repos, and the person who hits one has usually stopped noticing by the fourth time.
