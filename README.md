# code-review

Multi-lens PR review skill for Claude Code. Applies targeted review lenses based on what a PR actually touches, then posts findings as inline PR comments with severity tags and a verdict.

## Install

```bash
arc install code-review
```

## Usage

```
review PR #42                    # Standard review — auto-detects which lenses to apply
security review on PR #42        # Security-focused — CodeQuality + full OWASP Top 10
full review PR #42               # Comprehensive — all 5 lenses applied
```

## Lenses

| Lens | Description | Auto-activated by |
|------|-------------|-------------------|
| **CodeQuality** | Empty catches, dead code, naming, error handling, tests, commit hygiene | Always applied |
| **Security** | OWASP Top 10: injection, auth, data exposure, input validation, dependencies | Auth, input, API, DB code |
| **Architecture** | SRP, coupling, pattern consistency, abstraction level, API surface | New files, modules, structure changes |
| **EcosystemCompliance** | CLAUDE.md, arc-manifest, labels, SOP table, conventional commits | Config, manifest, docs changes |
| **Performance** | N+1 queries, unbounded ops, pagination, memory, blocking in async | DB queries, hot paths, data processing |

## How It Works

1. Reads the full PR diff via `gh pr diff`
2. Detects what changed and selects relevant lenses
3. Applies each lens checklist against the diff
4. Posts findings as inline PR comments with `[severity/lens]` tags
5. Posts a verdict: approve, request-changes, or comment

## License

MIT
