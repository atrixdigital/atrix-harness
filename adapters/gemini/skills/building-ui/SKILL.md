---
name: building-ui
description: Build interface components and pages that hold up in real use — every state, forms that surface server errors, accessibility, responsive and theme behaviour. Use when creating or changing a component, page, form, layout, modal, or anything a person will look at and click.
group: engineering
---

# Building UI

Most UI bugs are not rendering bugs. They are states nobody triggered locally.

## Find the existing component first

Reach for the design system component before writing a new one. A bespoke button is a permanent
inconsistency, and the third one makes the codebase unmaintainable.

Match the nearest sibling: spacing scale, token usage, loading convention, error convention, form
patterns, file layout.

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

Typecheck, then **render it and interact**. Click the primary action. Submit the form empty.
Resize. A component that has only been read has not been reviewed.

For anything non-trivial, hand it to the `evaluator` role — self-assessment of visual work is
especially unreliable, because it looks finished before it is wired up.
