# Finding the pattern that already exists

Before writing a new anything, find its siblings.

## How to find them

1. **By shape** — if you're adding an endpoint, list the existing endpoints and open the two most
   recently added. Recency matters: the newest one reflects the current convention, the oldest
   reflects a convention the team has since moved off.
2. **By graph** — `atrix_callers` on the shared helper the siblings use will enumerate them for you.
3. **By test** — the test file for a sibling tells you what the team considers worth asserting.

## What to copy

Copy the **structure and the seams**: file layout, naming, where validation happens, how errors
propagate, what gets logged, how it is tested.

## What not to copy

Do not copy a sibling's bugs or its dead code, and do not copy a pattern the repo is visibly
migrating away from. If the three siblings disagree, the newest wins — and that disagreement is
worth an `atrix learn`, because the next person will hit it too.

## When there is no sibling

Then you are setting the precedent. Say so explicitly in the plan, keep it as boring as possible,
and expect it to be copied — because it will be.
