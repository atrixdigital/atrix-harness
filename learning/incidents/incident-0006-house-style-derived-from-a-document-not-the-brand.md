---
id: incident-0006
title: house style derived from a document, not from the brand
date: 2026-08-25
status: merged
cost: 90m
---

## What happened

The `producing-a-document` and `creating-a-deck` skills shipped with a house style built on **IBM
Plex** and a cold blue accent (`#0655b7`). A developer guide was rendered on it, turned into a PDF,
and posted to `#core` as the org's onboarding document.

None of it was the Atrix brand. Atrix is **Montserrat + Poppins** with a warm gradient — yellow
`#facc14` → orange `#f97415` → pink `#ec4699` — as defined in
`projects/atrix.dev-v2/app/globals.css` and `tailwind.config.ts`.

The verdict, on seeing the PDF: *"so bad and worst. it does not follow the design theme of
Atrix.dev."*

## Why it happened

The style was reverse-engineered from an **Ezrov client audit PDF** that happened to be nearby and
happened to look competent. It was a real Atrix-produced document, so it read as evidence. It was
never a brand definition — it was one deliverable, for one client, whose look nobody had checked
against the site either.

Every check that existed passed. `pdffonts` confirmed the fonts embedded. The renders were clean,
the type scale was consistent, the tables did not break across pages. **The template was well-built
and entirely wrong**, and nothing in the pipeline compares a rendered artifact against the brand,
because "is this our brand" is not a property of the file.

This is the same shape as `incident-2026-08-25-rule-bundle-never-reached-claude-code`: a green
structural check standing in for a question it cannot answer.

## The fix

- `document.html`, `deck.html` and `docs/guide/` rebuilt on the real tokens
- `references/design-system.md` rewritten, opening with a **"Where the brand comes from"** section
  that names `atrix.dev-v2/app/globals.css` as the source of truth and says the site wins when
  anything older disagrees
- That section states this incident by name, so the next person reads the brand from the brand

Two things learned in the rebuild, now written into the design system:

- **Gradient-clipped text** (`background-clip: text`) prints a visible box around the glyphs in
  Chrome's PDF path. Fine on screen, broken in the artifact. Use solid `--brand-via` with a
  gradient underline instead.
- **Poppins at 400 reads heavy and grey in print.** Body copy sits at 300.

## The rule

When a skill encodes a house style — visual, tonal, structural — it names the **system of record**
for that style and links to it. A style inferred from an example is a guess about a company, and it
will be confidently wrong in a way that reviews cleanly.

Related: [[write-adr]] for the same reason at the architecture layer — decisions that cannot name
their source get re-derived, differently, by whoever is next.
