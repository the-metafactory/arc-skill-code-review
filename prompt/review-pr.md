---
description: Review or sweep a PR in a fresh-context sub-agent using the CodeReview skill
argument-hint: <pr-number> [--sweep | --standard | --security] [--repo owner/repo]
---

You are invoking the `review-pr` slash command. Your job is to spawn a **fresh-context** sub-agent that runs the `CodeReview` skill against the specified PR and returns a summary. You do NOT run the review yourself — that would pollute the current working context.

## Arguments

Parse `$ARGUMENTS` as: `<pr-number> [--sweep | --standard | --security] [--repo <owner/repo>]`

- **PR number** (required, first positional argument) — e.g., `42`.
- **Mode flag** (optional, default `--full`):
  - *(no flag)* → run the `FullReview` workflow (all 5 lenses). This is the default — thorough by design.
  - `--sweep` → run the `SweepReview` workflow (address every open inline comment with Outcome A/B bar).
  - `--standard` → run the `StandardReview` workflow (content-aware lens auto-selection — lighter, for small PRs where all-lenses is overkill).
  - `--security` → run the `SecurityReview` workflow (CodeQuality + Security, full OWASP).
  - `--full` → redundant with the default, accepted for explicitness.
- **`--repo <owner/repo>`** (optional) — target a different repo than the current `git remote`. If omitted, the sub-agent derives the repo from `gh repo view --json nameWithOwner`.

If `$ARGUMENTS` is empty or does not start with a number, respond with:
```
Usage: /review-pr <pr-number> [--sweep | --standard | --security] [--repo owner/repo]
```
and stop.

## What to Do

Spawn an `Engineer` sub-agent using the `Agent` tool with:
- `subagent_type: "Engineer"`
- `description`: one short phrase like "Review PR {N}" or "Sweep PR {N}".
- `prompt`: a self-contained briefing (details below).

**Do NOT set `isolation: "worktree"`.** Worktree isolation requires either the CWD to be a git repo OR `WorktreeCreate` hooks configured in settings — neither is guaranteed, and when missing the spawn fails with "Cannot create agent worktree". Read-only review modes (default, `--standard`, `--security`) never need it. Sweep mode arranges its own checkout via `gh pr checkout` when it needs to push commits — see the sweep briefing below.

The sub-agent's prompt MUST include:
1. Its job is to invoke the `CodeReview` skill via the `Skill` tool (e.g., `Skill("CodeReview")`) and execute the workflow matching the requested mode.
2. The target PR: `{owner/repo}#{N}`.
3. For review modes: read the diff with `gh pr diff`, apply the workflow's lenses, post inline findings via `gh api repos/{owner}/{repo}/pulls/{N}/comments`, then submit a verdict via `gh pr review`. No local checkout needed.
4. For `--sweep`: emphasize the Outcome A / Outcome B bar from `Workflows/SweepReview.md` — every open inline comment gets either a fix commit or a specific technical justification; nits are in scope; severity is not a filter. When the sub-agent needs a local checkout to push fix commits, it should run `gh pr checkout {N} --repo {owner/repo}` in a fresh temp directory (e.g., `mktemp -d`) so its work does not collide with the parent conversation's working tree. It pushes back to the PR branch from there.
5. Return a structured summary: lenses applied (or outcomes counted for sweep), number of findings/comments addressed, commit SHAs pushed (sweep only), and verdict.

Do NOT inherit or pass along the current conversation's context. The sub-agent must start fresh so the review/sweep is unbiased.

## After the Sub-Agent Returns

Relay the sub-agent's summary to the user as **structured markdown** — preserve headers, bullet lists, tables, and blank lines exactly as the sub-agent returned them. Do NOT collapse the report into a single paragraph: terminal renderers keep markdown structure, and flattening it destroys readability.

Minimum structure for the relay:
- A short heading like `## Review of {owner/repo}#{N}` (or `## Sweep of …` for sweep mode).
- A bullet list or small table of findings **by severity** (critical / warning / suggestion) for review modes, or **by outcome** (A implemented / B justified) for sweep mode.
- A final line with the **verdict** (e.g. `**Verdict:** request-changes`) and the PR URL.

Trim repetitive prose from the sub-agent's report, but keep the hierarchy. Do NOT re-summarize the workflow steps — just the outcome, formatted.

## Examples

**Example — default (full) review:**

User input: `/review-pr 42`
→ You spawn Engineer sub-agent with prompt: "Run CodeReview skill, FullReview workflow, on {owner/repo}#42."
→ Sub-agent reads diff, applies all 5 lenses sequentially, posts per-lens inline comments, submits verdict.
→ You relay (rendered as markdown, not a single paragraph):

```markdown
## Review of {owner/repo}#42

**Lenses applied:** CodeQuality, Security, Architecture, EcosystemCompliance, Performance

- 🔴 1 critical — Security: unauthenticated admin endpoint
- 🟡 4 warnings — 2 CodeQuality, 1 Architecture, 1 Performance
- 🔵 3 suggestions — CodeQuality

**Verdict:** request-changes
PR: https://github.com/{owner/repo}/pull/42
```

**Example — sweep mode:**

User input: `/review-pr 42 --sweep`
→ You spawn Engineer sub-agent with prompt: "Run CodeReview skill, SweepReview workflow, on {owner/repo}#42. Address every open inline comment per the Outcome A/B bar. For A-decisions, checkout the PR branch in a temp dir via `mktemp -d && gh pr checkout 42` and push fix commits from there."
→ Sub-agent triages each open comment, pushes fix commits for A-decisions, replies with justifications for B-decisions, posts sweep-complete summary.
→ You relay:

```markdown
## Sweep of {owner/repo}#42

| Outcome | Count |
|---|---|
| A — implemented (fix commits) | 5 |
| B — justified (replies only) | 2 |

**Commits pushed:** `abc1234`, `def5678`, `9012345`
**Status:** ready for re-review
PR: https://github.com/{owner/repo}/pull/42
```

**Example — lightweight standard review:**

User input: `/review-pr 42 --standard`
→ You spawn Engineer sub-agent with prompt: "Run CodeReview skill, StandardReview workflow, on {owner/repo}#42."
→ Sub-agent reads diff, content-detects which lenses apply, runs only those.
→ You relay:

```markdown
## Standard review of {owner/repo}#42

**Lenses auto-selected:** CodeQuality, Security

- 🟡 2 warnings — Security: missing input validation on two handlers
- 🔵 3 suggestions — CodeQuality: naming + dead branch

**Verdict:** comment
PR: https://github.com/{owner/repo}/pull/42
```

**Example — cross-repo target:**

User input: `/review-pr 17 --repo mellanon/pai-collab`
→ You spawn Engineer sub-agent with prompt targeting mellanon/pai-collab#17, FullReview workflow (default).
→ Sub-agent applies all 5 lenses, posts per-lens comments, submits verdict.
→ You relay:

```markdown
## Review of mellanon/pai-collab#17

**Lenses applied:** CodeQuality, Security, Architecture, EcosystemCompliance, Performance

- 🔴 1 critical — Security
- 🟡 4 warnings — spread across lenses

**Verdict:** request-changes
PR: https://github.com/mellanon/pai-collab/pull/17
```
