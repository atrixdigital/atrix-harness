---
name: creating-a-carousel
description: >
  Build a social carousel for LinkedIn, Instagram or X — the slide arc that earns a swipe,
  portrait sizing and platform safe areas, and an export that produces the right file type
  per platform. Use when asked for a carousel, a slide post, a LinkedIn document post, an
  Instagram or X image set, or to turn a post, article, case study or finding into slides
  for social.
group: communication
---

# Creating a carousel

A carousel is **not a deck at a different aspect ratio.** It is read on a phone, silently, by
someone scrolling past, with no presenter and no follow-up conversation. Every rule below follows
from that.

| | Deck | Carousel |
|---|---|---|
| Read by | a room, with you talking | one thumb, in silence |
| Slide 1 | sets up | **stops the scroll, or nothing else happens** |
| Pace | your voice | a swipe every 1–2 seconds |
| Ending | questions | an explicit ask, because there is no conversation after |

## Slide 1 is most of the outcome

Everything past it is only seen by people the first frame convinced. Write it last, when you know
what the payload actually is, and make it carry a **complete, specific claim** — not a label.

```
✗ "Our thoughts on caching"          a title, no reason to swipe
✗ "5 caching tips"                   a format, not a claim
✓ "We cut p95 from 3.4s to 0.95s
   by moving one config line."       a result, and an obvious question
```

The frame must be legible at **thumbnail size**, because that is where the decision to stop is
made. If you cannot read it shrunk to a fingernail, it does not work.

## The arc

Eight to ten slides. Fewer than six is a post; more than twelve is not finished.

1. **Hook** — the claim.
2. **Tension** — why it is not obvious, or what the reader currently believes.
3. **Payload** — three to six slides, one idea each. This is the value; do not hurry it.
4. **Proof** — the number, the before/after, the screenshot. One slide.
5. **Ask** — one action. Follow, read the full thing, reply, book.

**One idea per slide.** If a slide needs a comma-spliced second sentence to make sense, it is two
slides. The swipe is free; crowding is not.

## Sizing and safe areas

| Platform | Canvas | Export | Notes |
|---|---|---|---|
| LinkedIn | 1080 × 1350 (4:5) | **one PDF** | Uploaded as a *document* post, not images |
| Instagram | 1080 × 1350 (4:5) | **numbered PNGs** | `01.png … 10.png`, order is filename order |
| X | 1080 × 1080 (1:1) | up to **4 images** | A four-panel format — rewrite the arc, do not truncate it |

**4:5 portrait, not square**, wherever the platform allows it: it occupies the most vertical space
in a feed, which is the only scarce resource here.

**Keep content inside a ~10% margin on every edge, and further from the bottom.** Platform UI —
captions, page dots, profile rows, the "see more" fold — overlays the frame, and it moves between
app versions. Anything closer to the edge than that will eventually be covered.

Platform limits and layouts change. **Check the current spec before a real post** rather than
trusting this table.

## Type at phone size

Larger than feels right on a laptop. A rough floor on a 1080-wide canvas:

- **Hook: 90–140px.** Two to seven words.
- **Body: 44–60px.** If it fits at 32px it belongs in the caption, not on the slide.
- **Labels and numbers: 28–34px**, letterspaced.

Line length of 4–7 words. Left-aligned by default — centred text gives the eye a new starting point
on every line, which costs you at swipe speed.

## Direction, and the thread that holds a feed together

Each campaign gets **its own direction**, chosen for its subject — run
`choosing-a-design-direction` and pin it. Carousels are marketing surfaces, and a feed of identical
templates reads as a content mill.

But a feed of eight unrelated looks reads as eight companies. So one thing stays constant across
every Atrix carousel regardless of direction:

- **The wordmark**, same position, same size, on every slide.
- **The endcard** — same layout, same ask structure, whatever the palette.

That is the whole brand contract. Everything else — palette, type, texture, illustration — belongs
to the campaign. See `house-style`: documents and decks are brand-locked; this is not.

## Signal that there is more

A carousel with no swipe affordance loses readers who did not notice it was one. A page counter
(`03 / 09`), a partial element bleeding off the right edge, or an arrow — one of them, consistently
placed. The counter is also honest: it tells someone how much they are committing to.

## Writing

The caption is not a duplicate of slide 1 — it is the context the slides cannot hold, and the place
the link goes. Write it as part of the same job.

**Alt text per image**, because a carousel is entirely inaccessible without it and platforms do not
generate anything useful. One sentence per slide, describing the content rather than the design.

No text on a slide that you would not say out loud. Read the whole thing aloud once; the slide you
stumble on is overwritten.

## Building and exporting

Start from `assets/carousel.html` — one `<section>` per slide, sized by CSS variables so the same
file targets 4:5 or 1:1.

```bash
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# LinkedIn — a single PDF, page size matched to the canvas.
"$CH" --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=15000 \
      --print-to-pdf="carousel.pdf" "file://$PWD/carousel.html"

# Instagram — numbered PNGs, one per slide.
bun run assets/export-slides.ts carousel.html out/
```

`--virtual-time-budget` is not optional: without it Chrome prints before the webfonts arrive and
substitutes silently. Check with `pdffonts`.

## Verify

- **Look at every slide as an image**, not as HTML — see `verifying-ui-visually`.
- **Shrink slide 1 to thumbnail size.** Still readable and still interesting, or rewrite it.
- Put the PNGs on an actual phone, or a 390px-wide viewport, and swipe through at real speed.
- Overlay the platform safe areas and confirm nothing important sits under them.
- Count the slides against the arc: is there a hook, a proof, and exactly one ask?
- Alt text written for every slide.
