# SecurityReview Workflow

Focused security review applying CodeQuality + Security lenses with full OWASP Top 10 coverage. Use this when explicitly asked for a security review or when auditing security-sensitive changes.

---

## Pre-flight

Output this status line before proceeding:
```
SOP: pr-review | PR: {owner/repo}#{N} | Lenses: quality,security
```

---

## Procedure

### Step 1: Read PR Context

```bash
gh pr view {N} --repo {owner/repo} --json title,body,labels,headRefName,baseRefName,files
```

- Read the PR description and linked issues
- Identify the security surface: what user-facing or system-boundary code is affected?
- Note any security-related labels or mentions in the description

### Step 2: Read Full Diff

```bash
gh pr diff {N} --repo {owner/repo}
```

- Read every changed file completely
- Pay special attention to:
  - Input handling boundaries (HTTP handlers, CLI parsers, message consumers)
  - Data flow from untrusted sources to sensitive operations
  - Authentication and authorization checkpoints
  - Error messages that might leak internals
  - New dependencies being added

### Step 3: Run CodeQuality Lens

Load `CodeQuality.md` from the skill root and apply its full checklist.

Focus especially on:
- Empty catch blocks (security-critical code must never silently fail)
- Error handling patterns (errors should be logged, not exposed to users)
- Test coverage for security-relevant code paths

Record findings with severity, lens tag `quality`, file/line, finding, and fix.

### Step 4: Run Security Lens (Full OWASP)

Load `Security.md` from the skill root and apply its complete checklist. This is a thorough pass — do not skip sections even if they seem unlikely.

**Work through each OWASP category systematically:**

**A01 - Injection:**
- Trace every user input through the code to its final use
- Check for SQL injection (string interpolation in queries)
- Check for command injection (user input in shell commands)
- Check for template injection (user input in template strings)
- Check for XSS (user input rendered in HTML without escaping)
- Check for LDAP, XPath, header injection where applicable

**A02 - Authentication:**
- Check for authentication bypass (missing auth middleware on new routes)
- Check for weak credential handling (plaintext passwords, weak hashing)
- Check for session fixation or token reuse
- Verify logout actually invalidates sessions

**A03 - Data Exposure:**
- Search for secrets in code (API keys, tokens, passwords)
- Check error messages for internal details (stack traces, DB schema)
- Check for PII in logs (email, IP, names in log statements)
- Verify sensitive data is not in URLs (query params logged by default)

**A04 - Authorization:**
- Check for missing authorization on new endpoints
- Check for privilege escalation (user accessing admin resources)
- Check for IDOR (direct object references without ownership checks)
- Verify role checks are consistent with existing patterns

**A05 - Security Misconfiguration:**
- Check for permissive CORS settings
- Check for missing security headers (CSP, HSTS, X-Frame-Options)
- Check for debug/verbose modes left enabled
- Check for default credentials or configurations

**A06 - Vulnerable Components:**
- Check new dependencies against known vulnerability databases
- Verify dependencies are pinned to specific versions
- Check for unnecessary new dependencies that increase attack surface

**A07 - Input Validation:**
- Check for missing validation at system boundaries
- Check for type coercion issues (string vs number, null handling)
- Check for missing length/size limits on inputs
- Verify validation is server-side, not just client-side

**A08 - Data Integrity:**
- Check for missing CSRF protection on state-changing operations
- Check for deserialization of untrusted data
- Verify webhook/callback signature validation

**A09 - Logging & Monitoring:**
- Check that security events are logged (failed auth, access denied)
- Verify logs don't contain sensitive data
- Check for adequate error handling that doesn't hide security events

**A10 - SSRF:**
- Check for user-controlled URLs in server-side requests
- Verify URL allowlists for outbound requests
- Check for redirect following that could reach internal services

### Step 5: Run Code Duplication Analysis

This step runs **last**, after all other lenses, because it requires comparing the PR against the full repository.

**Scope:** Compare the PR's new and changed code against the **entire repository**, not just the diff.

1. For each new function, class, or significant block introduced by the PR, search the full repository for similar logic:
   ```bash
   # For each new function/pattern, search the repo for similar code
   grep -rn "{key pattern from new code}" --include="*.ts" --include="*.js" --include="*.py" .
   ```

2. Check specifically for security-relevant duplication:
   - **Security logic reimplemented** — Does the PR duplicate existing auth/validation helpers instead of using them?
   - **Error handling pattern duplicated** — Is the same error-handling sequence written inline instead of using a shared helper?
   - **Validation logic repeated** — Are the same validation checks written in multiple handlers?
   - **Re-implemented utilities** — New code that does what an existing function in the repo already does
   - **Within-PR duplication** — The same logic appears in multiple files within the PR itself

3. Apply the DRY knowledge principle: Two functions with similar-looking code that serve **different purposes** and will evolve independently are NOT duplication. Only flag duplication where extraction would reduce bugs or maintenance burden.

Record findings: severity, lens=duplication, file/line, finding, fix (reference the existing code location).

### Step 6: Post Findings

Post all findings as PR comments with `[security]` tags.

**Inline comment for specific findings:**
```bash
gh api repos/{owner}/{repo}/pulls/{N}/comments \
  --method POST \
  --field body="**[{severity}/security]** {finding}

**OWASP:** {category}
**Fix:** {remediation}" \
  --field path="{file_path}" \
  --field commit_id="$(gh pr view {N} --repo {owner/repo} --json headRefOid -q .headRefOid)" \
  --field line={line_number}
```

**Summary comment:**
```bash
gh pr comment {N} --repo {owner/repo} --body "## Security Review Summary

### OWASP Coverage
| Category | Status | Findings |
|----------|--------|----------|
| A01 Injection | {checked/clear/findings} | {count} |
| A02 Authentication | {checked/clear/findings} | {count} |
| A03 Data Exposure | {checked/clear/findings} | {count} |
| A04 Authorization | {checked/clear/findings} | {count} |
| A05 Misconfiguration | {checked/clear/findings} | {count} |
| A06 Vulnerable Components | {checked/clear/findings} | {count} |
| A07 Input Validation | {checked/clear/findings} | {count} |
| A08 Data Integrity | {checked/clear/findings} | {count} |
| A09 Logging | {checked/clear/findings} | {count} |
| A10 SSRF | {checked/clear/findings} | {count} |

### Verdict: {verdict}
{rationale}"
```

### Step 7: Post Verdict

Security reviews use stricter verdict criteria:

- **Approve** if no critical or warning security findings AND no critical quality findings
- **Request changes** if ANY critical security finding OR 2+ warning security findings
- **Comment** if only suggestion-level security findings

```bash
gh pr review {N} --repo {owner/repo} --approve --body "Security review passed. OWASP categories checked, no blocking findings."
# or
gh pr review {N} --repo {owner/repo} --request-changes --body "Security findings require remediation before merge."
# or
gh pr review {N} --repo {owner/repo} --comment --body "Security suggestions noted — non-blocking."
```

---

## Output Format

```
## Security Review: {owner/repo}#{N}

### Lenses Applied
- CodeQuality
- Security (full OWASP Top 10)

### OWASP Scan Results
{Category-by-category results}

### Findings Summary
| Severity | Count | Category |
|----------|-------|----------|
| critical | {n}   | {categories} |
| warning  | {n}   | {categories} |
| suggestion | {n} | {categories} |

### Verdict: {approve/request-changes/comment}
{Brief rationale with security posture assessment}
```
