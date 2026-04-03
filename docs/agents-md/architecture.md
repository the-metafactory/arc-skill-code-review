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
