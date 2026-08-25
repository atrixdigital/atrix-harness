# Producing the file

## Contents

- The pipeline
- Why not the alternatives
- Verifying before sending
- Traps that have cost real time

## The pipeline

Write HTML with print CSS; render with headless Chrome.

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --no-pdf-header-footer --virtual-time-budget=10000 \
  --print-to-pdf="$PWD/document.pdf" \
  "file://$PWD/document.html"
```

**`--virtual-time-budget` is load-bearing.** The house faces come from Google Fonts, and without
it Chrome prints before they arrive and silently falls back to Helvetica and Charter. There is no
warning — the document simply is not the one you designed. This was caught by running `pdffonts`
on a render that looked fine.

HTML because the design system is CSS, everyone can edit it, and it diffs. Keep the HTML beside
the PDF and commit both, so the next person regenerates rather than starts over.

Page furniture goes in `@page`:

```css
@page { size: Letter; margin: 20mm 18mm 18mm;
  @bottom-center { content: counter(page) " / " counter(pages); font-size: 8pt; color: #94a3b8; } }
@page :first { @bottom-center { content: ""; } }
```

## Why not the alternatives

| Tool | Verdict |
|---|---|
| **Headless Chrome** | Works. Full CSS support including `@page`. Use this. |
| **WeasyPrint** | Installed here but **fails on missing native libraries**. Do not reach for it. |
| **Pandoc → LaTeX** | Excellent typography, but the design system would have to be rebuilt in LaTeX. |
| **ReportLab** | Right for programmatic documents — invoices, generated reports — wrong for a written one. |

For a document a person writes, Chrome. For one a service generates per record, ReportLab.

## Verifying before sending

```bash
pdftotext doc.pdf -                       # what a reader copying actually gets
pdfinfo doc.pdf | grep -E "Pages|Page size"
pdftoppm -png -r 70 -f 1 -l 3 doc.pdf preview   # look at the pages
pdffonts doc.pdf                          # fonts embedded, not substituted
```

**Look at the rendered pages.** Page breaks in the wrong place, an orphaned heading and a table
split across pages are all invisible in the source and obvious in a preview.

## Traps that have cost real time

**Ligatures make commands wrong.** Some faces render `--` as an em-dash, so `--live` becomes
`—live`. Set `font-variant-ligatures: none` on code. Then check with `pdftotext` rather than by
eye — a 70dpi preview makes two hyphens look joined even when the text is correct, which sends
you fixing a bug that is not there.

**Verify the text, not the picture.** The definitive question is what the PDF *contains*, and
`pdftotext` answers it. Rendering answers a different question.

**Check the claims.** A guide naming a renamed command is worse than one that omits it — somebody
runs it and concludes the tool is broken. Extract every command and path you named and confirm
each still exists. Count anything you counted.

**Fonts must be embedded, and must be the right ones.** `pdffonts` should show `emb yes` *and*
name Montserrat, Poppins and JetBrainsMono. Seeing HelveticaNeue or Charter means the
webfonts never loaded — add
`--virtual-time-budget`. A document that renders on your
machine and substitutes Times on the client's is not the document you reviewed.
