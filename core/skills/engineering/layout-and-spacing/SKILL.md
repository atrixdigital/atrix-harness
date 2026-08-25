---
name: layout-and-spacing
description: >
  Compose a page so it reads as designed rather than assembled — spacing scale, proximity
  and grouping, grid and measure, optical alignment, and visual hierarchy. Use when
  building a page or layout, when something "looks off" but the colours and type are right,
  when deciding padding, gaps or widths, or when a design feels cluttered, empty or flat.
group: engineering
---

# Layout and spacing

Most interfaces that look wrong have correct colours and correct type. What is wrong is the
**space between things** — and space is the cheapest, least-used design tool available.

## Space is a scale, not a number

Pick a scale and never leave it. Tailwind's default is already one: `4 8 12 16 24 32 48 64 96`.
An arbitrary `padding: 13px` is what makes a page feel assembled — not because 13 is wrong, but
because nothing else on the page is 13.

**Prefer fewer, larger steps.** Adjacent values (16 vs 20) read as a mistake; distinct ones
(16 vs 32) read as a decision.

## Proximity is grouping — the highest-leverage rule here

Things closer together are read as belonging together. This beats borders, backgrounds and
dividers, and it is the rule most often broken.

```
✗ heading      ✓ heading
   ↕ 24px          ↕ 8px      ← bound to its content
   content         content
   ↕ 24px          ↕ 48px     ← separated from what follows
   next section    next section
```

**The gap inside a group must be smaller than the gap around it.** When they are equal — the
default when everything is `space-y-4` — the page becomes a flat list and the reader has to work
out the structure themselves.

Before reaching for a card, a border or a background tint, try spacing. Most boxes on most pages
exist to do a job that space already did.

## Hierarchy

Every screen has one most-important thing. Decide what it is before you style anything.

Rank with **size, weight, colour and space — in that order of cost.** Space and weight are nearly
free and rarely misfire; colour is loud and gets overused. Two type sizes and two weights, used
consistently, out-perform five sizes.

Test it by squinting at a screenshot, or blurring it. Whatever remains prominent is your actual
hierarchy, regardless of intent. If everything survives equally, nothing is emphasised — and a page
where everything is emphasised reads as a page where nothing is.

## Measure and width

- **Body text: 60–75 characters.** `max-w-prose`. Full-width paragraphs are the single most common
  readability failure on marketing pages.
- **Constrain the container, not the elements.** One `max-w-*` with `mx-auto` on the wrapper beats
  widths set on each child.
- A page that is one centred column at every width is a page that ignores the space it has. Wide
  viewports can carry a second column, a sidebar, or a genuinely wider measure for non-prose.

## Alignment

**Left-align by default.** Centred text is for short display lines only — a centred paragraph gives
the eye a different starting point on every line.

Align to a small number of vertical edges. If a screenshot shows four distinct left edges in one
column, three of them are accidents.

**Optical over mathematical.** Circles, triangles and glyphs need to overshoot their box to look
centred; an icon mathematically centred beside text usually sits a pixel high. Trust the screenshot
over the computed value.

## Grid

Use a real grid for anything with repeating items. `grid` with `auto-fit`/`minmax` handles the
responsive case without breakpoint-by-breakpoint rules:

```
grid-cols-[repeat(auto-fit,minmax(18rem,1fr))]
```

Check the awkward counts — **one item, two items, and one-more-than-a-full-row**. A three-column
grid holding four items is where layouts break, and it is never the case anyone designs for.

## Density

Match density to the job. A data table wants tight rows; a marketing page wants air. The failure is
mixing them — a dense table inside a generous page reads as broken rather than as contrast.

Generous outer padding is most of what reads as premium. If a design feels cheap and you cannot say
why, the answer is usually that the content is touching the edges.

## Vertical rhythm

Space in multiples of the body line-height so blocks land on a common baseline instead of drifting.
Section spacing should be the largest value on the page and consistent across sections — irregular
section gaps are what make a long page feel like separate pages stapled together.

## Verify

Screenshot it and check, in this order — see `verifying-ui-visually`:

- Squint: is the hierarchy what you intended?
- Are group-internal gaps visibly smaller than group-external ones?
- How many distinct left edges are in each column? Fewer is the answer.
- At 375px, does anything touch the edge or scroll sideways?
- With one item and with seven, does the grid still look deliberate?
