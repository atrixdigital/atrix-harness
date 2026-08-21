---
name: git-discipline
description: Branching, commit messages, and what an agent may and may not do with version control.
source: founding
applies: [**]
---

## Never push unless asked

Commit freely; **push only when the human asks.** Some repos in this org carry standing push holds
that persist across sessions — if the repo's `AGENTS.md` says so, honour it every time, not once.

If you are on the default branch and about to commit substantial work, branch first.

## Commit messages

Say **why**, not what — the diff already says what.

```
✗ update booking.ts
✓ Reject bookings that close past midnight

  The slot generator assumed close > open, so venues open 18:00–02:00
  produced an empty grid. 18 of 26 live venues were affected.
```

Subject line in the imperative, under ~70 characters. Body wrapped at ~80, explaining the reasoning
and anything a reviewer would otherwise have to reconstruct.

Do not list every file changed. Do not pad with "various improvements".

## Commit granularity

One logical change per commit. A refactor and a behaviour change in the same commit cannot be
reviewed, reverted, or bisected independently.

## Before committing

Run typecheck and the relevant tests. A commit that does not build is a commit that will bisect
badly six months from now.

## Never

- Amend or rebase commits you did not author in this session.
- Force-push to a shared branch.
- Commit generated output that the build produces (`adapters/` here is the exception — it is
  committed deliberately so consumers can install without a build step, and CI verifies it is
  current).
