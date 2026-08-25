---
name: caching-with-redis
description: >
  Add Redis caching that speeds things up without serving stale or leaked data — cache-aside,
  key namespacing, TTLs, invalidation on write, and stampede protection. Use when a page or
  endpoint is slow, when adding caching or rate limiting, when choosing between Redis and
  framework caching, or when investigating stale, wrong or cross-tenant cached data.
group: infra
---

# Caching with Redis

## Cache last

A cache makes a fast thing cheaper; it makes a slow thing intermittently fast and permanently
harder to debug. Before adding one, check the query has an index and the endpoint is not N+1 —
most "we need caching" is a missing index, and caching it hides the bug at the cost of stale data.

Cache when the work is genuinely expensive **and** the data tolerates being slightly old. Write
down which of those you are trading.

## One module, one interface

```ts
// src/lib/cache.ts
export async function cached<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  const hit = await redis.get(key);
  if (hit) return JSON.parse(hit) as T;

  const value = await fn();
  await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  return value;
}
```

Every call site goes through it. Scattered `redis.get`/`set` pairs mean the TTL, the serialisation
and the key format are decided independently in fifteen places, and no one can answer what is
cached or how to clear it.

**Client choice follows the runtime**, and it is the same interface either way:

| Runtime | Client | Why |
|---|---|---|
| Vercel / serverless | `@upstash/redis` | REST — no connection to pool across cold starts |
| Long-lived Node/Bun process, worker | `ioredis` | Persistent connection, pipelining, pub/sub |

A TCP client in a serverless function opens a connection per invocation and exhausts the server —
the same failure shape as unpooled Postgres.

## Keys

Namespaced, versioned, and carrying **every input that changes the answer**:

```
v1:venue:list:org=<orgId>:page=2
```

- **The tenant goes in the key.** A key missing `orgId` serves one customer's data to another —
  this is the most damaging cache bug there is, and it looks like a performance win until someone
  reports seeing a stranger's booking.
- Same for locale, currency and role. If it changes the response, it is in the key.
- **Never cache a per-user response under a shared key.** If it varies by session, either key it by
  user or do not cache it.
- Bump the `v1` prefix when the shape changes. It is an instant, safe invalidation of everything
  old, and far more reliable than remembering to flush.

## TTLs and invalidation

**Every key gets a TTL. No exceptions.** A key without one lives until someone notices, and the
stale value outlives the bug that produced it.

- Seconds for lists and dashboards; minutes for reference data; never for anything a user just
  changed.
- **Invalidate on write.** The mutation that changes a venue deletes `v1:venue:*` for that venue,
  in the same code path. Invalidation that lives anywhere else gets forgotten.
- Delete rather than update. Writing the new value into the cache from the mutation means the cache
  and the database can disagree if the transaction rolls back.

Never cache: auth tokens, permissions, payment state, anything you would not want to be five
minutes wrong about.

## Stampedes

When a hot key expires, every concurrent request misses at once and they all run the expensive
query together — usually at peak traffic, which is when the key was hot.

Two defences, in order of effort: **jitter the TTL** (`ttl + random(0, ttl * 0.1)`) so keys do not
expire in lockstep, and for genuinely expensive work, take a short lock (`SET key NX EX 10`) so one
request recomputes while the others serve the stale value or wait.

## Redis is not a database

It can lose data — eviction under memory pressure, a failover, a restart. **Every read must work
when the cache is empty**, and the code path that does so is the normal one, not a fallback.

A cache outage should be slow, not broken: wrap Redis calls so a connection failure falls through
to the source rather than throwing. `cached()` above is where that belongs, once, rather than in
every caller.

## Next.js: which cache

Redis is not the first tool for page data. `revalidate` and `revalidateTag` cache rendered output
at the CDN, which is faster and free — see `seo-and-analytics` for the traps in getting a route
cacheable at all.

Reach for Redis when the state is **shared between processes**: rate limits, sessions, job
coordination, cross-request locks, or a computation too expensive for any single request to do. A
worker and a web process cannot share an in-memory map; that is the line.

## Verify

- Measure before and after with the cache **cold**, then warm. A benchmark run twice measures the
  cache, not the change.
- Flush the cache under load and confirm the app degrades in latency, not in correctness.
- Assert tenancy: request as org A, then org B, and confirm B never sees A's payload.
- Change the underlying record and confirm the cached response updates when it should — this is
  where missing invalidation shows up, and only if you look.
