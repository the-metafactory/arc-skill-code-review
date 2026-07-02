# FullReview Workflow

Comprehensive review applying all 7 lenses + duplication analysis sequentially. Use this when asked for a "full review" or "comprehensive review" — nothing is skipped, every lens is applied regardless of content.

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
SOP: pr-review | PR: {owner/repo}#{N} | Lenses: confidentiality,quality,security,hardening,architecture,ecosystem,performance,duplication | exposure={public|arc-shipped|unknown-treated-as-exposed|private} | confidentiality={active|n/a-private}
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

### Step 0: Ground in Target-Repo Architecture Docs (compass#98 F9)

**Numbered "Step 0" deliberately** (mirrors `Architecture.md` §0's own "runs first" convention) even though it sits after Steps 1–2 in file order — it is foundational grounding that must complete **before any lens runs, including lens detection**, so every review is glossary-aware regardless of which lenses end up active. This replaces the old behavior where this fetch lived only inside the conditionally-activated Architecture lens (grounding-2 gap: a behavior-change PR to existing files never triggered Architecture, so it reviewed glossary-blind).

Full protocol: `ArchitectureDocs.md`. Fetch each canonical doc from the **target repo** (not this skill's repo) with a single un-piped GET — **pipe-free form only**. The `--jq '.content' | base64 -d` form is a pipe chain and is silently blocked by a review-session lockdown's bash-guard before it ever runs (see `ArchitectureDocs.md` §1):

```bash
gh api repos/{owner}/{repo}/contents/CONTEXT.md -H "Accept: application/vnd.github.raw"
gh api repos/{owner}/{repo}/contents/docs/architecture.md -H "Accept: application/vnd.github.raw"
gh api repos/{owner}/{repo}/contents/compass/ecosystem/CONTEXT-MAP.md -H "Accept: application/vnd.github.raw"
```

Each fetch is best-effort — a non-zero exit means the doc is absent, which is expected and non-fatal. Parse `CONTEXT.md` glossary entries (canonical term + `_Avoid_:` alias lists) and `docs/architecture.md` layer/boundary rules per `ArchitectureDocs.md` §§2–4. **Cache the loaded content for the rest of this review session** — Step 7's Architecture lens pass (and any other lens that cites the glossary) reuses this cache and must not re-fetch.

**Cross-check the diff now**, independent of which lenses later activate: walk the diff already read in Step 2 for added or renamed symbols matching a `CONTEXT.md` `_Avoid_:` alias (per `ArchitectureDocs.md` §5.1–5.3 match-class + severity rules) and any cross-layer import violating `docs/architecture.md` (§5.4–5.5). Record these as `lens=architecture` findings the same as if the Architecture lens itself had produced them — this is what closes the grounding-2 gap; the findings must exist even when Step 7 below is the only place Architecture-lens machinery otherwise runs.

**F17-skill — cortex ratchet escalation.** If the target repo's short name is `cortex` (any owner — forks and worktree-scoped clones carry the same manifest path), ALSO fetch the machine-readable vocab-ratchet manifest with the same pipe-free form:

```bash
gh api repos/{owner}/cortex/contents/scripts/vocab-ratchet.json -H "Accept: application/vnd.github.raw"
```

Best-effort — an absent or malformed manifest is non-fatal; proceed with the `CONTEXT.md`-only glossary check above. When loaded, parse the `terms[]` array (`{canonical, avoid[], ratchetEnforced[], severity, pattern, caseInsensitive, context}`, `carveouts.paths[]`). **The `pattern` field is authoritative over `avoid`/`ratchetEnforced`/`caseInsensitive`** — a manifest entry can double-specify case-sensitivity (e.g. `caseInsensitive: true` alongside an already-case-sensitive `pattern`); when they disagree, apply the `pattern` regex as written and do not widen it by re-applying `caseInsensitive` on top — over-broadening a deliberately case-sensitive pattern reintroduces false positives the manifest was built to avoid. A `ratchetEnforced` term match against `pattern` on an **added** line (not context or removed lines) in a path not covered by `carveouts.paths` is a **critical** finding — distinct from, and in addition to, the advisory/nit/warning `_Avoid_` findings above:

```
[critical/architecture] Ratchet term `{ratchetEnforced-term}` (pattern: `{pattern}`) on an added line — canonical: `{canonical}`. cortex/scripts/vocab-ratchet.json — {context}
```

**Emit the provenance line**, in the pinned canonical shape (every doc a `(loaded)`/`(not-found)` token, comma-separated — see `ArchitectureDocs.md` §1). This line MUST be captured now and carried into the verdict body in Step 13 so it prints on **every** review regardless of which lenses activate — its absence from a posted review becomes greppable evidence that grounding did not run:

```
architecture-docs: CONTEXT.md (loaded), docs/architecture.md (loaded), CONTEXT-MAP.md (not-found)
```

— or, with zero docs found:

```
architecture-docs: CONTEXT.md (not-found), docs/architecture.md (not-found), CONTEXT-MAP.md (not-found) — running legacy heuristic checklist only
```

### Step 3: Run Confidentiality Lens

Load `Confidentiality.md` from the skill root. Run this lens **first**, because exposure is foundational context for the whole review.

- If the repo is **not exposed** (confirmed private and not arc-shipped), record `confidentiality=n/a-private` and skip to Step 4.
- If the repo is **exposed** (public, arc-shipped, or unknown-treated-as-exposed), apply the full C1–C6 checklist regardless of which files the PR touched.
- **Rule 0 (never-quote) applies to every finding this lens produces:** cite category + `file:line` only, never the suspected literal — not in the comment, the summary, or the verdict block. Route "is this a real party?" questions to the private control plane, never a public PR comment.

Record findings: severity, lens=confidentiality, file/line, category (C1–C6), finding (never the literal), fix.

### Step 4: Run CodeQuality Lens

Load `CodeQuality.md` from the skill root. Apply every item on the checklist.

Record findings: severity, lens=quality, file/line, finding, fix.

### Step 5: Run Security Lens

Load `Security.md` from the skill root. Apply the full OWASP Top 10 checklist systematically.

Even if the PR does not appear security-sensitive, check for:
- Secrets accidentally committed
- Error messages leaking internals
- Missing input validation on any new function parameters
- Dependency changes introducing known vulnerabilities

Record findings: severity, lens=security, file/line, finding, fix.

### Step 6: Run Hardening Lens

Load `Hardening.md` from the skill root. Apply the full defensive infrastructure checklist (H-01 through H-08).

Check:
- Authentication layer present and strict on all API endpoints
- CORS configuration uses explicit origin allowlist
- Rate limiting on write and auth endpoints
- Input validation at all system boundaries (parameterized queries, JSON parse error handling, enum/datetime/length validation)
- Audit logging for auth events, authorization failures, and mutations
- PII handling policy documented or evident
- API key lifecycle with metadata and persistent validation
- Webhook/callback signature verification with constant-time comparison

Record findings: severity, lens=hardening, file/line, finding, fix.

### Step 7: Run Architecture Lens

Load `Architecture.md` from the skill root. Apply the full structural checklist.

**Reuse Step 0's cache — do not re-fetch.** The target repo's canonical architecture docs (`CONTEXT.md`, `docs/architecture.md`, `compass/ecosystem/CONTEXT-MAP.md`, and — for cortex — `scripts/vocab-ratchet.json`) were already fetched, parsed, and cached in Step 0, and the diff cross-check + provenance line were already produced there. This step's job is the **heuristic** checklist on top of that grounding, not a second fetch.

Evaluate the heuristic checklist:
- Does each changed module maintain single responsibility?
- Are new dependencies between modules justified?
- Does the change follow or deviate from existing patterns?
- Is the abstraction level appropriate (not too abstract, not too concrete)?
- Are there breaking changes to public APIs?

Record findings: severity, lens=architecture, file/line, finding, fix. Fold Step 0's CONTEXT.md/ratchet-derived findings into this lens's finding set (they are `lens=architecture` findings regardless of which step produced them) rather than duplicating the cross-check.

### Step 8: Run EcosystemCompliance Lens

Load `EcosystemCompliance.md` from the skill root. Apply the full metafactory standards checklist.

Check:
- CLAUDE.md is present and has all required sections
- arc-manifest.yaml version is correct
- Labels follow the standard set
- Commit messages use conventional format
- SOP activation table is present and current

Record findings: severity, lens=ecosystem, file/line, finding, fix.

### Step 9: Run Performance Lens

Load `Performance.md` from the skill root. Apply the full performance checklist.

Check:
- N+1 query patterns in any database code
- Unbounded loops or recursion
- Missing pagination on list endpoints
- Memory leaks (unclosed resources, growing caches)
- Blocking operations in async contexts
- Unnecessary data copying or transformation

Record findings: severity, lens=performance, file/line, finding, fix.

### Step 10: Run Code Duplication Analysis

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

### Step 11: Post Findings by Lens

Post findings organized by lens (including confidentiality and duplication). Use inline comments for file-specific findings, general comments for cross-cutting observations.

For **confidentiality** findings, obey Rule 0 (never-quote): the comment states category + `file:line` + remediation, never the suspected literal.

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

### Step 12: Post Summary and Verdict

Post a final summary comment aggregating all lens results:

```bash
gh pr comment {N} --repo {owner/repo} --body "## Full Review Summary: {owner/repo}#{N}

### Lens Results
| Lens | Critical | Warning | Suggestion | Nit | Verdict |
|------|----------|---------|------------|-----|---------|
| Confidentiality | {n} | {n} | {n} | {n} | {pass/fail/n-a-private} |
| CodeQuality | {n} | {n} | {n} | {n} | {pass/fail} |
| Security | {n} | {n} | {n} | {n} | {pass/fail} |
| Hardening | {n} | {n} | {n} | {n} | {pass/fail} |
| Architecture | {n} | {n} | {n} | {n} | {pass/fail} |
| EcosystemCompliance | {n} | {n} | {n} | {n} | {pass/fail} |
| Performance | {n} | {n} | {n} | {n} | {pass/fail} |
| Duplication | {n} | {n} | {n} | {n} | {pass/fail} |

architecture-docs: {CONTEXT.md (loaded|not-found)}, {docs/architecture.md (loaded|not-found)}, {CONTEXT-MAP.md (loaded|not-found)}

### Overall Verdict: {approved/changes-requested/commented}
{rationale summarizing the most important findings across all lenses}"
```

### Step 13: Submit Review

**Resolve the verdict from the findings — do not invent a rule.** The single
normative source is compass `sops/pr-review.md` → "Severity → Verdict"; this
skill, the sage engine, and the autonomous-work merge gate all resolve a review
the same way. Map each finding's severity to a bucket, then the buckets to one of
exactly three verdicts (this is the `findings` shape the verdict block carries):

| Severity | Bucket |
|----------|--------|
| `critical` | **blockers** |
| `warning` | **majors** |
| `suggestion` | **nits** |
| `nit` | **nits** |

| Condition | Verdict | recommend: |
|-----------|---------|-----------|
| `blockers > 0` **OR** `majors > 0` | `changes-requested` | `request-changes` |
| only nits (`blockers == 0` AND `majors == 0` AND `nits > 0`) | `commented` | `comment` |
| zero findings | `approved` | `merge` |

**Nit-only reviews do NOT block.** A review whose findings are all
`suggestion`/`nit` resolves to `commented` — the PR stays mergeable. A
zero-tolerance "any finding blocks" rule makes the autonomous loop fight itself
over cosmetic nits and never converge. The contract is exactly these three
outcomes.

**Confidentiality criticals are never waivable.** A confidentiality `critical`
(C1–C6) is severity-`critical` → a **blocker** → forces `changes-requested`, and
is exempt from every rule that would otherwise soften a verdict. It closes only
by **removal** of the offending content or a **linked principal-comment URL**
authorising the exception in the private control plane — never by a justification,
and never by quoting the value to argue it is safe (Rule 0). See
`Confidentiality.md` → "Verdict impact".

Compose the verdict body once — same shape for all three outcomes — so pilot's
`fetch` parses the `recommend:` line cleanly regardless of verdict:

```
Full review (7 lenses + duplication) — {summary line}.

verdict: blockers={N} majors={N} nits={N} — recommend: {merge|comment|request-changes}
```

Submit it, falling back to `--comment` whenever GitHub blocks the self-action.
The fallback matters because **bots reviewing a PR they themselves opened get
blocked on `--approve` and `--request-changes`** — GitHub returns *"Cannot
approve own pull request"* and the verdict review silently drops if there's no
recovery (issue #5). The `commented` verdict already posts a `--comment` review,
which GitHub never blocks, so it needs no fallback.

The agent issues exactly **one** of the three blocks below — the one selected by
the verdict resolved above — never more than one. No `if [ "{recommendation}" =
"merge" ]` placeholder branching: that is fragile under template substitution (a
missed substitute silently picks the wrong branch). The verdict body is composed
once and shared between the formal review and any fallback comment so the
`recommend:` line parses identically either way.

**The `architecture-docs:` provenance line captured in Step 0 rides in this same body** — every verdict (`changes-requested` / `commented` / `approved`) is composed once and posted via `gh pr review`, so this is the one guaranteed-unconditional place the line survives regardless of verdict outcome or which lenses activated (compass#98 F9):

```bash
VERDICT_BODY="$(cat <<'EOF'
Full review (7 lenses + duplication) — {summary line}.

architecture-docs: {CONTEXT.md (loaded|not-found)}, {docs/architecture.md (loaded|not-found)}, {CONTEXT-MAP.md (loaded|not-found)}

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

### Step 14: Emit structured verdict block (cortex#237)

After the GitHub review is submitted, capture the returned review ID + URL + submitted timestamp + commit SHA, then emit a fenced ```json verdict block as the LAST element of the response — per `SKILL.md` → "Structured verdict block (cortex#237)". This is the machine-readable handshake cortex's `src/runner/review-pipeline.ts` parser uses to build the `review.verdict.<kind>` bus envelope. Omit it and pilot stalls with `cant_do`.

Capture the review metadata immediately after submission:

```bash
REVIEW_JSON=$(gh api "repos/{owner}/{repo}/pulls/{N}/reviews" --jq '.[-1]')
REVIEW_ID=$(echo "$REVIEW_JSON" | jq -r '.id')
REVIEW_URL=$(echo "$REVIEW_JSON" | jq -r '.html_url')
SUBMITTED_AT=$(echo "$REVIEW_JSON" | jq -r '.submitted_at')
COMMIT_ID=$(echo "$REVIEW_JSON" | jq -r '.commit_id')
```

Then emit the block as the final fenced section of the response. See `SKILL.md` for the full schema, enum constraint on `verdict` (`approved` | `changes-requested` | `commented` — case sensitive), and worked examples. When confidentiality findings surfaced, they are counted in the `findings` aggregate exactly like any other lens — but their literals never appear in the block (Rule 0).

---

## Output Format

```
## Full Review: {owner/repo}#{N}

### Lenses Applied (7 + duplication)
1. Confidentiality — {pass/fail/n-a-private} ({n} findings)
2. CodeQuality — {pass/fail} ({n} findings)
3. Security — {pass/fail} ({n} findings)
4. Hardening — {pass/fail} ({n} findings)
5. Architecture — {pass/fail} ({n} findings)
6. EcosystemCompliance — {pass/fail} ({n} findings)
7. Performance — {pass/fail} ({n} findings)
8. Duplication — {pass/fail} ({n} findings)

architecture-docs: {CONTEXT.md (loaded|not-found)}, {docs/architecture.md (loaded|not-found)}, {CONTEXT-MAP.md (loaded|not-found)}

### Critical Findings
{List of critical findings requiring immediate attention — confidentiality findings by category + file:line only, never the literal}

### Key Observations
{Top 3-5 most important observations across all lenses}

### Verdict: {approved/changes-requested/commented}
{Rationale}
```
