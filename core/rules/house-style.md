---
name: house-style
description: Documents and decks use the Atrix house style; screens get their own considered design direction. Never infer a style from a nearby file.
source: incident-0006
applies: [**]
---

## Two media, two rules

**Documents carry the brand. Screens carry a design direction.**

| Making | Rule | Skill |
|---|---|---|
| PDF, report, audit, brief, proposal, guide | **House style, exactly** | `producing-a-document` |
| Deck, pitch, slides | **House style, exactly** | `creating-a-deck` |
| Any UI — app, site, page, component | **A direction chosen for this brief** | `frontend-design`, then `layout-and-spacing`, `motion-and-interaction`, `verifying-ui-visually` |

A document that looks like the other Atrix documents is trusted more than a better-designed one
that looks foreign — consistency is the whole point, and the templates in `assets/` are already
correct. **Start from them.** Writing fresh CSS for a document is how the house style drifts, one
plausible variation at a time.

Screens are the opposite. An interface that could have been generated for any product is the
failure mode, and the cause is well understood: absent a direction, a model reaches for the
statistical centre of its training data — the centred hero, the three rounded cards, the purple
gradient, Inter. **Commit to a direction before writing code**, derive every colour and type
decision from it, and let one signature element carry the boldness while everything around it stays
quiet.

The escape is process, not a better adjective. `frontend-design` carries that process; use it.

## The brand, if you need it directly

For documents and decks. A product's own UI may have its own palette — but Atrix's own surfaces
(atrix.dev, anything carrying our name) use these. Source of truth is
`projects/atrix.dev-v2/app/globals.css` — not any document you happen to find.

- **Montserrat** 600–800 for headings, tracked `-.03em` at display size
- **Poppins** 300 for body in print (400 reads heavy and grey), **JetBrains Mono** for code
- The run: `#facc14` → `#f97415` → `#ec4699`, used for **rules and bars, never for small type**
- `#af6612` for anything at label size — no brand hue passes contrast on white
- Ink `#09090b`, muted `#52525b`, faint `#a1a1aa`, rule `#e4e4e7`, wash `#fafafa`

## Rendering

`--virtual-time-budget` is not optional. Without it Chrome prints before the webfonts arrive and
substitutes silently — a wrong-looking document with no error anywhere.

```
chrome --headless --disable-gpu --no-pdf-header-footer \
       --virtual-time-budget=15000 --print-to-pdf=out.pdf file://$PWD/doc.html
```

Then **verify the artifact, not the source**: `pdffonts out.pdf` must name Montserrat and Poppins,
and you must render pages to PNG and look at them. Overflow, clipping and colour that survives on
screen but breaks in print are invisible in the HTML and obvious at a glance.

## Why this is a rule and not a preference

A house style was once inferred from a client PDF that happened to be nearby. It produced a
well-built document in the wrong typeface and the wrong colour, shipped under the Atrix name, and
every structural check passed — fonts embedded, no overflow, clean tables. Nothing in a build can
answer "is this ours", and nothing in a build can answer "does this look designed". Both questions
need a rendered artifact and someone looking at it. See `incident-0006`.
