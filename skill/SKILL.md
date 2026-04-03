---
name: CodeReview
description: Multi-lens pull request review with automated findings. USE WHEN review PR, code review, security review, audit PR, check PR, OWASP review, architecture review, review for security, full review, hardening review, API hardening, defensive review, skill review, review skill, evaluate skill.
---

# CodeReview

Multi-lens PR review skill with content-aware auto-selection. Applies code quality, security, architecture, ecosystem compliance, and performance lenses based on what the PR actually touches.

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

## Lens Selection Logic

**StandardReview** reads the full diff, then auto-detects which lenses to apply based on what changed. CodeQuality is always included.

| PR touches... | Auto-activate lenses |
|---------------|---------------------|
| Any code | CodeQuality (always) |
| User input, auth, API endpoints, DB queries | + Security |
| New files, new modules, directory changes | + Architecture |
| CLAUDE.md, arc-manifest.yaml, labels, repo config | + EcosystemCompliance |
| Database queries, hot paths, data processing loops | + Performance |

**SecurityReview** applies CodeQuality + Security lenses regardless of content, plus duplication analysis.

**HardeningReview** applies CodeQuality + Security (targeted) + Hardening lenses, plus duplication analysis. Checks for defensive infrastructure patterns rather than exploitable vulnerabilities.

**SkillReview** applies the SkillQuality lens to evaluate a Claude Code skill against authoring best practices. Not part of FullReview — standalone workflow invoked on request.

**FullReview** applies all 6 lenses sequentially (does not include SkillReview — that's a separate workflow).

**All workflows** finish with a Code Duplication analysis step that compares the PR's new code against the entire repository, not just the diff. This catches re-implemented utilities and copy-paste from existing code that per-file lens checks miss.

## Lens Reference Files

Each lens is a detailed checklist loaded on-demand by workflows:

- `CodeQuality.md` — Empty catches, dead code, naming, error handling, test coverage
- `Security.md` — OWASP Top 10: injection, auth, data exposure, input validation, dependencies
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
-> Posts verdict (approve/request-changes/comment)
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
-> Applies all 6 lenses sequentially
-> Posts findings organized by lens
-> Summary comment with lens-by-lens results
-> Verdict based on aggregate findings
```
