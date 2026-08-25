# House visual style

## Contents

- Why match rather than improve
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

## Typography

**IBM Plex** is the Atrix typeface, as used in the existing audits and briefs.

| Role | Face |
|---|---|
| Headings, UI, labels | IBM Plex Sans — SemiBold or Bold |
| Body prose | IBM Plex Serif Regular, or IBM Plex Sans for shorter documents |
| Code, paths, commands | IBM Plex Mono, or a system monospace |

Body text at 10–11pt with line-height around 1.55. Anything tighter is unreadable at print size;
anything looser wastes pages.

Always give a real fallback stack — `"IBM Plex Sans", -apple-system, "Helvetica Neue", Arial,
sans-serif` — because a renderer without the font silently substitutes something worse.

## The cover

The established pattern, in order:

```
ATRIX · ENGINEERING AUDIT          eyebrow: uppercase, letterspaced ~0.18em, small, grey
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

Near-black for text, greys for secondary, one accent used sparingly. Amber for warnings only.
Never colour as the only signal — a printed page is monochrome.

## What to avoid

- A logo on every page. Once, on the cover.
- Decorative rules and boxes with no meaning.
- Full-width body text. Around 90 characters per line, maximum.
- Fitting more on the page by shrinking type. Use another page.
- A directory listing where a description belongs.
