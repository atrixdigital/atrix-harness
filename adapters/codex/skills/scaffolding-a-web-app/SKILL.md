---
name: scaffolding-a-web-app
description: >
  Stand up a new Atrix web project with the whole house stack wired on day one — Next.js,
  Tailwind tokens and theming, i18n, SEO and analytics, fonts, Postgres with Kysely,
  migrations and Redis. Use when starting a new web app or site, setting up a project from
  scratch, or bringing an existing project up to the house standard.
group: delivery
---

# Scaffolding a web app

The order below exists because each step is cheap now and expensive later. **i18n, theming and the
data layer are the three that cost days to retrofit** — none of our current apps have i18n, which
is exactly why.

Do not ask the human to run these. Run them, then report what was created.

## The stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router), React 19 |
| Styling | Tailwind v4, CSS-first `@theme` |
| Theming | Semantic tokens + `next-themes`, `data-theme` |
| i18n | `next-intl`, `[locale]` segment |
| Fonts | `next/font/local`, variable, self-hosted |
| Analytics | `@next/third-parties` → GA4 |
| Database | PostgreSQL + **Kysely** (new work; Prisma apps stay Prisma) |
| Migrations | `kysely-ctl`, timestamp-prefixed |
| Cache | Redis — Upstash on serverless, ioredis in workers |
| Validation | Zod at every boundary |

## Order of work

**1 — Create, then commit before anything else.** `create-next-app` with TypeScript, App Router,
Tailwind. Commit the untouched output so every later change is reviewable as a diff.

**2 — Tokens and theming.** Before the first component. A component written against `bg-white` is a
component to rewrite. Set up the three-layer token structure and the dark variant — see
`tailwind-theming`.

**3 — Fonts.** `src/lib/fonts.ts`, variable files self-hosted, wired to `--font-*` tokens. Record
the licence next to the files — see `typography-and-fonts`.

**4 — i18n.** `routing.ts`, `request.ts`, `navigation.ts`, middleware, and move `app/` under
`app/[locale]/`. **Do this with one locale if the product is monolingual today** — the cost is an
hour now against days later. `setRequestLocale` in every layout and page — see `nextjs-i18n`.

**5 — SEO scaffolding.** `src/lib/seo.ts` with the site constants and `pageMetadata()`,
`metadataBase` in the root layout, `app/sitemap.ts`, `app/robots.ts`, an OG image, `llms.txt` — see
`seo-and-analytics`.

**6 — Data layer.** Kysely instance at module scope, generated types committed, `kysely-ctl`
configured, first migration written and run. Two connection strings: pooled for the app, direct for
migrations — see `kysely-postgres`.

**7 — Cache.** `src/lib/cache.ts` with the single `cached()` interface, even if nothing uses it
yet. It exists so the first cache call goes through it — see `caching-with-redis`.

**8 — Analytics, gated on env.** GA renders only when `NEXT_PUBLIC_GA_ID` is set, so previews stay
out of production data.

**9 — Onboard it to the harness.** `AGENTS.md` (stack and commands), `UNDERSTANDINGS.md`, then
`atrix init` and `atrix index` — see `onboarding-a-project`.

## Environment

`.env.example` is committed and complete on day one, with every key the app reads and a comment
saying where each value comes from. A missing `.env.example` is why the next person's first hour is
spent guessing.

```
DATABASE_URL=            # pooled — the app
DIRECT_URL=              # unpooled — migrations only
REDIS_URL=
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_GA_ID=       # optional; analytics is skipped when unset
```

**Validate env at startup with Zod**, in one module that throws on a missing key. Discovering a
missing variable through a runtime error in a request handler is the alternative.

Never commit real values. `.env*` stays gitignored, and nothing reads a secret behind a
`NEXT_PUBLIC_` prefix — that ships to the browser.

## Before it is a project

- `bun run typecheck` and `lint` pass, and both are wired into CI.
- The build output shows public routes **prerendered**, not dynamic.
- Light, dark and system themes all render correctly.
- Both locales resolve, `hreflang` is present, `<html lang>` and `dir` are right.
- View source on the deployed page: title, canonical, OG tags, JSON-LD all present.
- A migration has been run and rolled back locally.
- `README.md` says how to run it in under ten lines. If setup needs more, fix the setup.

## Bringing an existing project up

Same order, one step per PR. Theming first — it is the largest diff and the one that blocks the
others. Do not attempt theming and i18n in a single change; both touch every component, and a
review that large gets approved without being read.
