---
name: motion-and-interaction
description: >
  Add motion and atmosphere that make an interface feel crafted rather than decorated —
  durations, easing, scroll choreography, 3D depth, ambient backgrounds and reduced-motion
  support. Use when adding animation or transitions, building hover and press states, a
  modal, drawer, toast or page transition, when building a landing or launch page with
  scroll-driven motion, parallax, pinned sections, smooth scrolling, a 3D tilt card, a
  glow or gradient background, a canvas or shader effect, or when an interface feels
  sluggish, janky or over-animated.
group: engineering
---

# Motion and interaction

Motion has one job: **explain what just happened.** Where a thing came from, what it turned into,
what is still loading. Motion that explains nothing is decoration, and decoration is the fastest
way to make a considered interface read as generated.

Spend animation where it carries meaning, and let everything else be still.

## Duration

| Range | For |
|---|---|
| **100–150ms** | Hover, focus, press, colour changes |
| **200–300ms** | Dropdowns, tooltips, toasts, accordions |
| **300–400ms** | Modals, drawers, route transitions |
| **> 400ms** | Almost always wrong |

Under ~100ms reads as a jump rather than a transition. Over ~400ms the interface feels like it is
waiting for you. **Larger elements travelling further need slightly longer** — a full-screen drawer
at 150ms looks broken; a checkbox at 400ms feels sluggish.

## Easing

Never `linear` for anything that moves — it reads mechanical. Never the default `ease`.

- **`ease-out`** for things entering, and for the overwhelming majority of UI. Fast start, gentle
  settle: the element appears immediately and comes to rest, which is what feels responsive.
- **`ease-in`** only for things leaving. On an entrance it feels like lag.
- **`ease-in-out`** for things moving between two on-screen positions.

Springs suit dragging, physical gestures and playful brands. They are worse than a curve for
routine UI, where predictability beats personality.

## Animate only the cheap properties

**`transform` and `opacity`.** They run on the compositor and stay at 60fps.

Animating `width`, `height`, `top`, `left`, `margin` or `padding` triggers layout on every frame —
this is what janky UI *is*. Move with `translate`, size with `scale`, and reach for a fixed height
plus `overflow: hidden` rather than animating height directly.

Never animate a property on a large blurred element (a big `box-shadow` or `filter`); it is
expensive per frame regardless of which property you touch.

## Interaction states are motion too

Every interactive element needs **hover, focus-visible, active and disabled** — and they must be
distinguishable from each other, not one shared style.

- **Press should be immediate.** `active:scale-[0.98]` with no transition. A press that eases feels
  like the app did not hear you.
- **Focus rings never animate in.** Keyboard users need them instantly, and a delay reads as a bug.
- Hover states must not exist alone: touch devices have no hover, so anything discoverable only on
  hover is invisible to half your users.

Reserve motion for state that actually changed. Animating a value that reloaded to the same number
is noise.

## Entrances, and the over-animation trap

A staggered reveal of a few elements (~50ms apart) reads as considered. The same effect applied to
every element on the page reads as a template — and **excessive animation is one of the clearest
tells that a design was generated rather than designed.**

Rules that keep it on the right side:

- **One orchestrated moment per page**, not scattered effects everywhere.
- **Never animate content the user came to read** on first paint. A hero that fades in delays the
  only thing that mattered.
- Scroll-triggered reveals: once, subtle, and never on content above the fold.

If you cannot say what a given animation explains, delete it.

## Depth and scroll choreography

A persuasion page — a launch, a product story, an owner-acquisition page — can carry far more
motion than a product screen, and the techniques are different in kind: momentum scrolling, a
pinned stage that content cycles through, a card that tilts in real 3D under the cursor.

Two references carry the full recipes, both taken from the Pakistan Pass page in
`digitalpakistan/dpak` — read `src/components/landing/pass-*.tsx` before building a new one.

- **[references/scroll-choreography.md](references/scroll-choreography.md)** — momentum scroll, the
  progress rail, hero scroll-away, the pinned sequence, the 3D tilt card, scene transitions.
- **[references/backgrounds-and-atmosphere.md](references/backgrounds-and-atmosphere.md)** — the
  ground/texture/light layer stack, seamless sections, and when a canvas or shader is justified.

The five rules that decide whether it reads as crafted or as effects:

1. **Perspective goes on the parent**, never on the element being transformed. The most common
   mistake, and it looks subtly wrong rather than obviously broken.
2. **Depth needs layers.** A card that tilts while its contents stay flush reads as a photo being
   tilted. Lift the inner elements onto their own Z planes (`translateZ`, 0–80px, with
   `preserve-3d` on every one) and the same rotation reads as an object with thickness.
3. **Progress-driven, not time-driven.** Derive from `scrollYProgress` so it scrubs both ways.
   Animation that *plays* at a threshold cannot reverse, and feels broken the moment someone
   scrolls up.
4. **Pinning is a desktop affordance.** On touch, render a stacked variant from the same data —
   never hijack a scroll gesture on a phone.
5. **One ease everywhere.** `cubic-bezier(.22, 1, .36, 1)`. Mixed easing is what makes a page feel
   assembled by several people.

**Where this is wrong:** anything whose job is completion rather than persuasion. A pinned section
in a booking funnel is a bug with good intentions. One pinned sequence per page; two is a
fairground.

## Atmosphere is four layers, and none of it is a shader

Depth behind the content comes from stacking, in this order: a **ground** gradient that starts and
ends on the same colour so sections stack without a seam; a **texture** (a fine dot grid at
0.1–0.4 opacity) so a large dark area does not read as an empty div; two or three **light** sources
— 400–620px circles blurred 140–170px, positioned off-canvas at low alpha so you see falloff rather
than shape; then the **content**, which needs `relative` or it renders behind all of it.

Every decorative layer is `absolute` and `pointer-events-none`. A full-bleed glow over a button is
a dead button, and it fails silently.

**Keep the blurs static.** A still 620px blur is paid once; the same element animating is paid
every frame, and it is the most common cause of a page that scrolls at 30fps on a mid-range phone.

Reach for `<canvas>` or WebGL only when the effect is genuinely generative or reactive — particles,
evolving noise, per-pixel response to input. Everything described above is compositor work the
browser already optimises; a shader reproducing it buys nothing and costs a context, a render loop
and a fallback path.

## Reduced motion is a requirement

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

This is an accessibility need, not a preference — vestibular disorders make large motion genuinely
unpleasant. Large translations, parallax and scale are the offenders; opacity is usually fine.

Ship the query, then **actually enable the OS setting and use the interface.** Everything must
still work, with state changes instant rather than absent.

For scroll-driven work this is where the real failure ships: content that starts at `opacity: 0`
waiting for a trigger that never fires leaves a **blank page**, not a static one. Reduced motion
must land on the finished state, not the initial one — gate the animation, never the content.

## Loading

Under ~300ms, show nothing — a spinner that flashes is worse than a brief pause.

Beyond that, prefer a **skeleton matching the real layout** so nothing shifts when content lands.
A spinner in a space the content will not fill guarantees a jump. Over ~10 seconds, show progress
or a message; an indeterminate spinner reads as frozen.

## Verify

- Throttle the CPU to 4× in DevTools and interact. Motion that is smooth only on your machine is
  not smooth.
- Record the interaction and step through it — see `verifying-ui-visually`. Jank is obvious frame
  by frame and easy to miss live.
- Turn on reduced motion at the OS level and use the whole flow.
- Tab through every interactive element and confirm focus is immediate and visible.
