---
name: building-ui
description: Build interface components and pages that hold up in real use — every state, forms that surface server errors, accessibility, responsive and theme behaviour. Use when creating or changing a component, page, form, layout, modal, or anything a person will look at and click.
group: engineering
---

# Building UI

Most UI bugs are not rendering bugs. They are states nobody triggered locally.

## Decide the direction before you write code

For anything new — a page, a section, a product surface — the direction comes first: palette, type
pairing, layout concept, and the one signature element it will be remembered by. Load
`frontend-design` and run its process. Without a direction, the output converges on the same
centred hero, three rounded cards and Inter that every generated interface has, and no amount of
later polish rescues it.

Within an existing product, the direction already exists — match it. `layout-and-spacing` covers
composition, `motion-and-interaction` covers movement, and `tailwind-theming` covers tokens.

**[references/design-styles.md](references/design-styles.md)** is the catalogue of surface
treatments — glassmorphism, Liquid Glass, neumorphism, Material 3, neo-brutalism, bento, clay,
aurora, kinetic type — with how to build each and what each costs. Two carry real accessibility
debt (neumorphism removes contrast by design and fails the 3:1 floor for non-text controls;
glass inherits whatever is behind it, so it can pass contrast on one screen and fail on the next),
and glass-on-everything is a current AI tell. **Pick one and commit** — a page wearing three is the
failure mode.

## Find the existing component first

Reach for the design system component before writing a new one. A bespoke button is a permanent
inconsistency, and the third one makes the codebase unmaintainable.

Match the nearest sibling: spacing scale, token usage, loading convention, error convention, form
patterns, file layout.

## The quality bar

**[references/interface-quality-bar.md](references/interface-quality-bar.md)** is the floor every
interface clears — targets, forms, feedback, semantics, performance. It is a subset of
[vercel-labs/web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines),
which is maintained upstream and worth reading fresh rather than trusting a local copy.

Four that this team keeps getting wrong:

- **Hit targets ≥ 24px, ≥ 44px on touch.** Expand the hit area, do not grow the icon.
- **Never `<div onClick>`.** `<a>` navigates, `<button>` acts. The element type is what gives you
  middle-click, keyboard activation, focus order and the right announcement — all of which get
  rebuilt by hand, badly, on a div.
- **Filters, tabs, pagination and open panels live in the URL.** If you cannot link someone to what
  you are looking at, the state is in the wrong layer.
- **Confirm destructive actions, or offer Undo.** Undo is better: a confirmation dialog taxes every
  correct action to catch a rare wrong one.

## Every state, before you call it done

A component is not finished until all four exist **and you have looked at each**:

| State | The failure |
|---|---|
| **Loading** | A layout-shifting spinner where a skeleton belongs |
| **Empty** | A blank panel with no way forward |
| **Error** | "Something went wrong" — says nothing, offers nothing |
| **Success** | Only ever tested with three tidy items |

Empty and error ship broken most often, because nobody triggers them locally. Trigger them
deliberately: kill the network, return `[]`, force a 500.

And test the ugly success case — one item, two hundred items, a name that is 90 characters, a
missing avatar, a null field.

## Forms

- **Surface server-side field errors on the fields.** Parse the response and map errors to inputs.
  A generic "Validation failed" banner when the server told you exactly which field was wrong is
  throwing away information the user needs.
- **Validate client-side with the same schema the server uses** — imported, not hand-copied. A
  copied schema drifts, and the drift shows up as a form that passes locally and fails on submit.
- **Never lose typed input** on a failed submit.
- Disable submit while in flight, **and** make double-submit harmless anyway. The disable is a
  courtesy; idempotency is the guarantee.

## Accessibility while you write it, not after

Five minutes now, a rewrite later:

- Labels tied to inputs. Placeholder is not a label.
- Keyboard reachable in a sensible order, with visible focus.
- Interactive things are `button` and `a`, not `div` with a click handler.
- Contrast that passes. Never colour as the only signal.
- Announce what changed — a toast nobody's screen reader sees did not happen.

## Responsive and theme

Check **375px** and both themes before calling it done. Nothing may scroll horizontally; wide
content — tables, code, diagrams — scrolls inside its own container.

Define colours as tokens, never a hardcoded hex in a component, and never `dark:` where a token
would do — the `tailwind-theming` skill has the token structure and why `@theme inline` is what
makes a theme swap work at all.

User-visible strings go through the translation layer rather than into JSX, even in a
single-language product; `nextjs-i18n` covers the extraction and why retrofitting is the expensive
path. Typefaces and the type scale are in `typography-and-fonts`.

## Verify by using it

Typecheck, then **render it, screenshot it, and look at the images** — every breakpoint, both
themes, every state. `verifying-ui-visually` has the loop and the critique checklist. Click the
primary action. Submit the form empty. Tab to the end. A component that has only been read has not
been reviewed.

For anything non-trivial, hand it to the `evaluator` role — self-assessment of visual work is
especially unreliable, because it looks finished before it is wired up.
