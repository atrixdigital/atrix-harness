---
name: elysia-bun-api
description: Atrix conventions for Bun + Elysia + Kysely backends — the buildApp factory, route module layout, dependency injection, and testing against a real database. Use when adding or changing an endpoint, service or migration in a Bun/Elysia API such as ezrov or founders-co.
group: stack
---

# Bun + Elysia + Kysely

The conventions already in use across Atrix backends. Match them; do not improve on them locally.

## The app is a factory, not a module

```ts
export function buildApp({ db, secret, redis, twilio }: Deps) {
  return new Elysia()
    .use(publicRoutes({ db }))
    .use(requireAuth({ secret }))
    .use(bookingRequestsRoutes({ db }));
}
```

Dependencies are **passed in**, never imported from a singleton. This is what makes the app
testable without a running server, and it is the single most load-bearing convention here.

Entry point wires the real dependencies and calls `buildApp`. Nothing else constructs an Elysia
instance.

## Route modules

One file per domain under `routes/`, exporting a function that takes its dependencies and returns
a plugin. Keep handlers thin: parse, authorise, call a service in `lib/` or `services/`, shape the
response.

Validate the body, params and query with a schema at the top of the handler. Inside the handler,
trust the parsed type — no re-checking.

## Guards fail closed and return the response

```ts
export function guardCron(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new NextResponse('Cron not configured', { status: 503 });
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  return null;
}
```

Two properties worth copying: **missing configuration denies** rather than skipping the check, and
the guard returns the rejection so the caller short-circuits with `if (denied) return denied;`.
A guard returning a boolean invites forgetting to act on it.

## Kysely

```ts
const user = await db
  .insertInto('users')
  .values({ email })
  .returning('id')
  .executeTakeFirstOrThrow();
```

- `executeTakeFirstOrThrow` when absence is a bug; `executeTakeFirst` when it is a valid outcome.
- **Scope every query on a multi-tenant table by the authenticated org**, not only by id. See the
  `secure-coding` skill — this is the recurring defect in this codebase family.
- Types come from the shared `@<org>/db` package. After editing them, rebuild that package before
  the API typecheck will see the change.

## Testing against a real database

The house pattern, and it is better than mocking:

```ts
describe.skipIf(!connectionString)('POST /users/profile', () => {
  beforeAll(() => { db = createDbClient(connectionString!); app = buildApp({ db, secret }); });
  afterAll(async () => {
    await db.deleteFrom('users').where('id', 'in', userIds).execute();
    await db.destroy();
  });

  it('sets the name without touching points when residencyCategory is omitted', async () => {
    const response = await app.handle(new Request('http://localhost/users/profile', { ... }));
  });
});
```

- **`app.handle(new Request(...))`** — exercises the real routing, middleware and serialisation
  with no server and no port.
- **`describe.skipIf`** so a contributor without a database stays green. Self-skipping is not a
  cost signal; it keeps CI keyless.
- **Track created ids and delete them in `afterAll`**, even on failure. Tests own their resources.
- Name the test after the rule it encodes, not the endpoint.

## Migrations

Kysely migrations, expand/contract, both directions tested locally. See the
`changing-data-safely` skill before touching a hosted database.
