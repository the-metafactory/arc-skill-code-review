# Hardening Lens

**Activated when:** PR touches API endpoints, middleware, Worker code, or server-side request handling. Always applied in HardeningReview workflows. Examines whether defensive infrastructure patterns are in place — not whether code is exploitable (that's the Security lens), but whether the operational defenses are implemented.

---

## Checklist

### H-01: Authentication Layer

- [ ] **Network-layer auth present.** API endpoints behind authentication (CF Access, OAuth, API key, session). No unauthenticated routes unless explicitly public.
- [ ] **JWT validation is strict.** If using JWTs: signature verification (RS256/ES256, not HS256 with shared secrets), audience check, expiration check, rejection of tokens without `exp`.
- [ ] **JWK/cert caching.** If fetching signing keys remotely: cache with TTL (5-15 min), not fetched on every request.
- [ ] **Auth success logged.** Successful authentication creates an audit event — not just failures. You need to know who accessed the system, not just who was rejected.
- [ ] **No shared secrets for identity.** Individual identities (email, user ID) in auth — not a single shared `ADMIN_SECRET` that makes all admins indistinguishable.

### H-02: CORS Configuration

- [ ] **Origin allowlist present.** CORS not set to `*` for authenticated APIs. Origins are explicitly listed.
- [ ] **Env-configurable origins.** Allowlist configurable via environment variables — not hardcoded for a single deployment.
- [ ] **Credentials flag consistent.** If `credentials: true`, origins must be explicit (not `*`).
- [ ] **Local dev origins included.** Localhost origins for development but only when appropriate (not leaked to production config).

### H-03: Rate Limiting

- [ ] **Rate limiter present.** API endpoints have rate limiting — at minimum on write operations and auth endpoints.
- [ ] **Tiered limits.** Different limits for different operation types (e.g., public/read/write/admin). Admin operations should have the strictest limits.
- [ ] **Persistent counters.** Rate limit state survives process/isolate restarts. In-memory counters reset on deploy and are ineffective under load.
- [ ] **Client identification.** Rate limiting keyed on a stable client identifier (IP from `CF-Connecting-IP`/`X-Forwarded-For`, API key, user ID) — not just source IP which can be shared.
- [ ] **Standard response headers.** 429 responses include `Retry-After`. Responses include `X-RateLimit-*` headers for client visibility.

### H-04: Input Validation at Boundaries

- [ ] **Parameterized queries.** All database queries use parameterized statements / prepared statements. No string concatenation or interpolation with user input in SQL.
- [ ] **JSON parse with error handling.** `req.json()` or `JSON.parse()` wrapped in try/catch or `.catch()`. Malformed JSON returns 400, not 500.
- [ ] **Enum fields validated.** Fields with a fixed set of valid values (roles, scopes, statuses) validated against an explicit allowlist.
- [ ] **Datetime fields validated.** Date/time strings validated as parseable before storage. Invalid datetime strings corrupt comparison operations in SQL.
- [ ] **String length limits.** Text inputs have maximum length constraints. Unbounded strings enable storage abuse.
- [ ] **Boundary checks on numeric inputs.** Pagination limits capped, counts bounded, IDs validated for expected format.

### H-05: Audit Logging

- [ ] **Auth events logged.** Both successful and failed authentication attempts generate audit events with IP, endpoint, method, identity, and timestamp.
- [ ] **Authorization failures logged.** 403 responses from role checks, ownership checks, and access control generate audit events. These are exactly the events security forensics needs.
- [ ] **Mutation operations logged.** All state-changing operations (create, update, delete) generate audit events identifying who did what.
- [ ] **Fire-and-forget writes.** Audit log writes don't block the request — use `waitUntil()` or non-awaited promises with `.catch()`. A failed audit write must not cause a 500.
- [ ] **Consistent event schema.** Audit events use consistent field names across all endpoints (`event_type`, not a mix of `action`/`eventType`/`type`). A canonical taxonomy is defined or discoverable.

### H-06: PII Handling

- [ ] **PII policy documented or evident.** Clear decision on whether PII (emails, IPs, names) is stored in logs/audit tables. Either scrub it or document the retention policy.
- [ ] **No PII in error responses.** Error responses to clients don't echo back email addresses, internal user IDs, or other identifying information that the client didn't already provide.
- [ ] **Scrubbing applied at ingest.** If PII scrubbing is policy, it's applied before storage — not after-the-fact. Regex-based scrubbing for: API keys, Bearer tokens, emails, file paths with usernames, IP addresses.

### H-07: API Key Lifecycle

- [ ] **Key metadata tracked.** API keys have `issued_by`, `issued_at`, `name/description`. Audit logs can trace "who created this key" and "when."
- [ ] **Key format includes prefix.** Key strings have a recognizable prefix (e.g., `sk_`, `grove_sk_`) for identification in logs and leak scanning.
- [ ] **Keys validated against persistent store.** Key validation checks a persistent store (KV, D1) — not an in-memory list that requires restart to revoke.

### H-08: Webhook / Callback Verification

- [ ] **Signature validation present.** Incoming webhooks verify HMAC signature (e.g., `x-hub-signature-256` for GitHub). Unsigned requests rejected with 401.
- [ ] **Constant-time comparison.** Signature comparison uses `timingSafeEqual` or equivalent — not `===` which is vulnerable to timing attacks.

---

## Severity Guide

| Finding | Severity |
|---------|----------|
| No authentication on API endpoint | **critical** |
| Shared secret as sole admin identity | **critical** |
| No rate limiting on write/auth endpoints | **warning** |
| In-memory rate limiting only (resets on deploy) | **warning** |
| Auth success not logged (forensic blind spot) | **warning** |
| Authorization failures not audited | **warning** |
| PII in error responses | **warning** |
| No datetime validation on temporal fields | **warning** |
| Missing string length limits | **suggestion** |
| CORS allowlist not env-configurable | **suggestion** |
| Audit event schema inconsistent across endpoints | **suggestion** |
| API key lacks issuer metadata | **suggestion** |
| Missing `Retry-After` on 429 | **nit** |
