---
name: secure-coding
description: Write server-side code that resists the abuse patterns that actually occur — missing tenant scope, authorisation assumed from authentication, trusted client input, and secrets in the wrong place. Use when writing or reviewing any endpoint, query, webhook handler, or code that touches auth, user data, money, or file paths.
group: engineering
---

# Secure coding

Ranked by how often they actually appear in real codebases, not by how interesting they are.

## 1. Missing tenant scope — the one that keeps happening

A query filtered by id but not by organisation. It passes every test, works perfectly in
development, and returns other customers' data in production.

```ts
// ✗ works, and leaks
const booking = await db.selectFrom('bookings').where('id', '=', id).executeTakeFirst();

// ✓ scoped to the authenticated actor
const booking = await db.selectFrom('bookings')
  .where('id', '=', id)
  .where('org_id', '=', session.orgId)
  .executeTakeFirst();
```

**Check every query against a multi-tenant table.** Not the new one — every one. If a helper or
middleware can make forgetting impossible, build that instead of relying on review.

Return the same response for "does not exist" and "belongs to someone else". A 404 that is
sometimes a 403 is an enumeration oracle.

## 2. Authorisation is not authentication

Being logged in is not being allowed. Check that *this* actor may act on *this* resource, at the
point of use — not only at the route.

Role checks at the router miss the case where a valid user requests another user's id.

## 3. Never trust a client-supplied identifier

`body.userId`, `body.orgId`, `body.role`, `body.price`, `body.status` — any of these reaching a
query, a charge or a state transition without being re-derived from the session is a vulnerability.

Derive identity and authority from the session. Take only *intent* from the body. Validate the body
with a schema that does not include fields the client has no business setting.

## 4. Secrets

- Never commit them; never log them; never put them in an error response.
- Never in a client bundle — check what your framework's public env prefix actually exposes.
- Scrub the environment before spawning untrusted commands (see the `failure-design` rule).
- Rotate on exposure. A secret that was once in a git history is exposed, even after the commit is
  removed.

## 5. Webhooks and callbacks

Verify the signature, always, in every environment. The usual failure is a check disabled during
local development and never re-enabled.

Treat the payload as untrusted input even after the signature verifies — signature proves origin,
not that the values are sane. Handle replay: webhooks are at-least-once.

## Then trace it

Two passes catch most of the rest — see [references/tracing.md](references/tracing.md):

- **Untrusted input outward**, from the edge to every sink: database, shell, filesystem, HTTP,
  template, response.
- **Sensitive data outward**, from the table to every exit: responses, logs, error messages,
  analytics, third-party calls.

## Never weaken a control to make something pass

Not a test, not a lint rule, not a type. If a control is in the way, it is either wrong — fix it
properly — or it is right and you have found a real problem.
