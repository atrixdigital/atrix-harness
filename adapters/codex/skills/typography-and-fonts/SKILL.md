---
name: typography-and-fonts
description: >
  Load and use typefaces on the web without layout shift, licence breaches or a slow first
  paint — next/font, variable fonts, self-hosting, fallback metrics, and a type scale that
  holds together. Use when setting up fonts in a project, adding or changing a typeface,
  picking sizes and weights, fixing layout shift or slow text rendering, or when text
  "looks wrong" and the cause is the font stack.
group: stack
---

# Typography and fonts

## Load through `next/font`, always

It self-hosts the files at build time, emits a stable `className`, and — the part that matters —
generates a **fallback face with matched metrics**, so text does not jump when the real font
arrives.

```ts
// src/lib/fonts.ts
import localFont from 'next/font/local';

export const display = localFont({
  src: './fonts/Montserrat-Variable.woff2',
  variable: '--font-display',
  display: 'swap',
  weight: '400 800',        // one variable file covers the range
});
```

```css
@theme inline { --font-display: var(--font-display); }
```

Then `font-display` is a Tailwind utility and the family is a token like any other — see
`tailwind-theming`.

**Never `<link>` a font stylesheet or `@import` from a CDN.** It costs a DNS lookup, a connection
and a round trip before any text can paint, on the critical path, and it leaks every visitor's IP
to a third party — which is a GDPR finding, not a theoretical one.

## Variable fonts, and only the weights you use

One variable file usually beats four static ones: smaller total, and every weight available. But
**declare the range you actually use** — shipping `100 900` when the design uses two weights is
paying for axes nobody renders.

Subset to the scripts you support (`subsets: ['latin']`). If the product has Arabic, that is a
second family with its own file, not an afterthought — and it needs testing at the same sizes,
because Arabic runs taller and the same `text-sm` reads differently.

## Layout shift

`display: 'swap'` shows fallback text immediately and swaps when the real font loads. That is the
right default — invisible text is worse than a swap — but the swap **is** the layout shift unless
the fallback metrics match. `next/font` handles this automatically for its own families; if you
hand-roll a stack, set `adjustFontFallback` or accept the CLS.

Measure it: Lighthouse CLS should be under 0.1. A font swap is one of the two most common causes of
failing that, the other being images without dimensions.

## Licensing — check before you ship

This is the part that gets skipped and is the only part with legal exposure.

- **Google Fonts / SIL OFL** — free, self-hosting permitted, commercial use fine. Montserrat,
  Poppins, JetBrains Mono, Inter all qualify.
- **Commercial foundries** (Klim, Commercial Type, Monotype, Colophon) — a desktop licence does
  **not** cover web use. Webfont licences are commonly metered by monthly pageviews, and a site
  that grows past its tier is in breach without any warning.
- **Never** copy a `.woff2` out of another site's assets, and never commit a font you cannot name
  the licence for.

Record the licence and its limits in the repo next to the font files. The person who needs it is
the one who did not buy it.

## The type scale

Pick a ratio and stay on it — 1.25 for dense product UI, 1.333 for marketing pages. Sizes off the
scale are what makes a page feel assembled rather than designed.

- **Body 16px minimum** on the web. Smaller is a decision to exclude readers, and mobile Safari
  zooms form inputs under 16px, which breaks the layout.
- **Measure: 60–75 characters.** `max-w-prose` gets it right; full-width body text does not.
- **Line height inverse to size** — 1.5–1.6 for body, 1.1–1.2 for display. Large text at 1.5 looks
  unglued.
- **Tighten tracking as size grows.** Display type set at default tracking reads loose; `-0.02em`
  to `-0.03em` above ~28px.

Weight carries hierarchy more cheaply than size. Two sizes and two weights outperform five sizes.

## The Atrix faces

Montserrat for headings, Poppins for body, JetBrains Mono for code — the same stack as our
documents, so a page and a PDF read as one company. The `house-style` rule carries the full token
set. Poppins at 400 reads heavy in print but is correct on screen; that difference is deliberate.

## Verify

- Open DevTools → Network, filter by font: the files come from **your** origin, and no more than
  two or three load on first paint.
- Throttle to Slow 3G and reload. Text should appear immediately in the fallback and swap without
  the layout jumping.
- Check the rendered page uses the intended family — a typo in `variable` fails silently to the
  system font, which looks deliberate enough that nobody reports it.
