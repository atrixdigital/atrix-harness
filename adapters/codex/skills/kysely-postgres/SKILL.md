---
name: kysely-postgres
description: >
  Work with PostgreSQL through Kysely — generated types, query patterns, transactions,
  connection pooling in serverless, and a migration convention that does not collide. Use
  when adding or changing a database query, writing a migration, designing a schema, fixing
  a slow or N+1 query, or setting up the data layer in a new project.
group: stack
---

# Kysely and Postgres

**Kysely is the default for new work.** Existing apps on Prisma — PlayO-web, oo7ai-next,
atrix.dev-v2 — stay on Prisma; do not migrate one because you are touching it. Mixing both inside a
single app is the outcome to avoid.

Why Kysely for new code: real SQL with real types, no engine binary or generated client to ship,
and no query it cannot express. Why Prisma stays: it is working, and a rewrite buys nothing.

## Types come from the database

Generate them (`kysely-codegen`) and commit the output. Hand-written table interfaces drift from
the schema, and the drift shows up as a runtime error in the one branch nobody tested.

```ts
export interface Database {
  venue: VenueTable;
  court: CourtTable;
}
// Generated: Selectable / Insertable / Updateable are derived per table.
```

Use `Selectable<T>` for rows you read, `Insertable<T>` for writes. They differ — defaults and
generated columns are optional on insert and present on select — and using one type for both is
how `id` ends up optional throughout the codebase.

## Queries

```ts
const venues = await db
  .selectFrom('venue')
  .innerJoin('court', 'court.venueId', 'venue.id')
  .where('venue.orgId', '=', orgId)
  .select(['venue.id', 'venue.name', db.fn.count('court.id').as('courts')])
  .groupBy('venue.id')
  .execute();
```

- **Select the columns you need.** `selectAll()` in a list endpoint ships columns that later become
  sensitive, and the leak arrives with the migration that adds them.
- **Never interpolate user input into `sql` templates.** `sql` tags parameterise; string
  concatenation into one does not, and that is the injection.
- **`orgId`/`userId` in the `where` clause, derived from the session** — never from the request
  body. Tenancy enforced in the query is tenancy that holds.
- Join rather than loop. A `Promise.all` over ids is an N+1 with extra steps.

## Transactions

Anything that writes more than one row that must agree:

```ts
await db.transaction().execute(async (trx) => {
  const booking = await trx.insertInto('booking').values(input).returningAll().executeTakeFirstOrThrow();
  await trx.insertInto('ledger').values({ bookingId: booking.id, amount }).execute();
  return booking;
});
```

Pass `trx` down — a helper that closes over `db` silently runs outside the transaction and commits
independently. That is the bug that makes a refund exist without its ledger row.

**Never call an external service inside a transaction.** A Stripe call inside an open transaction
holds a connection for the length of a network round trip and rolls back a charge you already made.
Take the money, then record it, and make the record idempotent.

## Migrations

**Timestamp-prefixed, never integer-prefixed:**

```
20260826T1430_add_venue_org_id.ts
```

Integer prefixes collide the moment two people work in parallel — founders-co has two `002` and two
`017` migrations, and their apply order depends on filesystem sort rather than intent. A timestamp
cannot collide and sorts correctly forever.

Every migration has a real `down`. "We never roll back" is true right up to the deploy where you
must, at which point the alternative is editing production by hand.

Rules that keep a migration safe to run against a live database:

- **Additive first.** Add a nullable column, backfill, then add the constraint — three deploys, not
  one. Adding `NOT NULL` with a default rewrites the table and locks it.
- **Never rename in one step.** Add the new column, write both, migrate readers, drop the old one
  later. A rename is a breaking change to every running instance of the previous version.
- **Index concurrently** (`CREATE INDEX CONCURRENTLY`) on a table with traffic, and outside a
  transaction — Postgres refuses it inside one.
- Test `up` then `down` then `up` locally before it goes near a shared database.

The `changing-data-safely` skill covers running them against production.

## Serverless connection pooling

Postgres has a hard connection limit and every serverless instance wants its own. Point at a pooler
— PgBouncer, Supabase's pooler, Neon's pooled endpoint — never at the direct port. The failure mode
is a working app that dies under exactly the traffic you wanted.

Create the `Kysely` instance once at module scope so it is reused across warm invocations. Building
it per request is a new pool per request.

**Migrations connect directly, not through the pooler** — transaction-mode poolers do not support
the session-level operations DDL needs. Two URLs, and they are not interchangeable.

## Verify

- Run the query and read the SQL Kysely generated (`.compile()`), not just the result.
- `EXPLAIN ANALYZE` anything on a table that will grow. A sequential scan on 200 rows is fine and
  on 200,000 is an outage.
- After a schema change, regenerate types and typecheck — that is what catches the callers.
- Confirm tenancy: run the query as a second org and assert it returns nothing.
