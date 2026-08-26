# Visual craft for carousels

Type on a flat fill is what a carousel looks like before anyone has designed it. This is the
technique that separates a slide that gets scrolled past from one that stops a thumb — all of it
CSS, none of it images to host.

## Contents

- The craft floor
- The ground: mesh, not fill
- Grain
- Type: where to get faces that are not Inter
- Cards as objects
- Emissive colour
- Numbers as graphics
- Accent discipline
- The strategy layer
- Verifying

## The craft floor

Before a carousel ships, it has all five:

1. **A ground with depth** — a mesh of colour nodes, never a single flat fill.
2. **Grain** — 25–40% opacity, so every surface feels physical.
3. **A display face with character** — not Inter, not the body face scaled up.
4. **At least one object with real depth** per content slide — a card, a panel, a figure.
5. **One or two accents** against a consistent base.

Miss all five and you have a text document at 1080×1350.

## The ground: mesh, not fill

A mesh gradient is several colour nodes on a plane, blending organically — layered radial
gradients get you there with no image and no canvas:

```css
background:
  radial-gradient(58% 44% at 14% 8%,   #16344A 0%, transparent 64%),
  radial-gradient(52% 40% at 92% 26%,  #0D4C3E 0%, transparent 62%),
  radial-gradient(80% 55% at 55% 108%, #0C1720 0%, transparent 72%),
  #070A0D;
```

- **Three or four nodes. Not eight.** More turns to mud, reliably.
- **Put the lightest node where the eye should land** — usually behind the headline — and let the
  darker tones fall to the edges, which frames the content without a border.
- Keep the nodes in a narrow hue range. Two hues plus the base reads considered; five reads like a
  gradient generator.
- Push a node partly off-canvas (`at 92% 26%`, `at 55% 108%`) so you see falloff rather than a
  visible circle.

## Grain

The single cheapest upgrade, and it does two jobs: it makes flat colour feel like a surface, and it
**kills the 8-bit banding** that a large dark gradient otherwise shows in an exported PNG.

```css
section::before {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  opacity: .34; mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.82' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E");
}
```

- **25–40% opacity with `overlay`.** Nobody consciously sees it; everything feels more physical.
  Above ~50% it becomes visible noise and looks like a compression artefact.
- `baseFrequency` around `.8` for fine grain; lower gives coarse, cloudy texture.
- `stitchTiles='stitch'` so the tile does not seam.
- On a light ground swap to `mix-blend-mode: multiply` at roughly half the opacity.

## Type: where to get faces that are not Inter

Google Fonts is why everything looks the same. **[Fontshare](https://api.fontshare.com)** (Indian
Type Foundry) is free for commercial use and carries genuinely premium faces:

| Face | Use |
|---|---|
| **Clash Display** | Wide geometric display. Strong, contemporary, unmistakable at size. |
| **Satoshi** | Clean geometric body. The Inter replacement. |
| **Switzer** | Neutral body with more warmth than Satoshi. |
| **General Sans** | Quieter body face; good under a loud display. |

```html
<!-- One <link> PER FAMILY. -->
<link href="https://api.fontshare.com/v2/css?f%5B%5D=clash-display@600,700" rel="stylesheet">
<link href="https://api.fontshare.com/v2/css?f%5B%5D=satoshi@400,500,700" rel="stylesheet">
```

**The multi-family URL silently returns only the first family.** Request two in one link and the
second falls back with no error and no console warning — the exact silent-substitution failure
`typography-and-fonts` warns about. Verify by rendering, never by reading the URL.

**Clash Display ships tight.** Negative tracking closes its *word* spaces before its letter
spaces, so a headline turns into `9of9checks` at exactly the size where legibility decides
everything. Use `letter-spacing: -.008em` with `word-spacing: .08em`, and look at the render.

For editorial or premium-feeling display, **Cormorant** (Google, free) is the other reliable pick.

## Cards as objects

A panel needs four things to read as a physical object rather than a coloured rectangle:

```css
.card {
  background: linear-gradient(180deg, rgba(255,255,255,.055), rgba(255,255,255,.02));
  border: 1px solid rgba(255,255,255,.10);
  border-radius: 18px;
  box-shadow: 0 40px 90px -30px rgba(0,0,0,.85),   /* it sits above the ground */
              inset 0 1px 0 rgba(255,255,255,.07); /* a lit top edge */
}
```

The **inset top highlight** is the detail most often missed and does the most work — it is what
makes the edge catch light.

## Emissive colour

When an accent is meant to read as *light* rather than paint, put a bloom behind it:

```css
.glow {
  position: absolute; width: 700px; height: 340px; border-radius: 50%;
  background: var(--accent); opacity: .13; filter: blur(150px);
  z-index: 0; pointer-events: none;
}
```

Keep it behind the content (`z-index: 0`, content at `1`) and keep it **static** — an animated
large blur is paid every frame, and these export as stills anyway.

## Numbers as graphics

A statistic is a picture. Set it at 300–500px and clip a gradient into it:

```css
.figure {
  font-size: 460px; line-height: .74; letter-spacing: -.06em;
  color: transparent;
  background: linear-gradient(160deg, #FF9F43, #E0653C 70%);
  -webkit-background-clip: text; background-clip: text;
}
```

This is safe here because a carousel exports to PNG. **The same trick prints a visible box around
the glyphs in a PDF** — so for the LinkedIn PDF export, check it, and fall back to a solid colour
with a gradient underline if it shows.

## Accent discipline

**One or two accents against a consistent base.** No rainbow gradients, no competing saturated
elements — that reads as a template, not a design.

Count the uses across the whole set. An accent that appears on every slide stops being an accent;
two or three appearances across seven slides is what makes those moments land.

## The strategy layer

Technique does not rescue a weak structure:

- **The 50/50 rule** — half the total effort goes into slide 1. It is the only slide most people
  see, and it decides whether the other six exist.
- **Three to ten slides.** Six to eight is the sweet spot.
- **Say "swipe".** Only about 5% of carousels include the prompt, and including it measurably
  lifts engagement. One small mark on slide 1 is enough.
- Formats that reliably work: a step-by-step, a data story, a personal narrative with clear
  milestones, a teardown of something that went wrong.

## Verifying

- **Shrink slide 1 to ~200px.** Still readable and still interesting, or rewrite it.
- Look for **banding** in the exported PNG, not in the browser — that is where it shows.
- Confirm the faces actually loaded: `pdffonts` on the PDF, and read the render. A fallback is
  silent.
- Count accent appearances across the set.
- Check nothing sits in the platform's bottom-edge UI zone.
