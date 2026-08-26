---
id: incident-0008
title: framework conventions outran the model, and RTL hid a bug English could not show
date: 2026-08-26
status: merged
cost: 45m
---

## What happened

Scaffolding `projects/assay-grade` — the first real project built from the harness skills —
surfaced three defects. None produced an error message. Two would have shipped.

## 1 · `middleware.ts` is `proxy.ts` in Next 16

Next 16 renamed the convention: the filename, the named export, and the runtime (`nodejs`, not
configurable). `next-intl` still documents `middleware.ts`.

Written under the old name the file **compiles, passes lint, and never runs.** No locale
negotiation, no redirect, no error anywhere. The tell is in the build output, which prints
`ƒ Proxy (Middleware)` when it is wired correctly.

Caught only because the project's generated `AGENTS.md` says to read
`node_modules/next/dist/docs/` before writing code, and that instruction was followed.

**Next ships its own version guide inside the package.** Framework conventions move faster than
any model's training data, and the failure mode for a convention change is silence, not a stack
trace. Read the bundled guide before writing anything convention-based — file names, exported
symbol names, runtime config.

## 2 · Latin data reverses inside RTL text

Standing up an Arabic locale surfaced this, in the rendered page only:

| Written | Rendered in `ar` |
|---|---|
| `5 mg vial` | `mg vial 5` |
| `99.40 %` | `% 99.40` |
| `$62` | `$US 62` |

The bidirectional algorithm reorders Latin runs inside an RTL paragraph. Logical properties
(`ps-*`, `border-s`, `text-start`) fix the layout and do nothing about this. The fix is
`<bdi dir="ltr">` around every Latin-script technical value, plus
`currencyDisplay: 'narrowSymbol'`.

The skill covered RTL layout and said nothing about bidi — so the skill was followed correctly and
the bug shipped anyway.

**Invisible in the default locale, invisible in code review, obvious in a screenshot.** It is the
strongest argument yet for the skill's existing advice to stand the second locale up on day one:
an English-only build physically cannot show you this class of bug.

## 3 · `@theme inline` mapped to itself

```css
:root         { --color-canvas: var(--zinc-50); }
@theme inline { --color-canvas: var(--color-canvas); }   /* resolves to itself */
```

Tailwind's theme keys are `--color-*`, so the semantic layer needs its own namespace. Self-written,
caught on re-reading the file rather than by any tool — nothing errors, you just get a half-styled
page and start looking in the wrong place.

Also fixed while here: React 19's `react-hooks/set-state-in-effect` flags the standard
`useEffect(() => setMounted(true), [])` hydration guard. `useSyncExternalStore` replaces it.

## The fix

- `nextjs-i18n` — bidi isolation section; `proxy.ts` in the file map with the reason
- `nextjs-app-router` — "read the bundled docs" section, the `proxy` rename, async `params`,
  and the React 19 rule
- `tailwind-theming` — the namespace requirement, with both forms shown

## The rule

**A convention change fails silently; only the artifact shows it.** For anything convention-based,
read the framework's own bundled documentation rather than recalling it, and confirm the wiring in
the build output rather than in the source.

And: **a locale you do not render is a locale you have not tested.** Related: [[incident-0006]] and
[[incident-0007]] — the same shape, three different layers. Structural checks answer "is the file
correct"; they never answer "did it run" or "does it read".
