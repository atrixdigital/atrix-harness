---
name: changing-data-safely
description: Plan and apply database schema and data changes without downtime or data loss — expand/contract migrations, reversibility, backfills, and which database you are actually connected to. Use when writing or running a migration, altering a schema, renaming or dropping a column, backfilling data, or before any command that touches a production database.
group: infra
---

# Changing data safely

Schema changes are the least reversible thing most services do. Code rolls back in a minute; a
dropped column does not.

## The governing constraint

**Code and schema deploy at different moments**, so they must be compatible in *both* orders:
old code against new schema, and new code against old schema. Anything else is a deploy-ordering
bug waiting for the one time the rollout is slow.

That gives you expand → migrate → contract, never one destructive step:

| Phase | Ship | Safe because |
|---|---|---|
| **Expand** | Add the new column/table, nullable, with a default. Write to both. | Old code ignores it |
| **Migrate** | Backfill in batches. Switch reads to the new shape. | Both shapes valid |
| **Contract** | Stop writing the old. Then, in a *later* deploy, drop it. | Nothing reads it |

Contract is a separate deploy from migrate. Collapsing them is the most common way this fails.

## Before you write the migration

1. **Confirm which database you are pointed at.** Config precedence bites repeatedly — a migration
   tool loading `.env` while the app runs on `.env.local` will happily migrate the wrong database
   and report success. Print the host before running, every time.
2. **Check the current state**: `migrate status` (or equivalent). A drifted history is a stop, not
   a thing to force through.
3. **Run `atrix_impact`** on the model or type you are changing. The blast radius tells you which
   queries and services move with it.

## Writing it

- **Write the down path**, or state loudly that there is none and why.
- **Additive by default.** Adding is safe; renaming is add + backfill + drop across three deploys.
- **No `NOT NULL` without a default** on a populated table — it locks and it fails.
- **Backfill in batches** with a bounded loop, not one statement over a live table. State the batch
  size and why.
- **Index creation concurrently** where the engine supports it; a plain `CREATE INDEX` takes a
  write lock.

## Running it

Test both directions locally — up, then down, then up again — before proposing anything against a
hosted database.

Never run `migrate dev`, `db push --accept-data-loss`, or `migrate reset` against a shared or
hosted database. These drop and recreate. The safety hook will stop you; do not work around it.

Production runs need an explicit confirmation naming the database. See
[references/production-runbook.md](references/production-runbook.md).

## After

Restart the app if the client is generated from the schema — a stale generated client returns
confident wrong results, and a health check will pass while every query is broken.

Then verify against the data: query the new column, check a row that existed before the backfill
and one created after.
