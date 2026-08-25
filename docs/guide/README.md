# Developer guide

`atrix-harness-guide.html` is the source; `atrix-harness-guide.pdf` is generated from it.

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --no-pdf-header-footer \
  --print-to-pdf="$PWD/atrix-harness-guide.pdf" \
  "file://$PWD/atrix-harness-guide.html"
```

Edit the HTML, regenerate, and check the result before sharing it. Two things worth knowing:

- **Verify the extracted text, not the rendered image.** A low-resolution render makes `--live`
  look like an em-dash. `pdftotext` settles it — that is what a reader copying a command gets.
- **Check every command still exists.** A guide naming a command that has been renamed is worse
  than no guide, because someone will run it and conclude the tool is broken.
