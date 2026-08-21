---
id: incident-0001
title: zod .default() breaks under exactOptionalPropertyTypes
date: 2026-08-20
status: merged
cost: 15m
---

## What happened

`bun x tsc --noEmit` failed on `packages/cli/src/lib/core.ts` with four `TS2322` errors, all of the
shape:

```
Type 'Doc<{ ...; applies?: string[] | undefined }>[]' is not assignable to
Type 'Doc<{ ...; applies: string[] }>[]'
```

The schemas validated fine at runtime and `atrix build` worked. Only the typecheck failed.

## Why it happened

Two things compounding:

1. A zod schema has **two** types — input (where `.default()` fields are optional) and output
   (where they are required). `z.infer<S>` gives the output type.
2. The generic was declared as `load<T>(…, schema: z.ZodType<T>, …)`. TypeScript resolved `T`
   against the schema's *input* type, so the function returned `Doc<Input>` while the caller's
   `CoreSet` expected `Doc<Output>`.

`exactOptionalPropertyTypes: true` is what made this visible rather than silently wrong — without
it, `string[] | undefined` would have been quietly assignable.

## What fixed it

Constrain on the schema, not the payload, and derive the type from it:

```ts
// before
function load<T>(root: string, files: string[], schema: z.ZodType<T>, issues: CoreIssue[]): Doc<T>[]

// after
function load<S extends z.ZodTypeAny>(
  root: string, files: string[], schema: S, issues: CoreIssue[],
): Doc<z.infer<S>>[]
```

Separately, `interface Check { detail?: string }` needed `detail?: string | undefined` to accept an
explicitly-`undefined` property under the same compiler flag.

## What the system should learn

Generic helpers that take a zod schema should be parameterised by the **schema type**
(`S extends z.ZodTypeAny`) and return `z.infer<S>` — never by the payload type. The payload form
type-checks in isolation and only fails at the call site, which is a confusing place to debug it.

This generalises: it is a property of zod + strict TypeScript, not of this repo. It belongs in the
stack rules, and it will bite anyone using Zod at system boundaries — which is every Atrix repo.

## Proposed change

- [x] New or amended rule in `core/rules/` — a `typescript-strict` rule covering the zod generic
      pattern and the `exactOptionalPropertyTypes` interaction
- [ ] New or amended skill in `core/skills/`
- [ ] Nothing — one-off, recorded for the record
