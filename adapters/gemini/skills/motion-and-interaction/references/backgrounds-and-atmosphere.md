# Backgrounds and atmosphere

How a page gets depth and light behind the content. The reference implementation is the Pakistan
Pass page in `digitalpakistan/dpak` — `src/components/landing/pass-marketing.tsx` plus the
utilities at the end of `src/app/globals.css`.

**It uses no shader and no canvas.** Every bit of that atmosphere is CSS. Read the last section
before reaching for WebGL, because the honest answer is usually that you do not need it.

## Contents

- The four-layer stack
- Making sections stack seamlessly
- The signature ribbon
- Ghost numerals
- Opacity discipline
- What this costs
- When a canvas or shader is actually justified
- Verifying it

## The four-layer stack

Every atmospheric section is the same four layers, in order. The container is `relative
overflow-hidden`; every decorative layer is `absolute` and `pointer-events-none`.

```tsx
<section className="relative overflow-hidden bg-gradient-to-b from-dp-ink via-[#06301c] to-dp-ink">
  {/* 2 — texture */}
  <div className="dp-dotgrid pointer-events-none absolute inset-0 opacity-[0.14]" />
  {/* 3 — light */}
  <div className="pointer-events-none absolute -left-40 top-10  h-[520px] w-[520px] rounded-full bg-dp-green/40 blur-[150px]" />
  <div className="pointer-events-none absolute -right-28 top-40 h-[440px] w-[440px] rounded-full bg-dp-lime/25  blur-[150px]" />
  {/* 4 — content */}
  <div className="relative">…</div>
</section>
```

**1 · Ground** — a vertical gradient, not a flat fill. Three stops, dark → richer → dark.

**2 · Texture** — a dot grid at very low opacity. It is what stops a large dark area reading as an
empty div:

```css
.dp-dotgrid {
  background-image: radial-gradient(rgba(12, 42, 24, 0.07) 1.4px, transparent 1.4px);
  background-size: 26px 26px;
}
```

Fine and sparse — 1.4px dots on a 26px grid. Anything denser becomes a pattern the reader notices,
which is a different design decision.

**3 · Light** — two or three large, heavily blurred circles in brand hues. These do the real work:

- **400–620px across, blurred 140–170px.** The blur must be a large fraction of the radius or it
  reads as a coloured circle rather than as light.
- **Positioned off-canvas** (`-left-40`, `-right-28`, `-top-16`) so you see the falloff, not the
  shape. A glow fully inside the frame looks like a blob.
- **Low alpha** — `/10` to `/40`. These tint the ground; they are not elements.
- **Two, occasionally three.** More and the ground turns to mud.

**4 · Content** — needs `relative` or it renders behind the decoration.

## Making sections stack seamlessly

The ground gradient **starts and ends on the same colour**: `from-dp-ink via-dp-green-deep
to-dp-ink`. That is what lets several sections stack with no visible seam between them — each one
arrives and leaves at the shared base colour, so the joins disappear and the page reads as one
continuous surface that brightens and darkens.

A gradient running dark → light leaves a hard edge wherever the next section begins. This single
choice is most of why the page feels like one environment rather than a stack of panels.

## The signature ribbon

```css
.dp-truck-stripe {
  background-image: repeating-linear-gradient(45deg,
    #0a7c42 0 14px, #ffb400 14px 28px, #ff2e7e 28px 42px, #1fa9e6 42px 56px);
}
```

Pakistani truck art, as a 6px diagonal candy stripe. It appears on the top edge of the pass card
and as a section ribbon — never as a large field.

The lesson generalises: **one culturally or subject-specific motif, rendered small and used
sparingly, does more for identity than any amount of general polish.** Find the equivalent in the
subject's own world. A generic gradient bar in the same position says nothing.

## Ghost numerals

Behind each scene in the pinned sequence sits the step number at `text-[13rem]` and
`text-dp-cream/[0.04]` — enormous, and almost invisible.

It gives the composition a focal mass and encodes real information (which step you are on) without
competing with anything. At 4% it registers as texture; at 10% it becomes a design element fighting
the content. If you can read it comfortably, it is too strong.

## Opacity discipline

The same dot grid runs at `0.1`, `0.14` and `0.4` in different sections — tuned per ground, not
set once. Texture over a near-black ground needs more opacity than over a mid-green one to read at
all.

Tune these by looking at a screenshot, not by choosing a number. This is exactly the class of
decision that only resolves visually — see `verifying-ui-visually`.

## What this costs

**Large blurs are the expensive part of this whole approach.** A `blur-[170px]` element forces a
big offscreen buffer.

- Keep them **static**. A still 620px blur is paid once; the same element animating is paid every
  frame, and it is the most common cause of a page that scrolls at 30fps on a mid-range Android.
- Never put a large blur inside a pinned section that also transforms, or it recomposites while
  pinned.
- Do not stack more than two or three per viewport.
- `backdrop-blur` is costlier still and scales with the area behind it. Reserve it for small chips
  and bars, never a full-width panel.

Profile on a mid-range phone. This stack is nearly free on a laptop and is where cheap devices
fall over.

## When a canvas or shader is actually justified

dpak reaches for none, and that is the right call: **everything above is compositor work the
browser is already optimised for.** A shader replicating it would cost a WebGL context, a render
loop, and a fallback path, to produce the same image.

Escalate to `<canvas>` or WebGL only when the effect is genuinely **generative or reactive** —
something CSS cannot express:

- Particle fields, flow fields, physics
- Noise that evolves over time (fluid, plasma, dithered grain that actually moves)
- Anything that must respond per-pixel to input or audio
- Generative art where each visit differs

Prefer `<canvas>` 2D over WebGL until 2D is measurably too slow; the maintenance difference is
large and the visual difference is usually not.

If you do build one, these are not optional:

- **Scale for DPR.** Set `canvas.width = rect.width * devicePixelRatio` and scale the context, or
  it renders blurry on every retina screen.
- **Resize with a `ResizeObserver`**, not a `window` resize listener, and re-scale on change.
- **Pause when offscreen.** An `IntersectionObserver` that cancels the RAF loop — a background
  animating in a section nobody is looking at is pure battery cost.
- **Stop entirely for `prefers-reduced-motion`**, and render one static frame instead of nothing.
- **Ship a CSS fallback** for context-creation failure. `getContext` returns null under memory
  pressure and on some locked-down browsers; the page must still look finished.
- **Cap the frame rate** if the effect does not need 60 — many ambient backgrounds look identical
  at 30 and cost half as much.

Never put a canvas behind body text without checking contrast at its brightest frame. A background
that animates under type is a contrast failure that only exists for part of a second, which is
worse than a constant one because testing misses it.

## Verifying it

- Screenshot the section boundaries specifically. Seams between stacked gradients are invisible
  while writing the CSS and obvious in an image.
- Check the texture layer is actually visible — a dot grid at the wrong opacity for its ground
  renders as nothing, and the code looks correct.
- Confirm every decorative layer is `pointer-events-none`. A full-bleed glow over a button is a
  dead button, and it is silent.
- CPU throttle 4× and scroll the whole page. Blur cost shows up here and nowhere else.
- Contrast-check body text against the brightest part of the ground beneath it, not the average.
