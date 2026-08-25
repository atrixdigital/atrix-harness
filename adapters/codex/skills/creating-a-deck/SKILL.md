---
name: creating-a-deck
description: >
  Build a presentation deck — investor pitch, client proposal, internal review — with the
  slide arc the audience expects, one idea per slide, the Atrix house style, and an
  HTML-to-PDF pipeline that produces something presentable. Use when asked to create,
  write, build or export a deck, pitch, slide deck, slides or a presentation, including
  "turn this into slides" or "make a deck out of it". Use this rather than hand-writing
  slide HTML — the template in assets/ is already on brand.
group: documents
---

# Creating a deck

A deck is not a document with bigger type. A document is read; a deck is **spoken over**. Every
slide that works as prose has already failed.

## The arc

Investor and pitch decks follow an order the audience is trained on. Deviating costs you
attention you need for the content:

| # | Slide | Must land |
|---|---|---|
| 1 | Title | Who you are, in one line someone could repeat |
| 2 | The problem | Whose problem, and evidence it is real |
| 3 | The solution | What you built, plainly, no mechanism yet |
| 4 | How it works | The mechanism, once they want it |
| 5 | Market | Size, and why now |
| 6 | Traction | Numbers. This is the slide they actually read |
| 7 | Business model | How money arrives |
| 8 | Competition | Who else, and why you win |
| 9 | Roadmap | What the money buys |
| 10 | The ask | The number, and what it is for |

For an **internal review** the arc compresses: where we are → what changed → what is blocked →
what needs deciding. For a **client proposal**, follow the proposal structure in
`producing-a-document` rather than this one.

Order is not arbitrary. Traction before business model, because credibility earns the right to
talk about money. Problem before solution, because a solution to a problem nobody accepts is
noise.

## One idea per slide

If a slide needs two sentences to state its point, it is two slides.

- **A headline that is a claim**, not a label. "Bookings grew 4× in nine weeks" beats "Traction".
  The claim is the slide; everything else is evidence for it.
- **Three bullets maximum**, six words each — and prefer none. A number, a chart or one sentence
  beats three fragments.
- **No paragraphs.** If the words matter that much, they belong in a document you send afterwards.
- **A slide should be readable in four seconds.** Longer and the room is reading instead of
  listening to you.

## Numbers

Traction is the slide people lean forward for, and the one where credibility is won or lost.

- **Give the absolute and the rate.** "4× growth" from two customers to eight is not the same
  claim as two hundred to eight hundred, and an audience that discovers which one you meant
  afterwards stops believing the rest.
- **Say the window.** Growth without a period is not a number.
- **Never a chart without a y-axis.** It reads as hiding something, because usually it is.
- **Cite anything external**, on the slide, in small type.

## Producing it

**Start from [assets/deck.html](assets/deck.html)** — a working 16:9 template with the title,
problem, solution, traction, competition and ask slides already laid out in the house style.
Replace the content.

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --no-pdf-header-footer --virtual-time-budget=10000 \
  --print-to-pdf="$PWD/deck.pdf" "file://$PWD/deck.html"
```

`--virtual-time-budget` is not optional — without it the webfonts do not arrive and Chrome
substitutes silently. Check `pdffonts deck.pdf` names Montserrat and Poppins.

Landscape 16:9 at that size gives a PDF that projects cleanly and reads on a laptop. The
`producing-a-document` skill carries the render command and the traps — load it rather than
rediscovering them.

Type is much larger than a document: headline around 60px, body 28–32px, nothing below 20px.
**If it fits at 18px it does not belong on the slide.**

Keep the house style — Montserrat and Poppins, the same warm palette, the brand run across the
top of every slide — so a deck and a brief look like they came
from the same firm.

## Before you present it

- **Render every slide to PNG and look at them.** Overflow, a clipped chart and an orphaned
  heading are invisible in source and obvious at a glance.
- **Read it with the slides only.** If it makes no sense without you talking, that is correct.
  If it makes no sense *with* you talking, fix it.
- **Check every number against its source** and know where each came from. You will be asked.

## If it goes to a client or an investor

Outward-facing and hard to reverse. Confirm the figures, the ask and the audience with a human
before it is sent — see the `safety` rule. A wrong number in a deck outlives the meeting.
