# Scroll choreography and 3D depth

The recipes behind an award-tier landing page. Every pattern here is in production in
`digitalpakistan/dpak` — `src/components/landing/pass-*.tsx` — which is the reference
implementation to read before building a new one.

## Contents

- When this is worth it
- The five rules
- Momentum scroll
- The progress rail
- Hero scroll-away
- The pinned sequence
- The 3D tilt card
- Scene transitions in depth
- Reveal on enter
- Performance
- Verifying it

## When this is worth it

Scroll choreography is for pages whose job is **persuasion** — a launch page, an owner-acquisition
page, a product story. It buys attention and conviction.

It is wrong for anything whose job is **completion**: a dashboard, a booking flow, a settings
screen, an admin table. There, motion that delays the next click is a tax. A pinned section in a
booking funnel is a bug with good intentions.

One pinned sequence per page. Two is a fairground.

## The five rules

1. **Perspective goes on the parent**, never on the element being transformed. `perspective: 1300`
   on the wrapper; `rotateX/rotateY` on the child. This is the single most common mistake and the
   symptom is a tilt that looks flat and slightly wrong rather than obviously broken.
2. **Depth needs layers.** A card that tilts while its contents stay flush reads as a photograph
   being tilted. Lift the inner elements onto their own Z planes and the same rotation reads as an
   object with thickness.
3. **Progress-driven, not time-driven.** Derive everything from `scrollYProgress` so it scrubs both
   ways and lands wherever the user stops. An animation that *plays* when scroll crosses a
   threshold cannot be scrubbed backwards, and feels broken the moment someone scrolls up.
4. **Pinning is a desktop affordance.** On touch, build a stacked variant — see the mobile split
   below. Hijacking scroll on a phone fights the user's own gesture.
5. **One ease, everywhere.** `cubic-bezier(0.22, 1, 0.36, 1)` — a strong expo-out — used for every
   transition on the page. Mixed easing is what makes a page feel assembled by several people.

## Momentum scroll

Lenis, scoped to the page that wants it, disabled entirely for reduced motion:

```tsx
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  if (reduce) return <>{children}</>;
  return (
    <ReactLenis root options={{ duration: 1.15, smoothWheel: true, lerp: 0.1, touchMultiplier: 1.6 }}>
      {children}
    </ReactLenis>
  );
}
```

**This is a commitment, not a decoration.** It takes over the scrollbar for the whole page, so it
must unmount cleanly on navigation, and it interacts badly with in-page anchors and focus scrolling
unless you route those through Lenis too. Do not apply it app-wide.

## The progress rail

Cheap, and it tells the reader how much story is left:

```tsx
const { scrollYProgress } = useScroll();
<motion.div aria-hidden style={{ scaleX: scrollYProgress }}
  className="fixed inset-x-0 top-0 z-[60] h-1 origin-left bg-gradient-to-r …" />
```

`origin-left` is load-bearing — without it the bar grows from the centre. `aria-hidden`, because it
is redundant to anyone not looking at it.

## Hero scroll-away

The hero does not just scroll off; it recedes while the text below advances. **The differential is
the parallax** — two elements moving at the same rate produce none.

```tsx
const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
const cardScale = useTransform(scrollYProgress, [0, 1], [1, 0.8]);
const cardY     = useTransform(scrollYProgress, [0, 1], [0, -80]);
const textY     = useTransform(scrollYProgress, [0, 1], [0, 90]);   // opposite direction
const fade      = useTransform(scrollYProgress, [0, 0.65], [1, 0]); // gone before the section ends
```

Fade to zero **before** the section ends. An element still at opacity 0.2 when the next section
arrives reads as a rendering bug.

## The pinned sequence

One visual stage stays fixed while content cycles through it. The mechanism is a tall outer section
with a sticky inner viewport:

```tsx
<section ref={ref} style={{ height: `${(STEPS.length + 1) * 72}vh` }}
         className="relative hidden lg:block">
  <div className="sticky top-0 flex h-[100svh] items-center overflow-hidden">
    …stage…
  </div>
</section>
```

```tsx
const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
useMotionValueEvent(scrollYProgress, 'change', (v) => {
  setActive(Math.min(STEPS.length - 1, Math.max(0, Math.floor(v * STEPS.length))));
});
```

Details that decide whether it feels right:

- **~72vh of scroll per step.** Less and steps flick past; more and it feels stuck. The `+ 1` gives
  the last step time on screen before the pin releases.
- `offset: ['start start', 'end end']` — progress runs 0→1 across the *whole* tall section.
- `h-[100svh]`, not `100vh`: on mobile browsers `vh` includes the retracting toolbar and the stage
  gets clipped.
- **Clamp the index.** `scrollYProgress` reaches exactly 1.0 and `Math.floor(1 * n)` is `n`, which
  is off the end of the array.
- `overflow-hidden` on the sticky container, or scene transitions that translate will widen the
  page.

**The mobile split.** The pinned section is `hidden lg:block`, and a separate stacked component
renders the same steps as ordinary scrolling cards. Two components, one data array. Trying to make
one component do both produces a pinned experience that fights touch scrolling.

## The 3D tilt card

```tsx
const px = useMotionValue(0.5), py = useMotionValue(0.5);   // pointer, normalised 0..1
const SPRING = { stiffness: 170, damping: 18, mass: 0.6 };
const rotateX = useSpring(useTransform(py, [0, 1], [10, -10]), SPRING);
const rotateY = useSpring(useTransform(px, [0, 1], [-14, 14]), SPRING);
```

- **Normalise the pointer against the element's own rect**, not the viewport.
- **Spring, don't tween.** A raw pointer-to-rotation binding tracks the cursor exactly and feels
  brittle; the spring gives it mass. Around `stiffness: 170, damping: 18` reads as a physical
  object rather than a spring toy.
- **±10–14° is the range.** Past ~18° the perspective distortion becomes obvious and cheap.
- **Reset to centre on pointer leave**, or the card stays cocked at whatever angle it was abandoned.

**Layer the contents** — this is what sells it:

```tsx
const layer = (z: number) => ({ transform: `translateZ(${z}px)`, transformStyle: 'preserve-3d' as const });
// stripe 2 · header 34 · footer 40 · portrait 52 · QR 70
```

`transformStyle: 'preserve-3d'` on the card **and** on each layer; without it children flatten onto
the card's plane and the Z values do nothing. Keep the range modest — 0–80px reads as a real object
with thickness; 200px reads as elements floating apart.

**The glare** tracks the pointer and is what makes it read as a surface catching light:

```tsx
const glare = useMotionTemplate`radial-gradient(circle at ${glareX} ${glareY}, rgba(255,255,255,0.4), transparent 42%)`;
<motion.div className="pointer-events-none absolute inset-0 mix-blend-soft-light" style={{ backgroundImage: glare }} />
```

`mix-blend-soft-light` rather than a plain white overlay — it interacts with the colour underneath
instead of washing it out. `pointer-events-none`, or it eats the pointer events driving it.

A slow ambient float (`y: [0, -12, 0]` over ~6s) keeps the card alive when nobody is touching it.
Ground it with a large soft shadow, or it floats without weight.

## Scene transitions in depth

When the pinned stage swaps content, rotate it through the Z axis rather than sliding it:

```tsx
<AnimatePresence mode="wait">
  <motion.div key={active}
    initial={reduce ? { opacity: 0 } : { opacity: 0, y: 48,  rotateX: 12,  scale: 0.94 }}
    animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0,   rotateX: 0,   scale: 1 }}
    exit=   {reduce ? { opacity: 0 } : { opacity: 0, y: -48, rotateX: -12, scale: 0.94 }}
    transition={{ duration: 0.5, ease: EASE }} />
</AnimatePresence>
```

`mode="wait"` so the outgoing scene finishes before the incoming one starts — simultaneous is
mush. Exit mirrors entrance in the opposite direction, so it reads as one object leaving rather than
two unrelated animations. The stage needs `perspective` for `rotateX` to mean anything.

## Reveal on enter

For ordinary sections, not the pinned one:

```tsx
<motion.div variants={stage} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-90px' }}>
```

```tsx
const stage = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } } };
const item  = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } } };
```

- **`once: true`.** Re-animating on every pass is the clearest tell of an over-animated page.
- **Negative `margin`** fires slightly before the element is fully in view, so it is already settled
  when the reader's eye arrives.
- **`staggerChildren: 0.07`.** Beyond ~0.1 the last item is visibly late.
- **Never above the fold.** The first screen renders complete.

## Performance

`transform` and `opacity` only — everything here is one of those two. Beyond that:

- **Large blurs are the expensive thing.** A `blur-[170px]` ambient glow is fine while static and
  costly if it animates or sits under a moving layer. Keep them still.
- `will-change: transform` on the two or three elements that actually animate. Applied broadly it
  makes things slower, not faster, by forcing layers for everything.
- A pinned section holds a full-viewport composite the whole time it is pinned. Profile it on a
  mid-range Android, not on your laptop.
- Framer Motion is a real bundle cost. Lazy-load below-the-fold components that pull it in — dpak
  does exactly this in `curriculum-lazy.tsx` and `apply-form-lazy.tsx`.

## Verifying it

- **Scrub up as well as down.** Progress-driven animation must reverse cleanly; this is where
  threshold-triggered animation gives itself away.
- **Turn on reduced motion and take the whole page again.** Every pattern here must degrade to a
  static, complete page — not a blank one waiting for an animation that will never fire. This is
  the failure that ships: content with `opacity: 0` and no trigger.
- Resize across the `lg` boundary and confirm the pinned and stacked variants hand over cleanly.
- CPU throttle 4×, then scroll. Also check a real phone; `100svh` and momentum scroll both behave
  differently there.
- Tab through it. Pinned sections routinely trap focus, and focusing an element inside a section
  that is scrolled away is disorienting.
