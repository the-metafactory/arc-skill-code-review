# arc-skill-code-review — Multi-lens PR review skill

Multi-lens pull request review skill for Claude Code. Provides automated code quality, security, architecture, ecosystem compliance, and performance review with content-aware lens auto-selection.

## Architecture

```
skill/
  SKILL.md              — Skill entry point, routing table, frontmatter
  CodeQuality.md        — Code quality lens (always applied)
  Security.md           — Security lens (OWASP Top 10)
  Architecture.md       — Architecture lens (structural review)
  EcosystemCompliance.md — Ecosystem compliance lens (metafactory standards)
  Performance.md        — Performance lens (hot paths, queries, memory)
  Workflows/
    StandardReview.md   — Content-aware auto-selection review
    SecurityReview.md   — Focused security + code quality review
    FullReview.md       — All 5 lenses applied
prompt/
  review-pr.md          — `/review-pr` slash-command prompt (spawns fresh-context sub-agent to run this skill against a PR)
```

- `skill/SKILL.md` — Entry point. YAML frontmatter for skill activation, workflow routing table, lens selection logic.
- `skill/Workflows/*.md` — Executable workflow files. Each defines a step-by-step review procedure.
- `skill/*.md` (non-SKILL) — Lens reference documents. Loaded on-demand by workflows. Each contains a detailed checklist for one review perspective.
- `prompt/*.md` — Slash-command prompts distributed alongside the skill. Consumed by Claude Code as user commands (e.g., `/review-pr`).

## SOP Activation

| SOP | When |
|-----|------|
| `compass/sops/pr-review.md` | Every PR review (this skill implements the SOP) |
| `compass/sops/dev-pipeline.md` | Contributing to this repo |
| `compass/sops/versioning.md` | Releasing new versions |

## Naming

- **metafactory** — always lowercase, one word. Not "Metafactory", not "Meta Factory".
- **arc** — lowercase. The package manager for PAI artifacts.

## GitHub Labels (ecosystem standard)

| Label | Color | Purpose |
|-------|-------|---------|
| `bug` | `#d73a4a` | Something isn't working |
| `documentation` | `#0075ca` | Docs improvements |
| `feature` | `#1D76DB` | Feature specification |
| `infrastructure` | `#5319E7` | Cross-cutting infra work |
| `now` | `#0E8A16` | Currently being worked |
| `next` | `#FBCA04` | Next up after current work |
| `future` | `#C5DEF5` | Planned but not yet scheduled |
| `handover` | `#F9D0C4` | Timezone bridge summary |

## Critical Rules

- NEVER describe code you haven't read. Verify before making claims.
- Fix ALL errors found during type checks, tests, or linting.
- NEVER use empty catch blocks.
- Check open PRs and issues before starting work.
