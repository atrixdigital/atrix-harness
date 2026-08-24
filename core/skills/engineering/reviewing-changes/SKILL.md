---
name: reviewing-changes
description: Review a diff for correctness, reuse and simplification, with findings that are concrete enough to act on. Use before committing or opening a PR, when asked to review code, or when checking someone else's changes.
group: engineering
---

# Reviewing changes

Review the change, not the codebase. Stay inside the diff and its blast radius.

## Order of attention

1. **Correctness at the edges.** Off-by-one, null and empty, timezone and midnight boundaries,
   concurrent callers, the second click, partial failure. The middle of a function is rarely where
   bugs live.
2. **Money, auth, data loss.** Any diff touching these gets a second pass: rounding, currency,
   permission checks, tenant scope, cascade deletes, migrations that drop.
3. **Reuse.** Does this reimplement something that exists? **Run the search before assuming it
   does not** — this is the single most common finding, and the most common one missed.
4. **Simplification.** Fewer branches, fewer states, less indirection for the same behaviour.
5. **Consistency.** Does it read like its neighbours?

## Verify before you report

**Trace the failing path concretely before calling something a bug.** State the inputs and the
resulting wrong output.

A finding you cannot make concrete is a question. Label it as one, or drop it — a review padded
with maybes gets skimmed, and then the real finding gets skimmed too.

Run the tests. A review that executed nothing is a reading, and should say so.

## Use the graph

`atrix_impact` on anything the diff changes that others call. A surprising blast radius is itself
a finding: it means the change is wider than the author thinks.

## Output

```
BLOCKING
  path/to/file.ts:120  <the defect in one sentence>
    fails when: <concrete inputs → wrong output>

NON-BLOCKING
  path/to/file.ts:44   <the cleanup, one sentence>

QUESTIONS
  <what you could not resolve by reading>
```

Most severe first. **A clean review is a real result** — say "no blocking findings" rather than
manufacturing something to look thorough.

## Do not

- Rewrite the code. Report; the author fixes. You do not have their context.
- Comment on style the linter already enforces.
- Widen into unrelated parts of the repo, however tempting.
- Review your own work and call it reviewed. Self-review catches typos, not design errors.
