# StandardReview Workflow

Content-aware PR review with automatic lens selection. CodeQuality is always applied; additional lenses are activated based on what the PR actually touches.

---

## Pre-flight

First determine repo exposure (fail CLOSED — see `Confidentiality.md` → "Exposure detection"):

```bash
gh repo view {owner}/{repo} --json visibility --jq '.visibility'
# PUBLIC ⇒ exposed. error / rate-limit / timeout / empty / unknown ⇒ treat as EXPOSED.
# arc-shipped (arc-manifest*.yaml at repo root) ⇒ EXPOSED even if private.
```

Exposure is repo-level, not diff-level: when the repo is exposed, Confidentiality is **always** active regardless of what the diff touches (it is not one of the content-detected lenses). Output this status line before proceeding:
```
SOP: pr-review | PR: {owner/repo}#{N} | Lenses: {detected lenses}[,confidentiality if exposed] | exposure={public|arc-shipped|unknown-treated-as-exposed|private} | confidentiality={active|n/a-private}
```

---

## Procedure

### Step 1: Read PR Context

```bash
gh pr view {N} --repo {owner/repo} --json title,body,labels,headRefName,baseRefName,files
```

- Read the PR description and linked issues
- Understand the intent: what problem does this solve?
- Check if there's a design spec or iteration plan referenced
- Note the number of changed files and their paths

### Step 2: Read Full Diff

```bash
gh pr diff {N} --repo {owner/repo}
```

- Read every changed file, not just the summary
- Understand the change as a whole before looking at details
- Build a mental model of what this PR is doing

### Step 3: Detect Lenses

Based on the diff content, determine which lenses to activate. **CodeQuality is always included.**

**Confidentiality is NOT content-detected.** Do not look for a diff signal to activate it — it is **exposure-gated at the repo level**. If the target repo is exposed (public, arc-shipped, or unknown-treated-as-exposed per the pre-flight check), Confidentiality is **always active** for this review regardless of which files changed; if the repo is confirmed private and not arc-shipped, it does not run. It is deliberately absent from the content-signal table below.

Scan the changed files and content for these signals:

**Security lens — activate if ANY of these are present:**
- Files in auth/, login/, session/, or security-related paths
- Changes to API endpoint handlers or route definitions
- Database query construction (SQL strings, ORM queries)
- User input handling (request body parsing, query params)
- File operations with user-supplied paths
- External service calls (HTTP clients, SDK calls)
- Token/secret/key handling
- Changes to CORS, CSP, or other security headers

**Architecture lens — activate if ANY of these are present:**
- New files created (not just modifications)
- New directories added
- Changes to module exports or public API surface
- New dependency imports from other internal modules
- Changes to core abstractions (base classes, interfaces, shared types)
- Significant restructuring of existing files

**EcosystemCompliance lens — activate if ANY of these are present:**
- CLAUDE.md modified or created
- arc-manifest.yaml modified
- package.json modified (version, dependencies)
- GitHub labels, workflows, or CI configuration changed
- README.md modified

**Performance lens — activate if ANY of these are present:**
- Database queries added or modified
- Loops over collections (especially nested loops)
- Data processing or transformation pipelines
- API response handlers that process lists
- Cache implementations or modifications
- File I/O operations in request paths
- WebSocket or streaming handlers

### Step 4: Run CodeQuality Lens (Always)

Load `CodeQuality.md` from the skill root and apply its full checklist against the diff.

For each finding, record:
- **Severity:** critical / warning / suggestion / nit
- **Lens:** quality
- **Location:** file path and line number
- **Finding:** what's wrong
- **Fix:** how to fix it (if known)

### Step 5: Run Confidentiality Lens (exposure-gated — always-on when exposed)

This step is **not** conditional on detected content — run it whenever the repo is exposed (per the Step 3 note and the pre-flight exposure check).

Load `Confidentiality.md` from the skill root.

- If the repo is **not exposed** (confirmed private and not arc-shipped), record `confidentiality=n/a-private` and skip to Step 6.
- If the repo is **exposed**, apply the full C1–C6 checklist regardless of which files the PR touched.
- **Rule 0 (never-quote) applies:** cite category + `file:line` only, never the suspected literal — not in the comment, the summary, or the verdict block. Route "is this a real party?" questions to the private control plane, never a public PR comment.

Record findings: severity, lens=confidentiality, file/line, category (C1–C6), finding (never the literal), fix.

### Step 6: Run Additional Detected Lenses

For each additional lens detected in Step 3, load the corresponding reference file from the skill root and apply its checklist:

- Security lens -> load `Security.md`
- Architecture lens -> load `Architecture.md` **and** apply its §0 doc-loading step first — fetch `CONTEXT.md`, `docs/architecture.md`, and `compass/ecosystem/CONTEXT-MAP.md` from the target repo, parse glossary + boundary rules per `ArchitectureDocs.md`, and cross-check the diff against them. Emit the `architecture-docs:` provenance line regardless of whether docs were found.
- EcosystemCompliance lens -> load `EcosystemCompliance.md`
- Performance lens -> load `Performance.md`

Record findings in the same format as Step 4.

### Step 7: Run Code Duplication Analysis

This step runs **last**, after all other lenses, because it requires comparing the PR against the full repository.

**Scope:** Compare the PR's new and changed code against the **entire repository**, not just the diff.

1. For each new function, class, or significant block introduced by the PR, search the full repository for similar logic:
   ```bash
   # For each new function/pattern, search the repo for similar code
   grep -rn "{key pattern from new code}" --include="*.ts" --include="*.js" --include="*.py" .
   ```

2. Check for:
   - **Copy-pasted blocks** — New code that duplicates existing repository code verbatim or near-verbatim
   - **Re-implemented utilities** — New code that does what an existing function in the repo already does
   - **Repeated boilerplate across files** — The PR introduces a pattern that already exists elsewhere, signaling a missing shared abstraction
   - **Within-PR duplication** — The same logic appears in multiple files within the PR itself

3. Apply the DRY knowledge principle: Two functions with similar-looking code that serve **different purposes** and will evolve independently are NOT duplication. Only flag duplication where extraction would reduce bugs or maintenance burden.

Record findings: severity, lens=duplication, file/line, finding, fix (reference the existing code location).

### Step 8: Post Findings

Post findings as PR comments. Use inline comments for file-specific findings, general comments for cross-cutting findings. Confidentiality findings obey Rule 0 (category + `file:line` only, never the literal).

**Inline comment (specific line):**
```bash
gh api repos/{owner}/{repo}/pulls/{N}/comments \
  --method POST \
  --field body="**[{severity}/{lens}]** {finding}

{fix}" \
  --field path="{file_path}" \
  --field commit_id="$(gh pr view {N} --repo {owner/repo} --json headRefOid -q .headRefOid)" \
  --field line={line_number}
```

**General PR comment (cross-cutting findings):**
```bash
gh pr comment {N} --repo {owner/repo} --body "## Review: {lens} lens

{findings formatted as bullet list with severity tags}"
```

### Step 9: Post Verdict

Determine verdict based on findings:

- **Approve** only if there are ZERO findings — no criticals, no warnings, no suggestions, no nits
- **Request changes** if there are ANY findings at all — every finding surfaced in a review must be addressed (fixed or explicitly acknowledged with rationale) before merge
- **Confidentiality criticals are never waivable.** A confidentiality critical (C1–C6) is **always** `request-changes`, exempt from any rule that would otherwise permit approving with minor findings; it closes only by removal of the content or a linked principal-comment URL authorising the exception — never by quoting the value to argue it is safe.

There is no "comment" verdict. If the review found something worth mentioning, it's worth addressing. Do not label findings as "non-blocking" — all review feedback must be resolved before merge.

Use the canonical verdict-submission pattern from
`FullReview.md#step-13-submit-review` — single body, one of two blocks
issued, mktemp'd stderr capture, both error-message variants matched,
fail-loud on unrecognised errors:

```bash
VERDICT_BODY="$(cat <<'EOF'
Lenses applied: {list}. {N} findings.

verdict: blockers={N} majors={N} nits={N} — recommend: {merge|request-changes}
EOF
)"

ERR=$(mktemp -t cr-verdict-err.XXXXXX)
trap 'rm -f "$ERR"' EXIT
```

**Approve case** (zero findings only):

```bash
if ! gh pr review {N} --repo {owner/repo} --approve --body "$VERDICT_BODY" 2>"$ERR"; then
  if grep -qE "(Cannot|Can not) approve (own|your own) pull request" "$ERR"; then
    gh pr review {N} --repo {owner/repo} --comment --body "$VERDICT_BODY (posted as comment-review — bot account opened the PR; --approve blocked by GitHub)"
  else
    cat "$ERR" >&2; exit 1
  fi
fi
```

**Request-changes case** (any findings):

```bash
if ! gh pr review {N} --repo {owner/repo} --request-changes --body "$VERDICT_BODY" 2>"$ERR"; then
  if grep -qE "(Cannot|Can not) request changes on your own pull request" "$ERR"; then
    gh pr review {N} --repo {owner/repo} --comment --body "$VERDICT_BODY (posted as comment-review — bot account opened the PR; --request-changes blocked by GitHub)"
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

After completing the review, summarize:

```
## PR Review: {owner/repo}#{N}

### Lenses Applied
- CodeQuality (always)
- Confidentiality (exposure-gated — {active/n-a-private})
- {additional detected lenses with reason for activation}

### Findings Summary
| Severity | Count | Lens |
|----------|-------|------|
| critical | {n}   | {lenses} |
| warning  | {n}   | {lenses} |
| suggestion | {n} | {lenses} |
| nit      | {n}   | {lenses} |

### Verdict: {approve/request-changes/comment}
{Brief rationale}
```
