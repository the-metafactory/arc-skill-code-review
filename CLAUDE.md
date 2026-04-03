<!-- Generated from metafactory ecosystem template. Customize sections marked with {PLACEHOLDER}. -->

# arc-skill-code-review -- Multi-lens PR review skill for Claude Code

Multi-lens PR review skill for Claude Code

## Architecture

```
skill/
  SKILL.md              — Skill entry point, routing table, frontmatter
  CodeQuality.md        — Code quality lens (always applied)
  Security.md           — Security lens (OWASP Top 10)
  Hardening.md          — Hardening lens (defensive infrastructure patterns H-01–H-08)
  SkillQuality.md       — Skill quality lens (authoring best practices SK-01–SK-08)
  Architecture.md       — Architecture lens (structural review)
  EcosystemCompliance.md — Ecosystem compliance lens (metafactory standards)
  Performance.md        — Performance lens (hot paths, queries, memory)
  Workflows/
    StandardReview.md   — Content-aware auto-selection review
    SecurityReview.md   — Focused security + code quality review
    HardeningReview.md  — API defensive infrastructure review
    SkillReview.md      — Claude Code skill quality review
    FullReview.md       — All 6 lenses applied
```

- `skill/SKILL.md` — Entry point. YAML frontmatter for skill activation, workflow routing table, lens selection logic.
- `skill/Workflows/*.md` — Executable workflow files. Each defines a step-by-step review procedure.
- `skill/*.md` (non-SKILL) — Lens reference documents. Loaded on-demand by workflows. Each contains a detailed checklist for one review perspective.


## Naming

- **metafactory** -- always lowercase, one word. Not "Metafactory", not "Meta Factory". The GitHub org is `the-metafactory`, the repo name may be hyphenated (technical constraint), and the domains are `meta-factory.ai/.dev/.io` (DNS constraint). But the brand name is always `metafactory`.

## Critical Rules

- NEVER describe code you haven't read. Use Read/Glob/Grep to verify before making claims.
- NEVER fabricate file names, class names, or architecture. If unsure, read the source.
- Fix ALL errors found during type checks, tests, or linting -- even if pre-existing or introduced by another developer. Never dismiss errors as "not from our changes." If you see it, fix it.
- Before fixing a bug or implementing a feature, ALWAYS check open PRs (`gh pr list`) and issues (`gh issue list`) first. Someone may already be working on it, or there may be a PR ready to merge that addresses it. Don't duplicate work -- review what exists before racing to write code.


## GitHub Labels (ecosystem standard)

All metafactory ecosystem repos use a shared label set. Do not create ad-hoc labels.

| Label | Description | Color | Purpose |
|-------|-------------|-------|---------|
| `bug` | Something isn't working | `#d73a4a` | Defect tracking |
| `documentation` | Improvements or additions to documentation | `#0075ca` | Docs work |
| `feature` | Feature specification | `#1D76DB` | Feature work |
| `infrastructure` | Cross-cutting infrastructure work | `#5319E7` | Infra/tooling |
| `now` | Currently being worked | `#0E8A16` | Priority: active |
| `next` | Next up after current work | `#FBCA04` | Priority: queued |
| `future` | Planned but not yet scheduled | `#C5DEF5` | Priority: backlog |
| `handover` | NZ/EU timezone bridge -- work session summary | `#F9D0C4` | Async handoffs |



Every issue must have at least one type label (`bug`, `feature`, `infrastructure`, `documentation`) and one priority label (`now`, `next`, `future`) if open.

## GitHub Issue Tracking
When working on a GitHub issue in this repo, keep the issue updated as you work. This is default agent behavior, not optional.

**On starting work:**
- Comment on the issue: what you're working on, which sub-task
- Example: `gh issue comment 1 --body "Starting: implement initial project structure"`

**During work:**
- When a sub-task checkbox is completed, tick it on the issue
- When you create a PR, link it to the issue (use `closes #N` or `gh pr create` with issue reference)

**On completing work:**
- Comment with a summary: what was done, what changed, any follow-up needed
- Tick completed checkboxes on both the GitHub issue AND any iteration plans
- If all checkboxes are done, close the issue

**Why:** GitHub is the shared collaboration surface. Team members and agents all read it. If you do work but don't update the issue, it looks like nothing happened.

## Standard Operating Procedures

This repo follows ecosystem SOPs defined in [compass](https://github.com/the-metafactory/compass). **Before starting work, identify which SOPs apply and Read them. Output the pre-flight line from each loaded SOP.**

| SOP | Activate when | File |
|-----|--------------|------|
| **Dev pipeline** | Creating branches, making PRs, starting any feature/fix work | `compass/sops/dev-pipeline.md` |
| **Versioning** | After merging PRs, before deploying, any version bump | `compass/sops/versioning.md` |
| **Worktree discipline** | Starting feature work (always — even solo) | `compass/sops/worktree-discipline.md` |
| **Design process** | Creating specs, design docs, or research docs | `compass/sops/design-process.md` |
| **Retrospective** | Post-work review, extracting process patterns | `compass/sops/retrospective-and-process-mining.md` |
| **New repo** | Bootstrapping a new repository in the ecosystem | `compass/sops/new-repo.md` |
| **PR review** | Reviewing a PR, before approving or merging | `compass/sops/pr-review.md` |

### Examples

**Starting a feature:**
```
Task: "Add a dashboard panel"
→ Activate: dev-pipeline + worktree
→ Read both SOPs
→ Output: "SOP: dev-pipeline | Branch: feat/g-300-panel | Prefix: feat:"
→ Output: "SOP: worktree | Worktree: ../arc-skill-code-review-panel | Branch: feat/g-300-panel | Main: untouched"
```

**After merging a PR:**
```
Task: "Merge PR #42"
→ After merge, activate: versioning
→ Read SOP
→ Output: "SOP: versioning | Current: v0.2.0 | Bump: patch → v0.2.1"
```


## Blueprint-Driven Development

All ecosystem repos track features in `blueprint.yaml`. Before starting feature work, check the dependency graph:

```bash
# What's ready to work on? (dependencies satisfied)
blueprint ready

# Claim a feature
blueprint update {REPO_SHORT}:{ID} --status in-progress

# After PR merges
blueprint update {REPO_SHORT}:{ID} --status done
blueprint lint   # Validate graph integrity
```

**Statuses:** Only `planned`, `in-progress`, and `done` are settable. `ready`, `blocked`, and `next` are computed from the dependency graph.

**Cross-repo dependencies:** Use `{repo}:{ID}` format (e.g., `grove:G-200`, `arc:A-100`). A feature is `blocked` if any dependency in another repo isn't `done`.

## Versioning & Releases

See `compass/sops/versioning.md` for the full procedure. Key repo-specific details:

- Version source of truth: `arc-manifest.yaml`
- Release title format: `"arc-skill-code-review vX.Y.Z -- Short Description"`
- Deploy command: `arc upgrade arc-skill-code-review`


## Multi-Agent Worktree Discipline

See `compass/sops/worktree-discipline.md` for the full procedure. Key repo-specific details:

- Worktree directory pattern: `../arc-skill-code-review-{slug}`
- Example: `git worktree add ../arc-skill-code-review-feature -b feat/{branch-name} main`

## Bun

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.
