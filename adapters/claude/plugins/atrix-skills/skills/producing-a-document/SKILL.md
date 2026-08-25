---
name: producing-a-document
description: >
  Write and produce an Atrix document — audit, technical brief, system design,
  proposal, status report or spec — with the right structure for its type, the house
  visual style, and a PDF that actually renders. Use when asked to write, produce or
  export a report, audit, brief, proposal, overview, spec or any client-facing or
  internal document, or to turn findings and analysis into something someone will read.
group: documents
---

# Producing a document

Three separate jobs, in this order. Doing them out of order is why documents get rewritten:

1. **Decide what kind of document it is.** Each type has a shape readers expect.
2. **Write the content.** This is the work. Ninety percent of the value is here.
3. **Produce the artefact.** Mechanical, and the part with the traps.

> The generic PDF mechanics — merging, splitting, extraction, OCR, forms — are covered better
> by the official `pdf` skill. This one is about **what to write and how it should look**, which
> that skill explicitly does not cover.

## 1 · What kind of document is this

| Type | Answers | Reader wants |
|---|---|---|
| **Audit** | What is wrong, ranked | The worst thing, on page one |
| **Technical brief / overview** | What this system is | To hold the shape in their head |
| **System design** | How we propose to build it | The decisions and what they cost |
| **Proposal** | What we will do and for how much | Scope, price, what is excluded |
| **Status report** | Where the work is | Done, remaining, blocked — and honestly |
| **Spec** | What it must do | Something they can build or accept against |

Pick before writing. See [references/document-types.md](references/document-types.md) for the
required sections of each — an audit missing severity ranking, or a proposal missing exclusions,
is not a stylistic slip. It is the document failing to do its job.

## 2 · Writing the content

**Lead with the finding, not the method.** A reader who stops after the first paragraph should
have the answer. What you did belongs later, if at all.

**Write prose, not bullet fragments.** Atrix documents state the fact, its consequence, and why it
matters — in sentences:

> Identity documents are stored in public cloud storage and their URLs are persisted indefinitely
> in the primary database. CNICs, passports and liveness selfies are retrievable by anyone holding
> the link. This contradicts the security rule the project set for itself.

Fact, then consequence, then why it matters. A bullet reading *"Public S3 URLs — security risk"*
contains the same information and moves nobody.

**Rank by what hurts first.** In an audit, a report, a review — ordering is an argument. Twenty
findings in file order is a list; twenty findings ordered by production impact is a document.

**Name the specific thing.** `apps/api/src/booking/slots.ts:120`, not "the booking logic".
`3 of 26 venues`, not "several venues".

**Say what you did not check.** Every document has a boundary. Stating it protects the reader
from assuming coverage you never had, and is the difference between a report and a claim.

## 3 · Producing it

**Start from [assets/document.html](assets/document.html)** — do not write CSS from scratch. The
template is the house style already correct: the type scale, the cover, section rules, the
findings pattern, tables and callouts. Copy it, replace the content, leave the system alone.

```bash
cp <skill>/assets/document.html ./doc.html
# …write the content…
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --no-pdf-header-footer --virtual-time-budget=10000 \
  --print-to-pdf="$PWD/out.pdf" "file://$PWD/doc.html"
```

**`--virtual-time-budget` is not optional.** Without it Chrome prints before the webfonts arrive
and silently substitutes Helvetica and Charter — a document that looks wrong, with no error.
Confirm with `pdffonts out.pdf`; it should name Montserrat and Poppins.

Why the design is what it is, and when to change it, is in
[references/design-system.md](references/design-system.md). A document that looks like the others
is trusted more than a better-designed one that looks foreign.

The render pipeline, the alternatives that do not work here, and the traps that have cost real
time are in [references/mechanics.md](references/mechanics.md). Read it before debugging a render.

## 4 · Before you hand it over

- **Read the extracted text, not the render.** `pdftotext` shows what a reader copying a command
  actually gets. A low-resolution preview makes `--live` look like an em-dash; the text settles it.
- **Check every command and path you named still exists.** A document naming a renamed command is
  worse than one that omits it, because someone will run it and conclude the tool is broken.
- **Look at the pages.** Render two or three to PNG. Page breaks in the wrong place, an orphaned
  heading or a table split across pages are all invisible in the source.
- **Count what you claimed.** "Twenty findings" must be twenty.

## If it is for a client

Someone else's name goes on the cover. Confirm the audience, the scope line and any figure before
sending — and never send anything outward-facing without an explicit yes.
