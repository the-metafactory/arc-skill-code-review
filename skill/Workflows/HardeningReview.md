# HardeningReview Workflow

Examines API code for defensive hardening patterns — authentication, rate limiting, audit logging, input validation, PII handling. Reports what's in place, what's missing, and what's inconsistent. Uses CodeQuality + Security + Hardening + Confidentiality lenses (Confidentiality is exposure-gated, like every review flavor on an exposed repo).

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
SOP: pr-review | PR: {owner/repo}#{N} | Lenses: quality,security,hardening,confidentiality | exposure={public|arc-shipped|unknown-treated-as-exposed|private} | confidentiality={active|n/a-private}
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

### Step 6: Run Confidentiality Lens

Load `Confidentiality.md` from the skill root.

- If the repo is **not exposed** (confirmed private and not arc-shipped), record `confidentiality=n/a-private` and skip to Step 7.
- If the repo is **exposed** (public, arc-shipped, or unknown-treated-as-exposed), apply the full C1–C6 checklist regardless of which files the PR touched.
- **Rule 0 (never-quote) applies:** cite category + `file:line` only, never the suspected literal — not in the comment, the summary, or the verdict block. Route "is this a real party?" questions to the private control plane, never a public PR comment.

Record findings: severity, lens=confidentiality, file/line, category (C1–C6), finding (never the literal), fix.

### Step 7: Run Code Duplication Analysis

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

### Step 8: Post Findings

Post all findings as PR comments. Confidentiality findings are tagged `[confidentiality]` and obey Rule 0 (category + `file:line` only, never the literal).

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
| Confidentiality (C1–C6) | {active/n-a-private/findings} | {count} |

### Security + Quality Findings
| Severity | Count | Source |
|----------|-------|--------|
| critical | {n} | {lenses} |
| warning | {n} | {lenses} |
| suggestion | {n} | {lenses} |

### Verdict: {verdict}
{rationale — include hardening posture assessment}"
```

### Step 9: Post Verdict

Determine the verdict from the findings, per the single normative source
(compass `sops/pr-review.md` → "Severity → Verdict") — the same mapping
`FullReview.md#step-13-submit-review` renders in full. A missing-defense
finding carries a severity like any other and buckets accordingly:

- `critical` → **blocker**, `warning` → **major**, `suggestion`/`nit` → **nit**.
- `blockers > 0` OR `majors > 0` ⇒ **`changes-requested`** (recommend: request-changes).
- only nits (no blockers, no majors) ⇒ **`commented`** (recommend: comment) — nit-only reviews do NOT block; the PR stays mergeable.
- zero findings (all applicable hardening categories present or n/a) ⇒ **`approved`** (recommend: merge).
- **Confidentiality criticals are never waivable.** A confidentiality critical (C1–C6) is severity-`critical` → a blocker → forces `changes-requested`, exempt from any rule that would otherwise soften a verdict; it closes only by removal of the content or a linked principal-comment URL authorising the exception — never by a justification, never by quoting the value to argue it is safe.

Use the canonical verdict-submission pattern from
`FullReview.md#step-13-submit-review` — single body, exactly one of the
three blocks issued:

```bash
VERDICT_BODY="$(cat <<'EOF'
Hardening review — defensive patterns verified. {N} findings.

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

### Step 10: Emit structured verdict block (cortex#237)

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
## Hardening Review: {owner/repo}#{N}

### Lenses Applied
- CodeQuality
- Security (targeted OWASP)
- Hardening (H-01 through H-08)
- Confidentiality (C1–C6, exposure-gated) — {active/n-a-private}

### Hardening Posture
{Category-by-category results — what's present, what's missing}

### Findings Summary
| Severity | Count | Lens |
|----------|-------|------|
| critical | {n} | {lenses} |
| warning | {n} | {lenses} |
| suggestion | {n} | {lenses} |

### Verdict: {approved/changes-requested/commented}
{Hardening posture assessment — is the defensive infrastructure adequate for the service's threat model?}
```
