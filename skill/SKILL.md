---
name: CodeReview
description: Multi-lens pull request review with automated findings. USE WHEN review PR, code review, security review, audit PR, check PR, OWASP review, architecture review, review for security, full review, hardening review, API hardening, defensive review, skill review, review skill, evaluate skill.
---

# CodeReview

Multi-lens PR review skill with content-aware auto-selection. Applies code quality, security, architecture, ecosystem compliance, performance, and confidentiality lenses based on what the PR actually touches (confidentiality is gated on repo exposure, not diff content).

## Who runs this skill

This skill is invoked by **Claude-Code-backed reviewers** — Echo, Luna, and any other agent whose substrate is Claude Code and who claims a `code-review.<flavor>` capability via cortex's review consumer. Triggered through cortex#237's capability-dispatch path: a `review.request.*` envelope wakes Claude Code, Claude Code reads this SKILL.md, runs the lenses, posts the inline GH comments + the `gh pr review`, and emits the verdict block at the bottom (see `## Structured verdict block` below). Pilot is the typical publisher of those review-request envelopes.

**Sage does NOT invoke this skill.** Sage (pi.dev / claude / codex substrate, sage#40) runs its own lens pipeline in `~/work/mf/sage/src/lenses/`, hosted in-process by cortex's ReviewConsumer. Sage emits the verdict envelope directly from `reviewPr` — no markdown SKILL.md, no fenced verdict block. Both reviewers terminate at the same `local.{org}.{stack}.code.pr.review.{approved|changes-requested|commented}` envelope shape so downstream consumers (pilot loop, cortex dashboard) don't care which reviewer claimed.

**Routing summary:**

| Capability | Claimed by (default cortex.yaml) | Skill path |
|------------|----------------------------------|------------|
| `code-review.typescript`, `.python`, `.rust`, `.go`, `.sql`, `.docs` | sage | sage's in-process pipeline — NOT this skill |
| `code-review.security`, `.generic` | sage + fern | sage in-process / fern Claude Code via this skill |
| `code-review.confidentiality` | Claude-Code reviewers | this skill — exposure-gated Confidentiality lens, primary lens of a `confidentiality`-flavored FullReview |
| `code-review.hardening` | Claude-Code reviewers | this skill — HardeningReview workflow |
| `code-review.skill-quality` | Claude-Code reviewers | this skill — SkillReview workflow |
| GitLab MR (`payload.forge: "gitlab"`) | fern | this skill, fern's substrate |
| Other repos (non-metafactory) | Luna / Echo | this skill, their substrate |

**Flavor catalog (cortex `REVIEW_FLAVORS`, 11 total).** The routable
`code-review.<flavor>` capabilities are `generic`, `typescript`, `python`,
`rust`, `go`, `sql`, `docs`, `security`, `confidentiality`, `hardening`, and
`skill-quality`. This skill's Workflow Routing is a **subset** of that catalog:
the language flavors + `generic` resolve to FullReview (or StandardReview when a
quick pass is requested); `security` → SecurityReview; `confidentiality` runs the
exposure-gated Confidentiality lens (wired into every workflow, and the primary
lens of a `confidentiality`-flavored FullReview); `hardening` → HardeningReview;
`skill-quality` → SkillReview. The routing must never name a flavor that is not
in this catalog — when cortex widens `REVIEW_FLAVORS`, widen the routing here to
match.

Updates to **this SKILL.md** affect the Claude-Code-backed reviewers only. To update sage's lens behavior, edit `~/work/mf/sage/src/lenses/*.ts`. Updates to **the verdict envelope shape** affect both — those live in `the-metafactory/myelin` (envelope schema) and `the-metafactory/cortex/docs/design-pi-dev-review-agent.md`.

## Customization

**Before executing, check for user customizations at:**
`~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/CodeReview/`

If this directory exists, load and apply:
- `PREFERENCES.md` - User preferences and configuration
- Additional files specific to the skill

These define user-specific preferences. If the directory does not exist, proceed with skill defaults.

## Voice Notification

**When executing a workflow, do BOTH:**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:8888/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Running the WORKFLOWNAME workflow in the CodeReview skill to ACTION"}' \
     > /dev/null 2>&1 &
   ```

2. **Output text notification**:
   ```
   Running the **WorkflowName** workflow in the **CodeReview** skill to ACTION...
   ```

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **FullReview** | "review PR", "review PR #N" (default) | `Workflows/FullReview.md` |
| **SecurityReview** | "security review", "review for security", "OWASP audit" | `Workflows/SecurityReview.md` |
| **HardeningReview** | "hardening review", "API hardening", "hardening audit", "defensive review" | `Workflows/HardeningReview.md` |
| **SkillReview** | "skill review", "review skill", "evaluate skill", "skill quality" | `Workflows/SkillReview.md` |
| **StandardReview** | "quick review", "lightweight review" | `Workflows/StandardReview.md` |
| **SweepReview** | "sweep PR", "--fix", "address review comments", "fix-or-justify" | `Workflows/SweepReview.md` |

**Two workflows sit outside the PR-verdict contract.** Every **PR-review** workflow —
FullReview, StandardReview, SecurityReview, HardeningReview — ends by submitting a `gh pr review`
verdict and emitting the structured verdict block (see "Structured verdict block" below). Two
workflows are explicit exceptions:

- **SweepReview** works each finding under a fix-or-justify contract and ends at "ready for
  re-review" — it does **not** self-approve, issues no `gh pr review`, and emits **no** verdict block.
- **SkillReview** reviews a skill **by path** (not a PR): it issues no `gh pr review`, and reports a
  quality-tier verdict (well-built / needs-work / major-gaps) rather than the structured verdict block.

Both are therefore exempt from the verdict contract in "Severity → verdict".

## Lens Selection Logic

**StandardReview** reads the full diff, then auto-detects which lenses to apply based on what changed. CodeQuality is always included.

| PR touches... | Auto-activate lenses |
|---------------|---------------------|
| Any code | CodeQuality (always) |
| User input, auth, API endpoints, DB queries | + Security |
| New files, new modules, directory changes | + Architecture |
| CLAUDE.md, arc-manifest.yaml, labels, repo config | + EcosystemCompliance |
| Database queries, hot paths, data processing loops | + Performance |

**Confidentiality is exposure-gated, not content-gated.** It is not in the content-trigger table above because it does not activate on what the diff *touches* — it activates on whether the *repo* is exposed (public or arc-shipped). On an exposed repo, Confidentiality is **always active** for every review regardless of file types; on a non-exposed private repo it does not run. Determine exposure per `Confidentiality.md` → "Exposure detection — fail CLOSED".

**SecurityReview** applies CodeQuality + Security lenses regardless of content, plus duplication analysis.

**HardeningReview** applies CodeQuality + Security (targeted) + Hardening lenses, plus duplication analysis. Checks for defensive infrastructure patterns rather than exploitable vulnerabilities.

**SkillReview** applies the SkillQuality lens to evaluate a Claude Code skill against authoring best practices. Not part of FullReview — standalone workflow invoked on request.

**FullReview** applies all 7 lenses sequentially (does not include SkillReview — that's a separate workflow).

**All workflows** finish with a Code Duplication analysis step that compares the PR's new code against the entire repository, not just the diff. This catches re-implemented utilities and copy-paste from existing code that per-file lens checks miss.

## Lens Reference Files

Each lens is a detailed checklist loaded on-demand by workflows:

- `CodeQuality.md` — Empty catches, dead code, naming, error handling, test coverage, lint-gate compliance (CI lint job status + new violations on touched lines)
- `Security.md` — OWASP Top 10: injection, auth, data exposure, input validation, dependencies
- `Confidentiality.md` — Exposure-gated leak prevention (C1–C6): real orgs/people as content, deployment fragments on shippable paths, real identities in seeds/fixtures, live platform IDs, identity-embedding codes, private→public lifts; fail-closed exposure detection + never-quote rule
- `Hardening.md` — API defensive patterns: auth layer, CORS, rate limiting, audit logging, PII handling, input boundaries
- `Architecture.md` — SRP, coupling, pattern consistency, abstraction level, API surface
- `EcosystemCompliance.md` — CLAUDE.md, arc-manifest, labels, SOP table, conventional commits
- `Performance.md` — N+1 queries, unbounded loops, pagination, memory leaks, blocking in async
- `SkillQuality.md` — Skill structure, description quality, activation triggers, examples, progressive disclosure, anti-patterns

## Examples

**Example 1: Standard review with auto-detection**
```
User: "review PR #42"
-> Invokes StandardReview workflow
-> Reads PR diff, detects API endpoint changes + new module
-> Applies: CodeQuality + Security + Architecture
-> Posts inline findings as PR comments
-> Posts verdict (approved / changes-requested / commented)
```

**Example 2: Focused security review**
```
User: "security review on PR #42"
-> Invokes SecurityReview workflow
-> Applies: CodeQuality + Security (full OWASP checklist)
-> Posts findings with [security] tags
-> Verdict based on security findings severity
```

**Example 3: Hardening review**
```
User: "hardening review on PR #12"
-> Invokes HardeningReview workflow
-> Reads diff + supporting middleware/auth files
-> Applies: CodeQuality + Security (targeted) + Hardening (H-01 through H-08)
-> Posts hardening coverage table (present/missing/partial per category)
-> Verdict based on defensive posture assessment
```

**Example 4: Skill quality review**
```
User: "review skill at ~/.claude/skills/my-skill"
-> Invokes SkillReview workflow
-> Reads SKILL.md, all referenced files, folder structure
-> Applies: SkillQuality (SK-01 through SK-08)
-> Posts quality assessment table (pass/partial/fail per category)
-> Activation tier estimate (Unoptimized/Basic/Good/Excellent)
-> Verdict based on overall skill quality
```

**Example 5: Comprehensive review**
```
User: "full review PR #42"
-> Invokes FullReview workflow
-> Applies all 7 lenses sequentially
-> Posts findings organized by lens
-> Summary comment with lens-by-lens results
-> Verdict based on aggregate findings
```

## Severity → verdict

Every review resolves to exactly one of three verdicts. The **single normative
source** of this mapping is compass `sops/pr-review.md` → "Severity → Verdict";
this skill, the sage engine, and the autonomous-work merge gate all resolve a
review the same way. The buckets below are exactly the `findings` shape the
verdict block carries (`{ blockers, majors, nits }`).

**Severity → bucket:**

| Severity | Bucket |
|----------|--------|
| `critical` | **blockers** |
| `warning` | **majors** |
| `suggestion` | **nits** |
| `nit` | **nits** |

**Bucket → verdict:**

| Condition | Verdict | recommend: |
|-----------|---------|-----------|
| `blockers > 0` **OR** `majors > 0` | `changes-requested` | `request-changes` |
| only nits (`blockers == 0` AND `majors == 0` AND `nits > 0`) | `commented` | `comment` |
| zero findings | `approved` | `merge` |

**Nit-only reviews do NOT block** — they resolve to `commented`, keeping the PR
mergeable. A zero-tolerance "any finding blocks" rule makes the autonomous loop
fight itself over cosmetic nits and never converge. The contract is exactly these
three outcomes — `changes-requested` / `commented` / `approved` — and those are
the canonical verdict tokens (they map to `gh pr review --request-changes` /
`--comment` / `--approve`).

**Confidentiality carve-out (non-waivable).** A confidentiality `critical`
(C1–C6) is a `critical` → a **blocker** → forces `changes-requested`, and is
**never** waivable, downgradable, or approved-over. It closes only by **removal**
of the offending content or a **linked principal-comment URL** authorising the
exception in the private control plane — never by a justification, never by
quoting the value (Rule 0). See `Confidentiality.md` → "Verdict impact".

**SweepReview is exempt from this contract.** The `--fix` sweep resolves each
finding in place (fix-or-justify) and ends at "ready for re-review" — it does not
self-approve and emits **no** verdict block. See `Workflows/SweepReview.md`.

## Structured verdict block (cortex#237)

When this skill is invoked through cortex's capability-dispatch path (Echo or any other agent driven by `review.request.*`), the LAST thing the response emits MUST be a fenced ```json block matching the schema below. cortex's `src/runner/review-pipeline.ts` parser reads the final fenced block in the CC output and builds a `review.verdict.<kind>` envelope from it. The parser is the only machine-readable handshake between this skill and cortex — any drift in the shape (renamed field, typo'd enum, missing key) collapses the dispatch to a `cant_do` failure and stalls pilot's review loop.

The contract is pinned by the round-trip test at `the-metafactory/cortex` →
`src/runner/__tests__/skill-verdict-block.contract.test.ts`. When that test is intentionally updated, the fixtures here must move with it.

### When to emit

- Emit the block at the **very end** of the response — it must be the last fenced block in the output (the parser uses last-block-wins, so earlier prose, inline JSON, and lens-internal scratch are tolerated).
- Emit it AFTER the `gh pr review` submission so that `github_review_id`, `github_review_url`, `submitted_at`, and `commit_id` reflect the review GitHub actually accepted (capture them from the `gh api` response or `gh pr view --json reviews`).
- Use a ```json fence (lowercase `json` is canonical; the parser regex is case-insensitive, but stick to lowercase).
- Emit exactly one block per review run. Do not emit empty/placeholder blocks while a workflow is still in progress — earlier blocks are tolerated by the parser but pollute operator-facing transcripts.

### Required fields

| Field | Type | Notes |
|-------|------|-------|
| `verdict` | enum | One of `"approved"`, `"changes-requested"`, `"commented"`. **EXACTLY** these strings — case sensitive. Typos (`"approve"`, `"request_changes"`, `"comment"`) cause `cant_do`. |
| `summary` | string | Short prose mirroring the verdict-body `recommend:` line. Include `blockers=N majors=N nits=N — recommend: …` so the dashboard tile reads cleanly. |
| `github_review_id` | integer | The numeric ID from the `gh pr review` response (e.g. `2459200001`). Capture via `gh api .../pulls/{N}/reviews` or `gh pr view --json reviews`. |
| `github_review_url` | string | Full HTTPS URL to the review (`https://github.com/{owner}/{repo}/pull/{N}#pullrequestreview-{id}`). |
| `submitted_at` | string | ISO-8601 timestamp the review was submitted (`2026-05-17T08:15:42Z`). |
| `commit_id` | string | Full 40-char SHA of the head commit reviewed. |
| `findings` | object | `{ blockers: int, majors: int, nits: int }` — aggregated counts, all three keys required even if zero. Per-finding records live in the inline GH comments, not here. |
| `inline_comments` | integer | Count of inline review comments posted as part of this review. |

### Worked example — `approved` (clean PR)

````
I've completed the CodeQuality, Security, and Architecture lenses on PR #229.
No blockers, majors, or nits surfaced — the change is tightly scoped, well-tested, and
internally consistent. Submitting an approving GitHub review.

```json
{
  "verdict": "approved",
  "summary": "verdict: blockers=0 majors=0 nits=0 — recommend: approve. Clean change, no findings across CodeQuality / Security / Architecture.",
  "github_review_id": 2459200001,
  "github_review_url": "https://github.com/the-metafactory/cortex/pull/229#pullrequestreview-2459200001",
  "submitted_at": "2026-05-17T08:15:42Z",
  "commit_id": "d4e5f6a7b8c9012345678901234567890abcdef1",
  "findings": { "blockers": 0, "majors": 0, "nits": 0 },
  "inline_comments": 0
}
```
````

### Worked example — `changes-requested` (real review with findings)

````
I've completed the full review. Two maintainability issues (majors) and three
nit-level style suggestions surfaced — see inline comments on GitHub. The two
majors block (majors > 0 ⇒ changes-requested), so I'm requesting changes via
`gh pr review --request-changes`.

```json
{
  "verdict": "changes-requested",
  "summary": "verdict: blockers=0 majors=2 nits=3 — recommend: request-changes. Two maintainability concerns (silent catch in pipeline; nullable propagation in adapter) and three style nits (naming, doc-comment alignment, redundant guard).",
  "github_review_id": 2459200002,
  "github_review_url": "https://github.com/the-metafactory/cortex/pull/229#pullrequestreview-2459200002",
  "submitted_at": "2026-05-17T08:22:11Z",
  "commit_id": "d4e5f6a7b8c9012345678901234567890abcdef1",
  "findings": { "blockers": 0, "majors": 2, "nits": 3 },
  "inline_comments": 5
}
```
````

### Worked example — `commented` (informational only)

````
Review complete. One nit-level naming observation surfaced — not blocking, not
approval-worthy on its own. Submitting an informational `gh pr review --comment`.

```json
{
  "verdict": "commented",
  "summary": "verdict: blockers=0 majors=0 nits=1 — recommend: comment-only. Single naming nit on the new helper; author's call.",
  "github_review_id": 2459200003,
  "github_review_url": "https://github.com/the-metafactory/cortex/pull/229#pullrequestreview-2459200003",
  "submitted_at": "2026-05-17T08:27:55Z",
  "commit_id": "d4e5f6a7b8c9012345678901234567890abcdef1",
  "findings": { "blockers": 0, "majors": 0, "nits": 1 },
  "inline_comments": 1
}
```
````

### Why this matters

The parser at cortex `src/runner/review-pipeline.ts` (capability-dispatch consumer, cortex#237 PR-5) routes the block into a `review.verdict.<approved|changes-requested|commented>` envelope that pilot subscribes to. No block → `dispatch.task.failed` with `cant_do` → pilot stalls and the review-loop never closes. The `verdict` enum is the routing key, hence its strict spelling.

When the skill is invoked outside cortex (operator running it manually, paste-into-Claude usage), the block is harmless extra output — emit it unconditionally.
