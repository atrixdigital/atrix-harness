---
name: verifying-ui-visually
description: >
  Look at the interface you built before calling it done — render it, screenshot every
  breakpoint, theme and state, critique the images, then fix what you see. Use after
  building or changing any UI, when a layout "looks off" without an obvious cause, before
  handing UI work to a human, or when checking responsive, dark mode or empty and error
  states.
group: engineering
---

# Verifying UI visually

**Reading the code you just wrote cannot tell you what it looks like.** Overflow, clipping,
collapsed spacing, invisible focus rings, text that wraps into two lines at one breakpoint — all of
them are invisible in the source and obvious in a screenshot.

This is the same failure this repo keeps re-learning: structural checks answer "is it correct",
never "does it look right". The only instrument for the second question is your own eyes on a
rendered image.

## The loop

1. **Render** it — dev server, or the built page. Not a description of it.
2. **Screenshot** every breakpoint, theme and state that matters.
3. **Look at the images.** Actually open them. A screenshot you captured and did not view is a file,
   not a verification.
4. **Fix**, then re-shoot the same set. Never fix from memory of the first pass.

Two passes minimum. The first catches the broken thing; the second catches what the fix broke.

## What to capture

**Breakpoints — 375, 768, 1280, 1920.** 375 is the one that fails, and it is the one most often
skipped. Nothing may scroll horizontally at any width; wide content (tables, code, diagrams)
scrolls inside its own container, not the page.

**Themes — light, dark, and system.** System is the default and stamps no attribute, so it is a
third case, not a synonym for light.

**States — every one the component can be in:**

| State | The question |
|---|---|
| Empty | Does it invite an action, or look broken? |
| Loading | Does the layout hold its shape, or jump when data lands? |
| Error | Does it say what happened and what to do? |
| Long content | A 60-character name, 200 rows, a paragraph where one line was assumed |
| Short content | One item. Does the grid collapse into something strange? |
| Focus | Tab through it. Is the focus ring visible on **every** background? |
| Disabled / read-only | Still legible, or greyed into invisibility? |

The empty and error states are where design effort is skipped and where users end up.

## Capturing them

Playwright is available and is the right tool — it takes a URL, a viewport and a screenshot in one
call, and it can drive state (click, hover, fill) before shooting.

```
navigate → set viewport → screenshot → set data-theme=dark → screenshot
```

For a full page, capture full-height rather than the fold. For a component, capture the component's
bounding box so detail survives at a readable resolution.

**Resolution matters more than it sounds.** A low-resolution screenshot makes `--` look like an
em-dash, hides a 1px misalignment, and makes bad kerning look fine. Shoot at 2× when judging
typography or spacing.

## Critiquing the screenshot

Look for these in order — the list is roughly by how often each is wrong:

1. **Alignment.** Do edges line up down a vertical? Optical misalignment reads as sloppiness
   before anyone can name it.
2. **Spacing rhythm.** Is the gap between a heading and its content smaller than the gap to the
   next section? If not, the grouping is wrong and the page reads as a flat list.
3. **Hierarchy.** Squint, or blur the image. The most important thing should still be the most
   prominent. If everything survives the squint equally, nothing is emphasised.
4. **Contrast.** Body text 4.5:1, UI edges 3:1. Check in **both** themes — a token that passes on
   white often fails on near-black.
5. **Density.** Too tight reads cheap, too loose reads unfinished. Compare against the rest of the
   product, not against nothing.
6. **The one-accessory test.** Find the element that would improve the design by being removed.
   There is almost always one.

Write down what you find before fixing. A list you fix from beats fixing whatever you noticed last.

## Do not self-certify

Visual work is exactly where self-assessment is least reliable — it looks finished before it is
wired up, and you are graded on your own intent rather than the pixels. For anything non-trivial,
hand the screenshots and a written rubric to the `evaluator` role, or to a human.

**Attach the screenshots to the report.** "Verified at 375 and 1280 in both themes" with images is
evidence; the same sentence without them is a claim.

## Verify

- Every breakpoint × theme combination has an image you have actually looked at.
- You interacted with it: clicked the primary action, submitted the form empty, tabbed to the end.
- The second pass is clean, not just the first.
