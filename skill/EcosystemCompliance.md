# EcosystemCompliance Lens

**Activated when:** PR touches CLAUDE.md, arc-manifest.yaml, labels, or repo configuration. Also applies for new repo onboarding PRs. Always applied in FullReview workflow.

This lens checks compliance with metafactory ecosystem standards as defined in the compass SOPs.

---

## Checklist

### 1. CLAUDE.md

- [ ] **CLAUDE.md exists** at repo root.
- [ ] **Project description present.** First section clearly describes what this project is and is not.
- [ ] **Architecture section present.** Lists key files with brief descriptions. Matches actual file structure.
- [ ] **SOP activation table present.** Table mapping SOPs to when they apply.
  ```markdown
  | SOP | When |
  |-----|------|
  | `compass/sops/dev-pipeline.md` | Contributing to this repo |
  | `compass/sops/versioning.md` | Releasing new versions |
  ```
- [ ] **GitHub labels section present.** Lists the 8 standard labels (bug, documentation, feature, infrastructure, now, next, future, handover).
- [ ] **Critical rules section present.** At minimum: no fabricating code claims, fix all errors, no empty catch blocks, check existing PRs/issues.
- [ ] **CLAUDE.md is current.** If the PR adds new files, modules, or patterns, CLAUDE.md should be updated to reflect them.
- [ ] **No stale references.** File paths, class names, and architecture descriptions in CLAUDE.md match the actual codebase.

### 2. arc-manifest.yaml

- [ ] **Manifest exists** at repo root (for arc-managed repos).
- [ ] **Schema version correct.** Must be `schema: arc/v1`.
- [ ] **Version follows semver.** Format: `MAJOR.MINOR.PATCH`. No pre-release suffixes unless in development.
- [ ] **Version is consistent.** If package.json also has a version, they must match.
- [ ] **Type is correct.** Must be one of: `skill`, `tool`, `agent`, `prompt`, `pipeline`.
- [ ] **Author information present.** Must have `name` and `github` fields.
- [ ] **Capabilities are minimal.** Only declare capabilities the artifact actually needs. Don't over-request permissions.
- [ ] **Version was bumped if content changed.** If the PR changes functionality (not just docs), the version should be bumped per semver rules.

### 3. GitHub Labels

- [ ] **Standard labels present.** The 8 ecosystem labels must exist on the repo:
  - `bug` (#d73a4a) — Something isn't working
  - `documentation` (#0075ca) — Docs improvements
  - `feature` (#1D76DB) — Feature specification
  - `infrastructure` (#5319E7) — Cross-cutting infra
  - `now` (#0E8A16) — Currently being worked
  - `next` (#FBCA04) — Next up
  - `future` (#C5DEF5) — Planned, not scheduled
  - `handover` (#F9D0C4) — Timezone bridge summary
- [ ] **No ad-hoc labels.** Any labels beyond the standard 8 + project-specific labels should be justified.
- [ ] **Issues have required labels.** Open issues must have at least one type label and one priority label.

### 4. Commit Format

- [ ] **Conventional commits.** Every commit uses the format: `type: description`
  - Types: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `perf`, `ci`
- [ ] **Commit scope is focused.** Each commit addresses one change. No multi-purpose commits.
- [ ] **Commit messages explain why.** "Fix race condition in session cleanup" not "fix bug".
- [ ] **Co-authored-by present for AI.** If an AI agent contributed, the commit includes `Co-Authored-By: {agent} <noreply@anthropic.com>`.

### 5. PR Structure

- [ ] **PR title is descriptive.** Under 70 characters, starts with type prefix matching the primary commit type.
- [ ] **PR description explains the change.** What was done, why, and how to verify.
- [ ] **Linked issues referenced.** If this PR addresses an issue, it uses `closes #N` or `fixes #N`.
- [ ] **No unrelated changes bundled.** The PR should only contain changes related to its stated purpose.

### 6. Versioning and Releases

- [ ] **Version bump follows semver.**
  - Patch: bug fixes, minor config changes
  - Minor: new features, non-breaking enhancements
  - Major: breaking changes to config, APIs, or protocols
- [ ] **Release format correct.** `{name} vX.Y.Z — Short Description`
- [ ] **Version consistent across files.** arc-manifest.yaml and package.json versions match.

### 7. Naming Conventions

- [ ] **metafactory is lowercase, one word.** Not "Metafactory", not "Meta Factory", not "MetaFactory".
- [ ] **GitHub org is `the-metafactory`.** Repo references use the correct org name.
- [ ] **Repo names use hyphens.** `arc-skill-code-review`, not `arc_skill_code_review`.
- [ ] **Skill names use TitleCase.** `CodeReview`, not `code-review` or `code_review` (in YAML and SKILL.md frontmatter).

---

## Severity Guide

| Finding | Severity |
|---------|----------|
| CLAUDE.md missing or fundamentally stale | **critical** |
| arc-manifest version not bumped with changes | **warning** |
| Missing standard labels on new repo | **warning** |
| Non-conventional commit format | **suggestion** |
| Naming convention inconsistency | **suggestion** |
| Missing co-authored-by on AI-contributed code | **nit** |
