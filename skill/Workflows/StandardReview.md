# StandardReview Workflow

Content-aware PR review with automatic lens selection. CodeQuality is always applied; additional lenses are activated based on what the PR actually touches.

---

## Pre-flight

Output this status line before proceeding:
```
SOP: pr-review | PR: {owner/repo}#{N} | Lenses: {detected lenses}
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

### Step 5: Run Additional Detected Lenses

For each additional lens detected in Step 3, load the corresponding reference file from the skill root and apply its checklist:

- Security lens -> load `Security.md`
- Architecture lens -> load `Architecture.md`
- EcosystemCompliance lens -> load `EcosystemCompliance.md`
- Performance lens -> load `Performance.md`

Record findings in the same format as Step 4.

### Step 6: Post Findings

Post findings as PR comments. Use inline comments for file-specific findings, general comments for cross-cutting findings.

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

### Step 7: Post Verdict

Determine verdict based on findings:

- **Approve** if no critical or warning findings
- **Request changes** if any critical findings
- **Comment** if only suggestions and nits

```bash
gh pr review {N} --repo {owner/repo} --approve --body "Lenses applied: {list}. No blocking findings."
# or
gh pr review {N} --repo {owner/repo} --request-changes --body "Critical findings need addressing before merge."
# or
gh pr review {N} --repo {owner/repo} --comment --body "Suggestions only — non-blocking. Lenses applied: {list}."
```

---

## Output Format

After completing the review, summarize:

```
## PR Review: {owner/repo}#{N}

### Lenses Applied
- CodeQuality (always)
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
