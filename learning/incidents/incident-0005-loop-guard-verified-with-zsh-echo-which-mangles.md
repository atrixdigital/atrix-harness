---
id: incident-0005
title: loop guard verified with zsh echo, which mangles JSON escapes
date: 2026-08-24
status: merged
cost: 20m
---

## What happened

While verifying the new loop guard end to end, the detailed nudges at thresholds 5 and 8 appeared
to emit invalid JSON:

```
json.decoder.JSONDecodeError: Invalid control character at: line 1 column 238
```

Twenty minutes went into hunting a serialisation bug in `reminder()` that did not exist. Writing
the same output to a file with `> out.txt` instead showed it was valid JSON all along.

## Why it happened

The verification pipeline was `out=$(hook); echo "$out" | python3 ...`.

**zsh's builtin `echo` interprets backslash escapes by default** (bash's does not). The hook
correctly emitted `\n` as the two characters backslash-n inside a JSON string; `echo` converted
them into real newlines, which are illegal inside a JSON string literal. The corruption happened
in the test harness, after the code under test had already produced correct output.

## What fixed it

Nothing in the hook — it was correct. The fix is to the verification:

- `printf '%s'` instead of `echo`, or redirect the process output straight to a file.
- And a real test rather than a shell demo: `core/hooks/lib/hook-output.test.ts` serialises every
  threshold message and asserts the line contains no control characters and round-trips intact.

## What the system should learn

**A verification harness is code, and it can be the thing that is broken.** The whole point of
`testing-policy`'s "verify the world, not the self-report" is that observation beats assertion —
but that only holds if the observation instrument is trustworthy. A shell pipeline that silently
rewrites its input is not.

Concretely: **prefer an in-process test over a shell demo whenever the output has escaping.**
Shell quoting, `echo` variants and here-doc handling differ between shells and between
interactive and non-interactive invocations, and every one of those differences can manufacture a
bug that is not there — or hide one that is.

The second half is worse than the first. This time it produced a false positive; the same
mechanism could just as easily have made malformed output look fine.

## Proposed change

- [x] `core/hooks/lib/hook-output.test.ts` — assert hook payloads in-process
- [x] Note added to `core/methodology/testing-policy.md`
- [ ] Nothing
