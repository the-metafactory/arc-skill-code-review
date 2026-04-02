# FullReview Workflow

Comprehensive review applying all 5 lenses sequentially. Use this when asked for a "full review" or "comprehensive review" — nothing is skipped, every lens is applied regardless of content.

---

## Pre-flight

Output this status line before proceeding:
```
SOP: pr-review | PR: {owner/repo}#{N} | Lenses: quality,security,architecture,ecosystem,performance,duplication
```

---

## Procedure

### Step 1: Read PR Context

```bash
gh pr view {N} --repo {owner/repo} --json title,body,labels,headRefName,baseRefName,files,additions,deletions
```

- Read the PR description and linked issues
- Understand the intent: what problem does this solve?
- Note the scope: number of files changed, lines added/removed
- Check for linked design specs, iteration plans, or feature issues

### Step 2: Read Full Diff

```bash
gh pr diff {N} --repo {owner/repo}
```

- Read every changed file completely — do not skim
- Build a complete mental model of the change before applying any lens
- Note the overall change pattern: is this a feature, bugfix, refactor, or chore?

### Step 3: Run CodeQuality Lens

Load `CodeQuality.md` from the skill root. Apply every item on the checklist.

Record findings: severity, lens=quality, file/line, finding, fix.

### Step 4: Run Security Lens

Load `Security.md` from the skill root. Apply the full OWASP Top 10 checklist systematically.

Even if the PR does not appear security-sensitive, check for:
- Secrets accidentally committed
- Error messages leaking internals
- Missing input validation on any new function parameters
- Dependency changes introducing known vulnerabilities

Record findings: severity, lens=security, file/line, finding, fix.

### Step 5: Run Architecture Lens

Load `Architecture.md` from the skill root. Apply the full structural checklist.

Evaluate:
- Does each changed module maintain single responsibility?
- Are new dependencies between modules justified?
- Does the change follow or deviate from existing patterns?
- Is the abstraction level appropriate (not too abstract, not too concrete)?
- Are there breaking changes to public APIs?

Record findings: severity, lens=architecture, file/line, finding, fix.

### Step 6: Run EcosystemCompliance Lens

Load `EcosystemCompliance.md` from the skill root. Apply the full metafactory standards checklist.

Check:
- CLAUDE.md is present and has all required sections
- arc-manifest.yaml version is correct
- Labels follow the standard set
- Commit messages use conventional format
- SOP activation table is present and current

Record findings: severity, lens=ecosystem, file/line, finding, fix.

### Step 7: Run Performance Lens

Load `Performance.md` from the skill root. Apply the full performance checklist.

Check:
- N+1 query patterns in any database code
- Unbounded loops or recursion
- Missing pagination on list endpoints
- Memory leaks (unclosed resources, growing caches)
- Blocking operations in async contexts
- Unnecessary data copying or transformation

Record findings: severity, lens=performance, file/line, finding, fix.

### Step 8: Run Code Duplication Analysis

This step runs **last**, after all other lenses, because it requires a broader view than individual lens checks.

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

### Step 9: Post Findings by Lens

Post findings organized by lens (including duplication). Use inline comments for file-specific findings, general comments for cross-cutting observations.

**Per-lens summary comment:**
```bash
gh pr comment {N} --repo {owner/repo} --body "## Full Review: {lens} Lens

### Findings
{bullet list of findings with severity tags}

### Lens Verdict: {pass/fail/advisory}
{Brief assessment for this lens}"
```

**Inline comments for specific findings** (same as StandardReview):
```bash
gh api repos/{owner}/{repo}/pulls/{N}/comments \
  --method POST \
  --field body="**[{severity}/{lens}]** {finding}

{fix}" \
  --field path="{file_path}" \
  --field commit_id="$(gh pr view {N} --repo {owner/repo} --json headRefOid -q .headRefOid)" \
  --field line={line_number}
```

### Step 10: Post Summary and Verdict

Post a final summary comment aggregating all lens results:

```bash
gh pr comment {N} --repo {owner/repo} --body "## Full Review Summary: {owner/repo}#{N}

### Lens Results
| Lens | Critical | Warning | Suggestion | Nit | Verdict |
|------|----------|---------|------------|-----|---------|
| CodeQuality | {n} | {n} | {n} | {n} | {pass/fail} |
| Security | {n} | {n} | {n} | {n} | {pass/fail} |
| Architecture | {n} | {n} | {n} | {n} | {pass/fail} |
| EcosystemCompliance | {n} | {n} | {n} | {n} | {pass/fail} |
| Performance | {n} | {n} | {n} | {n} | {pass/fail} |
| Duplication | {n} | {n} | {n} | {n} | {pass/fail} |

### Overall Verdict: {approve/request-changes/comment}
{rationale summarizing the most important findings across all lenses}"
```

### Step 11: Submit Review

```bash
gh pr review {N} --repo {owner/repo} --approve --body "Full review (5 lenses + duplication) passed. No blocking findings."
# or
gh pr review {N} --repo {owner/repo} --request-changes --body "Full review found critical issues. See per-lens comments."
# or
gh pr review {N} --repo {owner/repo} --comment --body "Full review complete. Suggestions noted — non-blocking."
```

Verdict criteria:
- **Approve** if no critical findings in ANY lens and no more than 2 warnings total
- **Request changes** if any critical finding in any lens OR 3+ warnings across lenses
- **Comment** if only suggestions and nits

---

## Output Format

```
## Full Review: {owner/repo}#{N}

### Lenses Applied (5/5 + duplication)
1. CodeQuality — {pass/fail} ({n} findings)
2. Security — {pass/fail} ({n} findings)
3. Architecture — {pass/fail} ({n} findings)
4. EcosystemCompliance — {pass/fail} ({n} findings)
5. Performance — {pass/fail} ({n} findings)
6. Duplication — {pass/fail} ({n} findings)

### Critical Findings
{List of critical findings requiring immediate attention}

### Key Observations
{Top 3-5 most important observations across all lenses}

### Verdict: {approve/request-changes/comment}
{Rationale}
```
