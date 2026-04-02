# Security Lens

**Activated when:** PR touches user input handling, authentication, authorization, API endpoints, database queries, file operations, or external service calls. Always applied in SecurityReview and FullReview workflows.

Based on the OWASP Top 10 (2021) adapted for the metafactory ecosystem (primarily TypeScript/Bun backend services, Cloudflare Workers, Discord bots).

---

## Checklist

### A01: Injection

- [ ] **SQL injection.** Check all database queries for string interpolation or concatenation with user input. Must use parameterized queries or prepared statements.
  ```typescript
  // BAD: sql`SELECT * FROM users WHERE id = ${userInput}`  (if raw string)
  // GOOD: db.query("SELECT * FROM users WHERE id = ?", [userInput])
  ```
- [ ] **Command injection.** Check for user input passed to shell commands (`exec`, `spawn`, `Bun.$`, child_process). Must sanitize or use argument arrays (not string interpolation).
  ```typescript
  // BAD: Bun.$`git log --author=${userInput}`
  // GOOD: execFile("git", ["log", "--author", userInput])
  ```
- [ ] **Template injection.** Check for user input in template literals that are evaluated as code or rendered as HTML.
- [ ] **XSS (Cross-Site Scripting).** Check for user input rendered in HTML without escaping. Applies to any HTML-generating code, dashboard templates, or error pages.
- [ ] **Header injection.** Check for user input in HTTP response headers (CRLF injection). Especially `Location`, `Set-Cookie` headers.
- [ ] **Log injection.** Check for user input written directly to logs without sanitization (can forge log entries or inject control characters).

### A02: Broken Authentication

- [ ] **Missing auth middleware.** New API routes must have authentication middleware unless explicitly public. Check that new routes aren't accidentally unprotected.
- [ ] **Weak credential handling.** Passwords must be hashed with bcrypt/argon2 (not MD5/SHA). Tokens must have sufficient entropy.
- [ ] **Session management.** Sessions must expire. Logout must invalidate the session server-side (not just delete the client cookie).
- [ ] **Token exposure.** Auth tokens must not appear in URLs, logs, or error messages.
- [ ] **Timing attacks.** Credential comparison must use constant-time comparison (not `===` for secrets).

### A03: Sensitive Data Exposure

- [ ] **Secrets in code.** Search for hardcoded API keys, tokens, passwords, connection strings. Must use environment variables.
- [ ] **Verbose error messages.** Error responses to clients must not include stack traces, internal file paths, database schemas, or configuration details.
- [ ] **PII in logs.** Log statements must not include email addresses, passwords, tokens, IP addresses (unless the logging system is specifically designed for access logs with retention policies).
- [ ] **Sensitive data in URLs.** Tokens, passwords, and PII must not be in query parameters (they appear in server logs, browser history, and referrer headers).
- [ ] **Missing encryption.** Sensitive data at rest must be encrypted. Sensitive data in transit must use TLS.

### A04: Broken Access Control

- [ ] **Missing authorization checks.** After authentication, check that the user is authorized for the specific resource/action. Auth != authz.
- [ ] **IDOR (Insecure Direct Object References).** Check that accessing resources by ID includes ownership/permission verification. `GET /api/users/:id/documents/:docId` must verify the user owns the document.
- [ ] **Privilege escalation.** Check that role-based operations verify the user's role. A regular user should not be able to call admin endpoints.
- [ ] **Path traversal.** File operations with user-supplied paths must normalize and validate the path stays within allowed directories.
- [ ] **Horizontal access.** Users must not be able to access other users' data by manipulating identifiers.

### A05: Security Misconfiguration

- [ ] **CORS policy.** `Access-Control-Allow-Origin: *` is almost never correct for authenticated APIs. Check for overly permissive CORS.
- [ ] **Security headers.** New HTTP servers/endpoints should include: `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security`.
- [ ] **Debug mode.** Production code must not have debug flags, verbose logging of request bodies, or development-only middleware.
- [ ] **Default configurations.** Check for default ports, default credentials, or default secrets that should be configured per-environment.
- [ ] **Directory listing.** Static file servers must not expose directory listings.

### A06: Vulnerable and Outdated Components

- [ ] **Known vulnerabilities.** New dependencies should be checked against `npm audit` / `bun audit` or CVE databases.
- [ ] **Pinned versions.** Dependencies should use exact versions (not `^` or `~` ranges) for reproducible builds.
- [ ] **Unnecessary dependencies.** New dependencies must be justified. Check if the functionality can be achieved with built-in APIs (especially for Bun which has many built-ins).
- [ ] **Outdated dependencies.** Major version updates in PR should be verified for breaking changes and security fixes.

### A07: Input Validation

- [ ] **System boundary validation.** Every input from external sources (HTTP requests, WebSocket messages, CLI arguments, file contents, environment variables) must be validated.
- [ ] **Type validation.** Don't trust that `req.body.count` is a number just because your TypeScript type says so. Validate at runtime for external input.
- [ ] **Length/size limits.** String inputs should have maximum length. Array inputs should have maximum count. File uploads should have maximum size.
- [ ] **Format validation.** Email addresses, URLs, dates, and other structured inputs should be validated against expected format.
- [ ] **Allowlisting over denylisting.** Validate that input matches expected patterns rather than trying to block known-bad patterns.

### A08: Software and Data Integrity Failures

- [ ] **CSRF protection.** State-changing operations (POST, PUT, DELETE) on web-facing APIs must have CSRF tokens or use SameSite cookies.
- [ ] **Unsafe deserialization.** Never deserialize untrusted data with `eval()`, `Function()`, or `JSON.parse()` of user input that's then used as code. `JSON.parse()` for data is fine.
- [ ] **Webhook verification.** Incoming webhooks must verify signatures (e.g., GitHub webhook secret, Stripe signatures).
- [ ] **CI/CD integrity.** Pipeline configuration changes should be reviewed for injected commands or exfiltration.

### A09: Security Logging and Monitoring Failures

- [ ] **Security events logged.** Failed authentication attempts, authorization failures, and input validation failures should generate log entries.
- [ ] **No sensitive data in security logs.** Log the event, the user (by ID, not PII), and the action — not the credentials that failed.
- [ ] **Alertable events.** Critical security events (multiple failed logins, admin actions) should be detectable from logs.

### A10: Server-Side Request Forgery (SSRF)

- [ ] **User-controlled URLs.** If the application makes HTTP requests based on user-supplied URLs, validate the URL against an allowlist.
- [ ] **Internal network access.** Server-side requests must not be directed to internal/private IP ranges by user input (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16).
- [ ] **Redirect following.** If following redirects, ensure redirects don't lead to internal services.
- [ ] **DNS rebinding.** Validate the resolved IP, not just the hostname, for high-security applications.

---

## Severity Guide

| Finding | Severity |
|---------|----------|
| SQL/command injection with user input | **critical** |
| Missing auth on new endpoint | **critical** |
| Secrets hardcoded in source | **critical** |
| IDOR without ownership check | **critical** |
| Missing input validation at boundary | **warning** |
| PII in log statements | **warning** |
| Overly permissive CORS | **warning** |
| Missing security headers | **suggestion** |
| Dependency not pinned to exact version | **suggestion** |
| Missing CSRF on internal-only endpoint | **nit** |
