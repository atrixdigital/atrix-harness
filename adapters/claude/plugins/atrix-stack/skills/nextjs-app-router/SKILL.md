---
name: nextjs-app-router
description: Atrix conventions for Next.js App Router projects — route handlers, guards, runtime selection, server versus client boundaries, and the safety pattern for automation that moves money. Use when adding a page, route handler, server action, or cron endpoint in a Next.js app such as PlayO-web, oo7ai-next or atrix.dev.
group: stack
---

# Next.js App Router

## Server by default

Components are server components unless they need interactivity. Push `'use client'` as far down
the tree as it will go — a client boundary high in the tree drags everything below it into the
bundle.

Data fetching belongs in server components and server actions. A client component calling `fetch`
to your own API is usually a server component that has not been recognised yet.

## Route handlers

```ts
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const denied = guardCron(req);
  if (denied) return denied;
  ...
}
```

- **Declare the runtime explicitly.** Anything touching a database driver, a Node API or a native
  module needs `nodejs`; the default is not always what you want and the failure is at deploy time.
- **Guards return the rejection**, and the caller short-circuits on it. Fail closed: missing
  configuration returns 503, not "skip the check".
- Derive identity from the session. Never accept `orgId`, `userId`, `role` or `price` from a body.

## Automation that moves money is report-only until armed

The convention worth copying most:

```ts
// Report-only unless explicitly armed. A refund can't be undone, so acting
// automatically is opt-in: set RECONCILE_LIVE=1 once you've watched a few
// dry runs come back clean. `?dryRun=1` forces a report even when armed.
const armed = process.env.RECONCILE_LIVE === '1';
const dryRun = url.searchParams.get('dryRun') === '1' || !armed;
```

Any job that charges, refunds, sends or deletes ships **reporting only**. Someone watches it come
back clean for a while, then arms it with an environment variable. A forced dry-run override
survives arming, so the behaviour can always be inspected without disabling the job.

Log the headline finding with `console.error` so it surfaces in platform logs and error tracking
even when nobody reads the JSON response.

## Caching is a decision, not a default

State it explicitly for every fetch and route — `revalidate`, `cache`, `dynamic`. A page that
caches when it should not is a stale-data bug that only appears in production; the reverse is a
cost bug. Neither shows up locally.

## Environment variables

Anything with a public prefix is in the browser bundle. Check what your prefix actually exposes
before putting a value behind it. Server-only secrets are read in server components, actions and
route handlers only.

Config precedence bites: know whether the tool you are running reads `.env` or `.env.local`, and
whether that is the same file the app reads. See `changing-data-safely`.

## After a schema change, restart the dev server

A stale generated client returns confident wrong results while a health check passes. This costs
more debugging time than it should; restart first, diagnose second.

## Verify

Typecheck, then load the page and click the primary action. Check 375px and both themes. For
anything non-trivial, hand it to the `evaluator` role.
