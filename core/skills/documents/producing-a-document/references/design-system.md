# House visual style

## Contents

- Why match rather than improve
- Where the brand comes from
- Typography
- The cover
- Page and spacing
- Tables, code and callouts
- Colour
- What to avoid

## Why match rather than improve

A document that looks like the other Atrix documents is trusted more than a better-designed one
that looks foreign. Consistency is the point. Improve the house style deliberately and for all of
it, or match what exists.

## Where the brand comes from

**atrix.dev is the source of truth**, not any document you happen to find. The tokens below are
lifted from `projects/atrix.dev-v2/app/globals.css` and `tailwind.config.ts`. When they disagree
with something older, the site wins — and this file gets updated, rather than quietly diverging.

This section exists because it was got wrong once: an earlier version of this house style was
derived from a client audit PDF rather than from the site, and shipped a cold blue serif document
under the Atrix name. Read the brand from the brand.

## Typography

| Role | Face | Weight |
|---|---|---|
| Headings, titles, numbers | **Montserrat** | 600–800 |
| Body prose, labels | **Poppins** | 300 for print, 400 on screen |
| Code, paths, commands | **JetBrains Mono** | 500 |

Poppins is a geometric sans with a large x-height; at 400 in print it reads heavy and grey.
**Use 300 for body copy in documents** and reserve 400+ for emphasis. Montserrat wants negative
tracking once it is above about 28px — `-.03em` at display sizes, `-.02em` at heading sizes.

Body text at 10–11pt with line-height around 1.55. Anything tighter is unreadable at print size;
anything looser wastes pages.

Always give a real fallback stack — `"Poppins", -apple-system, "Helvetica Neue", Arial, sans-serif`
— because a renderer without the font silently substitutes something worse. And always pass
`--virtual-time-budget` when rendering: without it Chrome prints before the webfonts arrive and
substitutes with no error at all. Check the result with `pdffonts`.

## The cover

The established pattern, in order:

```
────────────────────────────────   the brand run: a 3px gradient rule, full measure
ATRIX · ENGINEERING AUDIT          eyebrow: uppercase, letterspaced ~0.18em, small, amber
Ezrov Platform Audit               title: large, tight leading, near-black
A full review of the codebase —    lead: one or two sentences saying what it covers
architecture, domain modelling…
─────────────────────────────
PREPARED FOR   PREPARED BY   DATE   REPOSITORY      metadata grid, small, labelled
SCOPE          METHOD
```

The metadata grid is not decoration. **Prepared for, date and the exact commit or version** are
what make the document citable six months later.

## Page and spacing

- US Letter for client documents; A4 for internal is acceptable
- Margins around 18–20mm
- Page numbers `n / total` centred at the foot, suppressed on the cover
- One major section per page break for a guide; continuous flow for a report

## Tables, code and callouts

**Tables** — left-aligned, a tinted header row, hairline rules between rows, no vertical rules,
and `page-break-inside: avoid`. A table split across a page break is the most common defect in
these documents.

**Code blocks** — dark background, generous padding, `white-space: pre-wrap` so long commands wrap
rather than clip. **Turn ligatures off** (`font-variant-ligatures: none`): some faces render `--`
as an em-dash, and a reader copying `--live` gets a command that does not work.

**Callouts** — a left border and a tinted background. Two kinds is enough: neutral for context,
amber for a warning. More kinds means none of them register.

## Colour

The Atrix mark is a **warm run: yellow → orange → pink.**

| Token | Value | Where |
|---|---|---|
| `--brand-from` | `#facc14` | gradient start |
| `--brand-via` | `#f97415` | gradient middle; also the solid brand orange |
| `--brand-to` | `#ec4699` | gradient end |
| `--accent` | `#af6612` | eyebrows, counters, anything small — see below |
| `--ink` | `#09090b` | body text |
| `--muted` / `--faint` | `#52525b` / `#a1a1aa` | secondary, tertiary |
| `--rule` / `--wash` | `#e4e4e7` / `#fafafa` | hairlines, tinted panels |

**The gradient is a shape, not a text colour.** It belongs to rules, bars and underlines — the
3px run under the cover eyebrow, the bar across the top of a slide. None of the three brand hues
passes contrast as small type on white, so anything at label size uses `--accent`, a deep amber
that reads as the same family and is actually legible.

Gradient-clipped text (`background-clip: text`) works on screen and **prints a visible box around
the glyphs** in Chrome's PDF path. If a headline word needs the brand, colour it `--brand-via` and
put the gradient in an underline beneath it.

Never colour as the only signal — a printed page gets photocopied.

## What to avoid

- A logo on every page. Once, on the cover.
- Decorative rules and boxes with no meaning.
- Full-width body text. Around 90 characters per line, maximum.
- Fitting more on the page by shrinking type. Use another page.
- A directory listing where a description belongs.
