---
name: tailwind-theming
description: >
  Build a themeable Tailwind UI on semantic design tokens — CSS variables consumed by
  Tailwind v4's @theme, light/dark that costs nothing per component, and colour that
  survives a rebrand. Use when setting up Tailwind in a new project, adding dark mode or a
  second theme, defining or changing design tokens, picking colours for a component, or
  when a design "does not match the brand" and the cause is hard-coded values.
group: stack
---

# Tailwind theming

## One rule: components name roles, never values

A component says what a colour is **for**. It never says what it **is**.

```tsx
// ✗ two themes to maintain, and a rebrand touches every file
<div className="bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50">

// ✓ correct in every theme, forever
<div className="bg-canvas text-ink">
```

If `dark:` appears in a component, a token is missing. `dark:` is for the rare case where the
*design* genuinely differs between themes — a shadow that becomes a border, an image swap — not for
colour, which is what tokens are.

## The three layers

Tokens are defined once, themed once, and consumed everywhere.

```css
@import "tailwindcss";

/* 1 — the palette. Raw values, named literally. Nothing outside this block uses them. */
:root {
  --brand-500: oklch(0.78 0.17 65);
  --zinc-50:   oklch(0.99 0 0);
  --zinc-900:  oklch(0.21 0 0);
}

/* 2 — the semantics. Named for ROLE. This is the layer a theme swaps. */
:root {
  --canvas: var(--zinc-50);
  --ink:    var(--zinc-900);
  --muted:  oklch(0.55 0 0);
  --accent: var(--brand-500);
  --rule:   oklch(0.92 0 0);
}
[data-theme="dark"] {
  --canvas: var(--zinc-900);
  --ink:    var(--zinc-50);
  --muted:  oklch(0.70 0 0);
  --rule:   oklch(0.31 0 0);
}

/* 3 — the bridge. `inline` is what makes Tailwind read the variable at use time
       rather than freezing its value, which is what lets a theme swap work at all. */
@theme inline {
  --color-canvas: var(--canvas);
  --color-ink:    var(--ink);
  --color-muted:  var(--muted);
  --color-accent: var(--accent);
  --color-rule:   var(--rule);
}
```

Now `bg-canvas`, `text-ink` and `border-rule` are theme-correct everywhere, and a rebrand is an
edit to layer 1.

**`@theme inline` is not optional here.** Plain `@theme` resolves the variable once at build time,
so the dark override never takes effect and the theme silently does nothing.

## Naming tokens

Name the job, not the appearance. `--danger`, not `--red`; a danger that turns amber later should
not require renaming anything.

A small set that covers most products:

| Token | Use |
|---|---|
| `canvas` / `surface` / `overlay` | page, raised card, modal ground |
| `ink` / `muted` / `faint` | primary, secondary, tertiary text |
| `accent` / `accent-ink` | brand actions, and what sits legibly on them |
| `rule` / `ring` | hairlines, focus rings |
| `success` / `warning` / `danger` | state, each with a matching `-ink` |

Resist adding a token for one component. Two components wanting the same value is a token; one
wanting a special value is a special value.

## Dark mode

Drive it from an attribute so a user's explicit choice can beat the OS:

```css
@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));
```

Use `next-themes` with `attribute="data-theme"`. Three states matter — light, dark, and **system**,
which is the default and stamps no attribute at all. Test all three; a theme that only works after
someone clicks the toggle is broken for most visitors.

Set `suppressHydrationWarning` on `<html>`. Without it, the server renders one theme and the client
corrects it, and React logs a mismatch on every page.

## Colour that stays legible

Use **oklch**, not hex. Lightness is perceptual, so `oklch(0.7 …)` reads as the same weight across
hues — which is what makes a generated scale look even instead of muddy in the greens.

Contrast is a requirement, not a preference: **4.5:1 for body text, 3:1 for large text and UI
edges.** Brand colours frequently fail this at small sizes; the fix is a darker token for small
type, not a lighter grey for the text. Never signal with colour alone — pair it with an icon,
weight, or label.

## Verify

- Toggle light → dark → system and look at every state, including hover, focus, disabled and
  error. A token missing in one theme is invisible until someone hits it.
- Search the diff for `#`, `rgb(`, and `dark:`. Each hit is either a missing token or a deliberate
  exception that deserves a comment saying why.
- Check focus rings survive both themes. `ring-rule` on a dark canvas is a common invisible focus.
