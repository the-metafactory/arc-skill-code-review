# SecurityReview Workflow

Focused security review applying CodeQuality + Security + Confidentiality lenses with full OWASP Top 10 coverage. Use this when explicitly asked for a security review or when auditing security-sensitive changes. Confidentiality is part of the fixed lens set here (like FullReview) — it is not optional in a security review of an exposed repo.

---

## Pre-flight

First determine repo exposure (fail CLOSED — see `Confidentiality.md` → "Exposure detection"):

```bash
gh repo view {owner}/{repo} --json visibility --jq '.visibility'
# PUBLIC ⇒ exposed. error / rate-limit / timeout / empty / unknown ⇒ treat as EXPOSED.
# arc-shipped (arc-manifest*.yaml at repo root) ⇒ EXPOSED even if private.
```

Then output this status line before proceeding:
```
SOP: pr-review | PR: {owner/repo}#{N} | Lenses: quality,security,confidentiality | exposure={public|arc-shipped|unknown-treated-as-exposed|private} | confidentiality={active|n/a-private}
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

### Step 5: Run Confidentiality Lens

Load `Confidentiality.md` from the skill root.

- If the repo is **not exposed** (confirmed private and not arc-shipped), record `confidentiality=n/a-private` and skip to Step 6.
- If the repo is **exposed** (public, arc-shipped, or unknown-treated-as-exposed), apply the full C1–C6 checklist regardless of which files the PR touched.
- **Rule 0 (never-quote) applies:** cite category + `file:line` only, never the suspected literal — not in the comment, the summary, or the verdict block. Route "is this a real party?" questions to the private control plane, never a public PR comment.

Record findings: severity, lens=confidentiality, file/line, category (C1–C6), finding (never the literal), fix.

### Step 6: Run Code Duplication Analysis

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

### Step 7: Post Findings

Post all findings as PR comments with `[security]` tags. Confidentiality findings are tagged `[confidentiality]` and obey Rule 0 (category + `file:line` only, never the literal).

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
| Confidentiality (C1–C6) | {active/n-a-private/findings} | {count} |

### Verdict: {verdict}
{rationale}"
```

### Step 8: Post Verdict

Determine the verdict from the findings, per the single normative source
(compass `sops/pr-review.md` → "Severity → Verdict") — the same mapping
`FullReview.md#step-13-submit-review` renders in full:

- `critical` → **blocker**, `warning` → **major**, `suggestion`/`nit` → **nit**.
- `blockers > 0` OR `majors > 0` ⇒ **`changes-requested`** (recommend: request-changes).
- only nits (no blockers, no majors) ⇒ **`commented`** (recommend: comment) — nit-only reviews do NOT block; the PR stays mergeable.
- zero findings ⇒ **`approved`** (recommend: merge).
- **Confidentiality criticals are never waivable.** A confidentiality critical (C1–C6) is severity-`critical` → a blocker → forces `changes-requested`, exempt from any rule that would otherwise soften a verdict; it closes only by removal of the content or a linked principal-comment URL authorising the exception — never by a justification, never by quoting the value to argue it is safe.

Use the canonical verdict-submission pattern from
`FullReview.md#step-13-submit-review` — single body, exactly one of the
three blocks issued:

```bash
VERDICT_BODY="$(cat <<'EOF'
Security review — OWASP categories checked. {N} findings.

verdict: blockers={N} majors={N} nits={N} — recommend: {merge|comment|request-changes}
EOF
)"

ERR=$(mktemp -t cr-verdict-err.XXXXXX)
trap 'rm -f "$ERR"' EXIT
```

**`changes-requested` case** (`blockers > 0` OR `majors > 0`):

```bash
if ! gh pr review {N} --repo {owner/repo} --request-changes --body "$VERDICT_BODY" 2>"$ERR"; then
  if grep -qE "(Cannot|Can not) request changes on your own pull request" "$ERR"; then
    gh pr review {N} --repo {owner/repo} --comment --body "$VERDICT_BODY (posted as comment-review — bot account opened the PR; --request-changes blocked by GitHub)"
  else
    cat "$ERR" >&2; exit 1
  fi
fi
```

**`commented` case** (only nits — no blockers, no majors):

```bash
gh pr review {N} --repo {owner/repo} --comment --body "$VERDICT_BODY"
```

**`approved` case** (zero findings):

```bash
if ! gh pr review {N} --repo {owner/repo} --approve --body "$VERDICT_BODY" 2>"$ERR"; then
  if grep -qE "(Cannot|Can not) approve (own|your own) pull request" "$ERR"; then
    gh pr review {N} --repo {owner/repo} --comment --body "$VERDICT_BODY (posted as comment-review — bot account opened the PR; --approve blocked by GitHub)"
  else
    cat "$ERR" >&2; exit 1
  fi
fi
```

### Step 9: Emit structured verdict block (cortex#237)

After the GitHub review is submitted, emit a fenced ```json verdict block as the LAST element of the response — per `SKILL.md` → "Structured verdict block (cortex#237)". cortex's `src/runner/review-pipeline.ts` parser reads the final fenced block to build the `review.verdict.<kind>` bus envelope; omit the block and pilot stalls with `cant_do`.

Capture the review metadata immediately after submission:

```bash
REVIEW_JSON=$(gh api "repos/{owner}/{repo}/pulls/{N}/reviews" --jq '.[-1]')
REVIEW_ID=$(echo "$REVIEW_JSON" | jq -r '.id')
REVIEW_URL=$(echo "$REVIEW_JSON" | jq -r '.html_url')
SUBMITTED_AT=$(echo "$REVIEW_JSON" | jq -r '.submitted_at')
COMMIT_ID=$(echo "$REVIEW_JSON" | jq -r '.commit_id')
```

Then emit the block as the final fenced section of the response. See `SKILL.md` for the full schema, enum constraint on `verdict` (`approved` | `changes-requested` | `commented` — case sensitive), and worked examples.

---

## Output Format

```
## Security Review: {owner/repo}#{N}

### Lenses Applied
- CodeQuality
- Security (full OWASP Top 10)
- Confidentiality (C1–C6, exposure-gated) — {active/n-a-private}

### OWASP Scan Results
{Category-by-category results}

### Findings Summary
| Severity | Count | Category |
|----------|-------|----------|
| critical | {n}   | {categories} |
| warning  | {n}   | {categories} |
| suggestion | {n} | {categories} |

### Verdict: {approved/changes-requested/commented}
{Brief rationale with security posture assessment}
```
