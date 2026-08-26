# Interface quality bar

The floor every Atrix interface clears before it is called done. Rules here are testable — each
one either passes or fails on a rendered page, which is what makes them worth writing down.

**Canonical upstream:** [vercel-labs/web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines)
— ~100 rules across 17 categories, actively maintained. **Read it fresh rather than trusting this
file to be current**; what follows is the subset our own work keeps getting wrong, plus the Atrix
additions. When the two disagree, upstream wins and this file gets updated.

## Contents

- Targets and input
- Forms
- State lives in the URL
- Feedback and destructive actions
- Navigation semantics
- Animation
- Dark mode and theming
- Layout
- Performance
- Content

## Targets and input

- **Hit target ≥ 24px, and ≥ 44px on touch.** If the visual is smaller, expand the hit area with
  padding or a pseudo-element rather than growing the icon.
- **Inputs at ≥ 16px on mobile.** Below that iOS zooms on focus and the layout jumps — see
  `typography-and-fonts`.
- **Never disable browser zoom.** Use `touch-action: manipulation` to kill the double-tap delay
  instead of `user-scalable=no`.
- Respect **safe areas** (`env(safe-area-inset-*)`) so content clears notches and home indicators.

## Forms

- **Accept free text first, validate after.** Blocking or reformatting as someone types is the
  single most disliked pattern in a form.
- **Keep submit enabled until the request starts.** A disabled button hides *why* the form cannot
  be sent; let it submit and surface the errors.
- **Errors inline, next to the field. On submit, move focus to the first error.** A summary at the
  top that nobody scrolls back to is not error handling.
- Every control has a real label — a placeholder is not a label, and it disappears exactly when the
  user needs it.
- Use correct `type`, `inputmode` and `autocomplete`. This is most of mobile form quality.

## State lives in the URL

**Filters, tabs, pagination, sort, expanded panels and open dialogs belong in the URL.** If a
person cannot link someone to what they are looking at, or a refresh loses their place, the state
is in the wrong layer.

This is a design rule as much as a technical one — it decides whether the thing is shareable.

## Feedback and destructive actions

- **Confirm destructive actions, or give an Undo window.** Undo is better where it is possible:
  a confirmation dialog is a tax on every correct action to catch a rare wrong one.
- Optimistic updates, reconciled on response. Show the change immediately, correct it if the
  server disagrees, and say so when it does.
- Toasts go in a **polite `aria-live` region** — otherwise a screen reader never hears them.
- Anything over ~300ms needs feedback; anything over ~10s needs progress, not a spinner.

## Navigation semantics

**Never `<div onClick>`.** Use `<a>`/`<Link>` for navigation and `<button>` for actions. The
element type is what gives you middle-click, cmd-click, right-click, keyboard activation, focus
order and the correct screen-reader announcement — all of which have to be rebuilt by hand,
badly, on a div.

Include a **skip-to-content** link, and keep headings hierarchical (no jump from `h1` to `h3`).

## Animation

Beyond durations and easing in `motion-and-interaction`:

- **Animations must be interruptible and input-driven.** An animation that must finish before it
  responds again makes the interface feel slow no matter how short it is.
- Autoplay only for muted, non-essential loops.
- `prefers-reduced-motion` gets a reduced variant, not a broken page — the content lands in its
  final state.

## Dark mode and theming

- **Set `color-scheme` explicitly** (`:root { color-scheme: light dark }` or per theme). Without
  it, native form controls, scrollbars and autofill styling stay in the wrong theme — a class of
  bug that looks like a CSS mistake and is not.
- Add `<meta name="theme-color">` per theme so the browser chrome matches.
- Never rely on colour alone for status; pair it with an icon, weight or label.

## Layout

- Check **mobile, laptop, and ultra-wide** — the last at 50% browser zoom, which is how a
  1440-wide design actually fails on a 34" monitor.
- Prefer Flex/Grid over JavaScript for layout.
- Design every state: **empty, sparse, dense, error, loading**. Sparse and dense are the two that
  get skipped, and they are where a layout falls apart.

## Performance

- **Virtualise lists over ~50 items.**
- Mutations (`POST`/`PATCH`/`DELETE`) should target **< 500ms**; past that, the interface needs to
  acknowledge the action rather than wait.
- Profile with CPU throttling on, not on the machine you built it on.

## Content

- Active voice, action-oriented. "Install the CLI", not "You will need the CLI".
- A control names what happens: "Publish" → a toast that says "Published".
- Use the ellipsis character `…`, not three periods.
- Icons carry text labels, or an accessible name if genuinely icon-only.
- Errors say what happened and what to do. No apologies, no vagueness.
