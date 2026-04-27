# HardeningReview Workflow

Examines API code for defensive hardening patterns — authentication, rate limiting, audit logging, input validation, PII handling. Reports what's in place, what's missing, and what's inconsistent. Uses CodeQuality + Security + Hardening lenses.

---

## Pre-flight

Output this status line before proceeding:
```
SOP: pr-review | PR: {owner/repo}#{N} | Lenses: quality,security,hardening
```

---

## Procedure

### Step 1: Read PR Context

```bash
gh pr view {N} --repo {owner/repo} --json title,body,labels,headRefName,baseRefName,files
```

- Read the PR description and linked issues
- Identify what kind of API surface this PR introduces or modifies
- Note any infrastructure this code depends on (CF Workers, D1, KV, Durable Objects)

### Step 2: Read Full Diff + Supporting Files

```bash
gh pr diff {N} --repo {owner/repo}
```

- Read every changed file completely
- Also read files the PR imports from but doesn't change — middleware, auth helpers, types — to understand the full security posture
- Map out: which endpoints exist, what middleware chain runs, what bindings/services are used

### Step 3: Run CodeQuality Lens

Load `CodeQuality.md` from the skill root and apply its full checklist.

Focus especially on:
- Empty catch blocks in security-critical code (audit writes, auth logic)
- Error handling patterns that could mask security failures
- Test coverage for security-relevant code paths

Record findings with severity, lens tag `quality`, file/line, finding, and fix.

### Step 4: Run Security Lens (Targeted)

Load `Security.md` from the skill root. Apply the OWASP categories most relevant to API hardening:

- **A01 Injection** — Trace all user input to DB queries
- **A02 Authentication** — Missing auth middleware on new routes
- **A04 Authorization** — IDOR, privilege escalation, missing ownership checks
- **A07 Input Validation** — Missing validation at system boundaries
- **A09 Logging** — Security event logging gaps

The remaining OWASP categories (A03, A05, A06, A08, A10) should be checked but are less likely to surface findings in API hardening context.

Record findings with severity, lens tag `security`, file/line, finding, and fix.

### Step 5: Run Hardening Lens

Load `Hardening.md` from the skill root and apply its complete checklist. This is the primary lens for this workflow.

**Work through each hardening category systematically:**

For each category (H-01 through H-08):
1. Determine if the category is applicable to this PR's code
2. If applicable, check every item in the category's checklist
3. For each item: record whether the pattern is **present**, **missing**, or **partially implemented**
4. If a pattern exists in other parts of the codebase but not in this PR's code, note the inconsistency

**Key difference from SecurityReview:** The Hardening lens checks for the *presence of defensive infrastructure*, not for *exploitable vulnerabilities*. A missing rate limiter isn't an exploitable bug — it's a missing defense. Both matter, but they're different findings.

Record findings with severity, lens tag `hardening`, file/line, finding, and fix.

### Step 6: Run Code Duplication Analysis

This step runs **last**, after all other lenses, because it requires comparing the PR against the full repository.

**Scope:** Compare the PR's new and changed code against the **entire repository**, not just the diff.

1. For each new function, class, or significant block introduced by the PR, search the full repository for similar logic:
   ```bash
   # For each new function/pattern, search the repo for similar code
   grep -rn "{key pattern from new code}" --include="*.ts" --include="*.js" .
   ```

2. Check specifically for:
   - **Auth middleware reimplemented** — Does the PR duplicate existing auth helpers instead of using them?
   - **Audit logging pattern duplicated** — Is the same log-event sequence written inline instead of using a shared helper?
   - **Validation logic repeated** — Are the same validation checks written in multiple handlers?

Record findings: severity, lens=duplication, file/line, finding, fix (reference the existing code location).

### Step 7: Post Findings

Post all findings as PR comments.

**Inline comment for specific findings:**
```bash
gh api repos/{owner}/{repo}/pulls/{N}/comments \
  --method POST \
  --field body="**[{severity}/hardening]** {finding}

**Category:** {H-XX category name}
**Status:** {present/missing/partial}
**Fix:** {remediation}" \
  --field path="{file_path}" \
  --field commit_id="$(gh pr view {N} --repo {owner/repo} --json headRefOid -q .headRefOid)" \
  --field line={line_number}
```

**Summary comment:**
```bash
gh pr comment {N} --repo {owner/repo} --body "## Hardening Review Summary

### Hardening Pattern Coverage
| Category | Status | Findings |
|----------|--------|----------|
| H-01 Authentication Layer | {present/partial/missing} | {count} |
| H-02 CORS Configuration | {present/partial/missing/n-a} | {count} |
| H-03 Rate Limiting | {present/partial/missing/n-a} | {count} |
| H-04 Input Validation | {present/partial/missing} | {count} |
| H-05 Audit Logging | {present/partial/missing} | {count} |
| H-06 PII Handling | {present/partial/missing} | {count} |
| H-07 API Key Lifecycle | {present/partial/missing/n-a} | {count} |
| H-08 Webhook Verification | {present/partial/missing/n-a} | {count} |

### Security + Quality Findings
| Severity | Count | Source |
|----------|-------|--------|
| critical | {n} | {lenses} |
| warning | {n} | {lenses} |
| suggestion | {n} | {lenses} |

### Verdict: {verdict}
{rationale — include hardening posture assessment}"
```

### Step 8: Post Verdict

Verdict criteria:

- **Approve** only if there are ZERO findings — all applicable hardening categories present or n/a, no findings of any severity
- **Request changes** if there are ANY findings at all — every finding surfaced in a review must be addressed (fixed or explicitly acknowledged with rationale) before merge

There is no "comment" verdict. If the review found something worth mentioning, it's worth addressing. Do not label findings as "non-blocking" — all review feedback must be resolved before merge.

```bash
# Verdict body MUST contain a `recommend: <merge|request-changes>` line
# so pilot's fetch parses the verdict either way. Both branches fall back
# to --comment when GitHub blocks the self-action — see
# FullReview.md#step-12 for the canonical fallback pattern.
gh pr review {N} --repo {owner/repo} --approve --body "$VERDICT_BODY" 2>/tmp/cr-err \
  || { grep -q "Cannot approve" /tmp/cr-err && gh pr review {N} --repo {owner/repo} --comment --body "$VERDICT_BODY"; }
# or, when findings exist:
gh pr review {N} --repo {owner/repo} --request-changes --body "$VERDICT_BODY" 2>/tmp/cr-err \
  || { grep -q "Can not request changes" /tmp/cr-err && gh pr review {N} --repo {owner/repo} --comment --body "$VERDICT_BODY"; }
```

---

## Output Format

```
## Hardening Review: {owner/repo}#{N}

### Lenses Applied
- CodeQuality
- Security (targeted OWASP)
- Hardening (H-01 through H-08)

### Hardening Posture
{Category-by-category results — what's present, what's missing}

### Findings Summary
| Severity | Count | Lens |
|----------|-------|------|
| critical | {n} | {lenses} |
| warning | {n} | {lenses} |
| suggestion | {n} | {lenses} |

### Verdict: {approve/request-changes/comment}
{Hardening posture assessment — is the defensive infrastructure adequate for the service's threat model?}
```
