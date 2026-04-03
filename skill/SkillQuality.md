# Skill Quality Lens

**Activated when:** SkillReview workflow is invoked. Evaluates a Claude Code skill against structure, discoverability, activation reliability, and authoring best practices.

---

## Checklist

### SK-01: SKILL.md Structure

- [ ] **Frontmatter present and valid.** YAML frontmatter contains `name` and `description` fields. `name` is lowercase, hyphens only, max 64 chars, no `anthropic` or `claude` in name.
- [ ] **Under 500 lines.** SKILL.md acts as a router/menu, not a monolith. Detailed instructions live in referenced files.
- [ ] **Clear section headers.** Has identifiable sections for instructions, workflow routing, and examples. Uses markdown headers (##) for scanability.
- [ ] **No deeply nested references.** Referenced files are at most one level from SKILL.md. No chains like SKILL.md -> A.md -> B.md -> actual content.

### SK-02: Description Quality

- [ ] **Third person only.** Description uses "Processes...", "Generates...", not "I can help you..." or "You can use this to...". First/second person causes discovery problems.
- [ ] **Under 1024 characters.** Hard limit on the description field.
- [ ] **Two-part structure.** Description answers BOTH: (1) what the skill does (capability statement), and (2) when to use it (trigger conditions).
- [ ] **USE WHEN patterns present.** Description includes explicit "USE WHEN" or "Use when" trigger language with specific keywords from real user requests.
- [ ] **5+ trigger keywords.** Enough specific terms for reliable discovery across varied phrasings.
- [ ] **Specific over generic.** Terms like "review PR", "code review", "security audit" — not vague terms like "helps with code" or "processes data".

### SK-03: Activation Triggers

- [ ] **Workflow routing table present.** Clear mapping from user intent to workflow file, so the skill knows which path to take.
- [ ] **Triggers match real phrasings.** Trigger keywords reflect how users actually phrase requests, not how the skill author thinks about it.
- [ ] **No overlapping triggers.** Each workflow has distinct trigger conditions. Ambiguous requests have a clear default.
- [ ] **Default workflow identified.** When the user's request matches the skill but not a specific workflow, a default is defined.

### SK-04: Examples

- [ ] **Examples present.** At least 2 concrete examples showing user input -> skill behavior -> expected output.
- [ ] **Examples longer than rules.** Examples section has more content than the rules/instructions section. Claude learns from examples, not descriptions.
- [ ] **Show realistic scenarios.** Examples use real-looking data (PR numbers, file paths, actual commands), not abstract placeholders.
- [ ] **Cover common variations.** Examples demonstrate different workflows or modes, not just the happy path.
- [ ] **Multi-turn shown if applicable.** If the skill involves back-and-forth (search then load, review then fix), examples show the full sequence.

### SK-05: Progressive Disclosure

- [ ] **Three-level loading respected.** Level 1 (name + description) is always loaded. Level 2 (SKILL.md body) loads on trigger. Level 3 (referenced files) loads on demand.
- [ ] **Heavy content in referenced files.** Detailed checklists, long procedures, templates, and reference tables live in separate files, not inline in SKILL.md.
- [ ] **References use Read-friendly paths.** File references use relative paths from the skill root that Claude can resolve with the Read tool.
- [ ] **No unnecessary eager loading.** SKILL.md doesn't embed content that's only needed for specific workflows.

### SK-06: Folder Structure

- [ ] **Logical organization.** Files are grouped by purpose: workflows in a Workflows/ directory, reference docs separate, scripts separate.
- [ ] **No orphaned files.** Every file in the skill directory is referenced from SKILL.md or a workflow file.
- [ ] **Consistent naming.** Files follow a consistent naming convention (PascalCase, kebab-case, etc.) within the skill.
- [ ] **No deeply nested directories.** Skill content is at most two directories deep from the skill root.

### SK-07: Boundaries and Scope

- [ ] **Out of scope defined.** Skill explicitly states what it does NOT do, preventing misactivation.
- [ ] **No time-sensitive information.** No "if before date X, use old API" patterns. Use versioned sections or old-patterns sections instead.
- [ ] **Consistent terminology.** Same concept uses the same term throughout. No mixing "lens"/"check"/"rule" for the same thing.
- [ ] **Clear ownership.** Skill has identifiable author or maintainer (in manifest or frontmatter).

### SK-08: Anti-Patterns

- [ ] **No vague triggers.** Description doesn't use generic terms that match too many requests ("helps with files", "processes data").
- [ ] **No tool overload.** Skill doesn't offer too many choices without guidance ("use pypdf, or pdfplumber, or PyMuPDF, or...").
- [ ] **No instruction bloat.** SKILL.md doesn't over-explain concepts Claude already knows. Each paragraph justifies its token cost.
- [ ] **No embedded secrets or env-specific paths.** Skill doesn't hardcode API keys, user directories, or machine-specific paths.

---

## Severity Guide

| Finding | Severity |
|---------|----------|
| Missing or empty description | **critical** |
| No examples in SKILL.md | **critical** |
| SKILL.md over 500 lines with no progressive disclosure | **warning** |
| Description in first/second person | **warning** |
| No USE WHEN patterns in description | **warning** |
| Description over 1024 characters | **warning** |
| No out-of-scope boundaries | **warning** |
| Fewer than 2 examples | **warning** |
| Deeply nested file references (3+ levels) | **warning** |
| Vague trigger keywords | **warning** |
| Overlapping workflow triggers | **suggestion** |
| Examples shorter than rules | **suggestion** |
| Inconsistent file naming | **suggestion** |
| Missing workflow routing table | **suggestion** |
| Orphaned files not referenced | **nit** |
| Time-sensitive information present | **nit** |
