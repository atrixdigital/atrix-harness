---
name: failure-design
description: How code should fail — reporting outcomes honestly, honouring contracts, and cleaning up completely.
source: research-dsh-defensive-patterns
applies: [**]
expires_when: never — this is language- and model-independent
---

Most production defects are not wrong logic. They are correct logic reporting or cleaning up
badly, so a caller believes something that is not true.

## Report independent outcomes independently

A result can be several things at once. A process can time out **and** exit 0, because it trapped
the signal. Surface each fact on its own — `timedOut`, `signal`, `exitCode` — and never nest one
flag's report inside another's branch.

```ts
// ✗ a cut-short run reads as a clean success
if (!timedOut) return { ok: exitCode === 0 };

// ✓ the caller decides what the combination means
return { timedOut, signal, exitCode };
```

## Honour the contract on both sides

When an implementation can express one outcome several ways — throwing, or returning an error
value — **normalise before it crosses the public boundary**. Otherwise every caller has to guess
whether a caught exception came from the provider, a wrapper, or its own code.

Pick one shape per boundary, document it where the type is defined, and exercise every source form
through the real consumer.

## Never swallow an error silently

`catch {}` with no handling is a decision to lose information. If a failure is genuinely
acceptable, say so in a comment with the reason. If it is not, propagate it — with enough context
to act on, and without leaking internals to an untrusted caller.

Failing loudly at the boundary beats failing quietly three layers down.

## Cleanup must reach quiescence, not just request it

Teardown that issues kills or aborts and returns before the work stops leaves orphans. Await the
children's exit, and **close listener registries before killing** so late completions stay silent.

The same applies to anything holding a resource: a connection pool, a watcher, a subscription, a
timer. "I called `.close()`" is not "it is closed".

## Contain callback exceptions in the dispatcher

A listener that throws must not reject the promise it runs inside or starve the listeners after
it. Wrap the dispatch loop, log, continue. One bad subscriber never breaks a lifecycle.

## Async state is not synchronous state

Firing an async operation gives you no per-call completion. Several queued items can share one
"running" interval; cancellation can discard unstarted work. If a caller genuinely owns a run, it
must define its own interval explicitly rather than reading a shared status flag.

And handle the branch where the awaited transition **can never occur** — otherwise the wait hangs
forever, which is worse than an error.

## Never hand untrusted execution the ambient environment

Spawned commands get a scrubbed environment — drop anything matching `*KEY*`, `*SECRET*`,
`*TOKEN*`, `*PASSWORD*` — so credentials cannot leak into output or spill files. Temporary files
go in a private directory with random names and owner-only permissions; predictable world-readable
paths invite symlink races.
