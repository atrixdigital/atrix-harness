---
name: designing-apis
description: Design HTTP endpoints and module interfaces that stay usable as they change — resource shape, error contracts, pagination, idempotency, and versioning. Use when adding or changing an endpoint, defining a service boundary, designing a public function signature, or deciding how a client should talk to a service.
group: engineering
---

# Designing APIs

The cost of an interface is paid by everyone who calls it, forever. Spend the extra ten minutes.

## Find the sibling first

Open the two most recently added endpoints in this repo. The newest reflects the current
convention; the oldest reflects one the team has moved off. Match the newest — layout, validation
placement, error shape, status codes, pagination style, test structure.

**A technically better pattern that looks foreign is worse than a consistent one.** If the siblings
disagree with each other, that disagreement is worth an `atrix learn`.

## Shape

- **Name resources as nouns, actions as verbs on them.** `POST /bookings/:id/cancel` beats
  `POST /cancelBooking`. Consistency matters more than REST purity.
- **Return the thing you changed.** A mutation that returns `{ ok: true }` forces a second request.
- **Flat over deeply nested.** Nesting is a schema decision you cannot undo cheaply.
- **Take intent from the client, derive authority from the session.** Never accept `orgId`,
  `userId`, `role` or `price` from a request body.

## Errors are part of the contract

Design them, do not let them happen. A caller must be able to act on a failure programmatically:

```json
{ "code": "booking_slot_taken",
  "message": "That slot is no longer available",
  "fields": { "startsAt": "already booked" } }
```

- **A stable machine-readable `code`** — this is the part clients branch on, so it is as much a
  contract as the success shape. Never change one without versioning.
- **Field-level detail** when the failure was per-field, so a form can render it inline.
- **Never leak internals** — no stack traces, no SQL, no upstream provider messages.
- Correct status codes: 400 malformed, 401 unauthenticated, 403 unauthorised, 404 not found *or*
  not yours, 409 conflict, 422 semantically invalid, 429 rate limited.

## Anything that charges, sends or appends needs idempotency

Clients retry — on timeout, on flaky networks, on a user double-clicking. Assume every request
arrives twice.

Accept an idempotency key, store it with the result, and return the original result on replay.
Without this, a retry is a duplicate charge.

## Pagination

Cursor-based for anything that changes while being read; offset only for static datasets. Return
the cursor explicitly and **verify the loop actually terminates** — a cursor that returns null
mid-stream silently drops data and looks fast while doing it.

Never return an unbounded collection. Fine at 100 rows, fatal at 100,000.

## Versioning

The rule: **additive changes are free; anything else is a new version.**

- Free: adding an optional field, adding an endpoint, adding an enum value clients can ignore.
- Breaking: removing or renaming a field, tightening validation, changing a type, changing an error
  `code`, making an optional field required.

Adding a required field to an existing request is breaking, even though it feels additive.

## Module interfaces follow the same rules

A function signature is an API with the same properties: name for the caller not the
implementation, validate at the boundary and trust inside it, one clear failure shape, and
additive-only evolution once anything else imports it.

Run `atrix_impact` before changing one — the blast radius tells you whether this is a rename or a
migration.
