# Production migration runbook

## Contents

- Before you begin
- The sequence
- If it goes wrong
- Things that look safe and are not

## Before you begin

- [ ] The migration ran up **and** down cleanly against a local copy with realistic data volume.
- [ ] You have said out loud which database this targets, and a human has said yes to that name.
- [ ] You know the rollback: either the down migration, or the fact that there isn't one.
- [ ] A backup or point-in-time recovery window exists and you have confirmed it, not assumed it.
- [ ] The change is expand-phase only. Contract goes in a later deploy.

## The sequence

1. **Print the target.** Host and database name, echoed before anything runs.
2. **Check status.** Pending migrations should be exactly the ones you expect. Drift is a stop.
3. **Dry run** if the tool supports it, or run the generated SQL through an explain.
4. **Apply.** One migration at a time on anything non-trivial.
5. **Verify against data**, not against the tool's exit code — query the new shape, check a
   pre-existing row and a newly written one.
6. **Watch errors** for the next few minutes. A schema change that breaks one endpoint often
   surfaces as a single loud stack trace, not a global outage.

## If it goes wrong

Stop before the second command. A half-applied migration plus a panicked second attempt is worse
than a half-applied migration.

- **Migration failed partway** — check whether the engine ran it in a transaction. If it did, you
  are back where you started. If not, you must reconcile by hand: read the migration, determine
  which statements applied.
- **Migration applied, app is broken** — roll back the *code* first. Expand-phase schema is
  backward compatible, so old code should run against it. That is what expand/contract buys you.
- **Data looks wrong** — stop writes before investigating if you can. Every minute of continued
  writes on a bad shape is more to reconcile.

## Things that look safe and are not

| Looks safe | Actually |
|---|---|
| `ALTER TABLE … ADD COLUMN … NOT NULL` | Rewrites the table, takes a lock, fails on existing rows |
| `CREATE INDEX` | Write lock for the duration on most engines — use the concurrent form |
| Renaming a column | Breaks every running instance of the old code instantly |
| A single-statement backfill | Long transaction, lock escalation, replication lag |
| `DROP COLUMN` after deploying code that stopped reading it | Only safe once *no* running instance reads it — that is the next deploy, not this one |
| Running the migration from a laptop | Fine until the connection drops mid-statement |
