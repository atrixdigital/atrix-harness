# Design styles, and what each one costs

A working catalogue of current surface treatments. Each entry says what it is, how to build it,
when it is the right call, and what it costs — because several of these carry real accessibility
debt and two of them are current AI-generated-design tells.

**Pick one and commit.** A page wearing three of these is the failure mode. The style follows from
the subject and the audience, never from what is trending — see `frontend-design` for choosing a
direction.

## Contents

- Glassmorphism
- Liquid Glass
- Neumorphism
- Material 3 / Expressive
- Neo-brutalism
- Bento grid
- Claymorphism
- Aurora and mesh gradients
- Kinetic and expressive typography
- Grain and noise
- Choosing, and the AI tells

## Glassmorphism

Translucent panel, blurred backdrop, hairline light border, soft shadow.

```css
.glass {
  background: color-mix(in oklab, var(--surface) 55%, transparent);
  backdrop-filter: blur(16px) saturate(140%);
  -webkit-backdrop-filter: blur(16px) saturate(140%);
  border: 1px solid color-mix(in oklab, white 18%, transparent);
}
@supports not (backdrop-filter: blur(1px)) {
  .glass { background: var(--surface); }   /* opaque fallback, not a see-through mess */
}
```

**Use it for chrome that floats over content** — a sticky nav, a command palette, a media overlay.
The translucency communicates layering, which is the only thing it is actually for.

**The cost is the busy-background problem.** A glass panel inherits whatever is behind it, so it
can pass contrast on one screen and fail on the next — the same component, the same CSS, a
different scroll position. If body text sits on glass, raise the opacity until it passes at the
*worst* background, or stop using glass there.

`backdrop-filter` is also expensive and scales with the painted area. Small surfaces only; never a
full-page panel.

**Glass on everything is a documented AI tell.** One or two surfaces, deliberately.

## Liquid Glass

Apple's WWDC 2025 evolution: instead of a static blur, the material responds — refraction, specular
highlights, and lensing that shifts with content and motion underneath it.

Native on Apple platforms. On the web you are approximating: layered translucency, a moving
specular gradient, and a subtle edge highlight. Worth it for **chrome and one hero moment**, not
for a whole interface — the approximation costs a lot of paint for an effect most viewers will not
consciously register.

All the glassmorphism caveats apply, plus more GPU.

## Neumorphism

Controls the same colour as their ground, shaped by a light and a dark shadow.

**Declining, and for a real reason: it removes contrast on purpose.** WCAG 2.2 requires **3:1 for
non-text UI components**, and neumorphic controls routinely fail it — so buttons are effectively
invisible to low-vision users and to anyone in sunlight.

Use it as a **texture inside a larger system** — an inset panel, a track behind a slider — never
for a primary control, a form input, or anything a user has to find. If a control's only affordance
is a soft shadow, it has no affordance.

## Material 3 / Expressive

Google's full design system: tonal palettes generated from a seed colour, elevation expressed as
tonal surface rather than drop shadow, documented motion and state layers. Material 3 Expressive
adds bolder shape, colour and type.

**Reach for it when you want a complete, accessible, documented system rather than a look** — an
internal tool, an Android-adjacent product, a team without a designer. The contrast and state work
is already done, which is a genuine saving.

The cost is that it looks like Android. That is fine for some products and fatal for a brand that
needs its own identity.

## Neo-brutalism

Hard edges, zero or minimal radius, thick black borders, flat high-contrast blocks, visible
structure, occasionally deliberate misalignment.

Cheap to implement and **accessible almost by accident** — the contrast is high because the whole
premise is high contrast. Good for portfolios, creative agencies, developer tools with a point of
view.

The cost is tone: it reads as a statement. Wrong for anything that must feel careful, institutional
or trustworthy — finance, health, government.

## Bento grid

Modular cells of varying size, borrowed from the Japanese lunchbox.

This is the one on the list that is **information design rather than decoration**: cell size encodes
relative importance, so a bento grid tells the reader what matters before they read anything. Good
for feature overviews, dashboards, product pages.

It needs content of genuinely varying weight. With six equivalent items it is just a grid with
extra steps, and the varied sizing becomes noise.

## Claymorphism

Soft inflated shapes, large radii, pastel fills, a light inner highlight and a soft outer shadow.

Warm and approachable — onboarding, feature showcases, consumer and education products. Pair with
large expressive icons.

The cost is that it reads as playful and slightly juvenile, and the soft shadows eat contrast the
same way neumorphism does if the fills get close to the ground. Not for dense data.

## Aurora and mesh gradients

Large, soft, overlapping colour fields as a ground. Covered in
`motion-and-interaction/references/backgrounds-and-atmosphere.md` — off-canvas placement, low
alpha, and **keep them static**, because animating a large blur is paid every frame.

The contrast trap: brightness varies across the field, so text over it must be checked against the
*brightest* point, not the average.

## Kinetic and expressive typography

Type as the subject — oversized, variable-axis, sometimes animated. The clearest current move away
from a decade of muted minimalism.

Works when the words *are* the content: a manifesto, a launch, a portfolio. Requires a face with
real character at display size and genuine restraint everywhere else, or it is just loud.

Variable fonts make this cheap — one file, animate the axes. Respect `prefers-reduced-motion`.

## Grain and noise

A fine noise overlay at very low opacity. Cheap, and it does two useful things: adds tactility to
flat colour, and **hides banding in large gradients**, which is the most common reason a gradient
looks amateur.

An SVG `feTurbulence` or a small tiled PNG at 3–6% opacity, `pointer-events: none`. Keep it still.

## Choosing, and the AI tells

The style should be derivable from the subject. A lab instrument does not want claymorphism; a
kids' app does not want brutalism.

Currently reading as machine-generated regardless of context:

- **Glassmorphism applied to every surface**, especially with a purple-to-blue gradient behind it
- Near-black ground with a single acid-green or vermilion pop
- `rounded-lg` on absolutely everything, plus an accent rail on every card
- Aurora gradient + Inter + centred hero + three feature cards

Any of these is legitimate when the brief asks for it. None of them is a *choice* when it is simply
what came out.

**Whatever you pick, verify it.** These treatments fail in ways that only appear on a rendered
page — contrast over a real background, a control with no visible affordance, banding, a blur that
drops the frame rate. See `verifying-ui-visually`.
