# Performance Lens

**Activated when:** PR touches database queries, data processing loops, API response handlers, hot path code, caching, or resource management. Always applied in FullReview workflow.

---

## Checklist

### 1. N+1 Query Patterns

- [ ] **No loops with database queries inside.** Fetching a list and then querying for each item's related data is an N+1 pattern. Use JOINs, IN clauses, or batch queries.
  ```typescript
  // BAD: N+1
  const users = await db.query("SELECT * FROM users");
  for (const user of users) {
    user.posts = await db.query("SELECT * FROM posts WHERE user_id = ?", [user.id]);
  }

  // GOOD: batch query
  const users = await db.query("SELECT * FROM users");
  const userIds = users.map(u => u.id);
  const posts = await db.query("SELECT * FROM posts WHERE user_id IN (?)", [userIds]);
  ```
- [ ] **ORM eager loading.** If using an ORM, ensure relations are eager-loaded when known to be needed, not lazy-loaded inside loops.
- [ ] **GraphQL N+1.** If using GraphQL resolvers, check that DataLoader or equivalent batching is used for nested resolvers.

### 2. Unbounded Operations

- [ ] **No unbounded loops.** Every loop must have a bounded iteration count. `while (true)` must have a break condition that's guaranteed to trigger.
- [ ] **No unbounded recursion.** Recursive functions must have a maximum depth or provable termination.
- [ ] **No unbounded collections.** Data structures that grow without bound (caches without eviction, arrays that only push/never trim) are memory leaks.
- [ ] **No unbounded concurrency.** Don't `Promise.all()` an arbitrary-length array of heavy operations. Use a concurrency limiter (batch processing, semaphore, or queue).
  ```typescript
  // BAD: could spawn thousands of parallel requests
  await Promise.all(urls.map(url => fetch(url)));

  // GOOD: bounded concurrency
  const BATCH_SIZE = 10;
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    await Promise.all(urls.slice(i, i + BATCH_SIZE).map(url => fetch(url)));
  }
  ```

### 3. Pagination

- [ ] **List endpoints are paginated.** Any API endpoint that returns a list must support pagination (limit/offset, cursor, or page-based).
- [ ] **Default page size is reasonable.** Default limits should be set (e.g., 50-100 items). No endpoint should default to returning all records.
- [ ] **Database queries have LIMIT.** SELECT queries for lists should always have a LIMIT clause, even if the API layer also paginates.
- [ ] **Total count queries are separate.** If providing total count for pagination, it should be a separate optimized COUNT query, not `SELECT *` followed by `.length`.

### 4. Memory Management

- [ ] **Resources are cleaned up.** File handles, database connections, streams, WebSocket connections, and event listeners must be closed/removed when no longer needed.
- [ ] **No growing caches without eviction.** In-memory caches must have a maximum size and eviction policy (LRU, TTL, or both).
- [ ] **Large data processed in streams.** Don't read entire large files into memory. Use streaming reads/writes for files over ~10MB.
- [ ] **No unnecessary data copying.** Avoid creating full copies of large arrays/objects when a view, slice, or reference would suffice.
- [ ] **Event listeners are removed.** `addEventListener`/`on` calls should have corresponding `removeEventListener`/`off` calls, especially in components that mount/unmount.
- [ ] **Timers are cleared.** `setInterval` and `setTimeout` should have corresponding `clearInterval`/`clearTimeout` in cleanup paths.

### 5. Blocking Operations in Async Contexts

- [ ] **No synchronous file I/O in request handlers.** `readFileSync`, `writeFileSync`, `existsSync` in hot paths block the event loop. Use async equivalents.
- [ ] **No CPU-intensive operations on the main thread.** Heavy computation (parsing large files, image processing, cryptographic operations on large data) should be offloaded to workers.
- [ ] **No `JSON.parse()` on unbounded input in hot paths.** Parsing very large JSON strings blocks the event loop. Validate size first or use streaming parsers.
- [ ] **No synchronous crypto in request handlers.** `crypto.pbkdf2Sync`, `crypto.scryptSync`, etc. block. Use async versions.

### 6. Network and I/O Efficiency

- [ ] **No redundant network calls.** Don't fetch the same data multiple times in a single request/operation. Cache or pass the result.
- [ ] **Connection pooling.** Database and HTTP connections should use connection pools, not create new connections per request.
- [ ] **Appropriate timeouts.** External service calls should have timeouts. Without timeouts, a slow upstream can exhaust connection pools.
- [ ] **Batch where possible.** Multiple small writes can often be batched into one operation (bulk insert, batch API calls).
- [ ] **Compression for large payloads.** API responses over ~1KB should support gzip/brotli compression.

### 7. Algorithm Efficiency

- [ ] **No O(n^2) or worse on large collections.** Nested loops over the same or related collections are suspicious. Consider hash maps, sets, or sorting for O(n log n) alternatives.
- [ ] **Appropriate data structures.** Use Set for membership checks (O(1) vs O(n) for array.includes). Use Map for key-value lookups. Use sorted arrays for range queries.
- [ ] **Early exit when possible.** If searching for a single item, break/return when found — don't continue iterating.
- [ ] **No unnecessary sorting.** Don't sort if you only need min/max (use a single pass). Don't sort if the consumer doesn't need ordered results.

### 8. Caching

- [ ] **Cache invalidation is handled.** If caching is added, there must be a clear invalidation strategy. Stale caches cause bugs.
- [ ] **TTL is set.** Time-based caches must have a TTL. Indefinite caches are memory leaks in disguise.
- [ ] **Cache keys are correct.** Cache keys must include all parameters that affect the cached value. Missing a parameter leads to incorrect cache hits.
- [ ] **Thundering herd prevention.** If many requests can miss the cache simultaneously, consider lock/singleflight patterns to prevent all of them from recomputing.

---

## Severity Guide

| Finding | Severity |
|---------|----------|
| N+1 query in a loop processing user-facing data | **critical** |
| Unbounded collection without eviction | **critical** |
| Missing pagination on list endpoint | **warning** |
| Synchronous I/O in request handler | **warning** |
| O(n^2) algorithm on potentially large data | **warning** |
| Missing timeout on external call | **suggestion** |
| Cache without TTL on non-critical data | **suggestion** |
| Minor optimization opportunity | **nit** |
