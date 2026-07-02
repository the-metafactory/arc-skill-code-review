# SkillReview Workflow

Evaluates a Claude Code skill against authoring best practices — structure, discoverability, activation reliability, progressive disclosure, and examples quality. Reports what's well-built, what's missing, and what hurts activation rates. Also runs the Confidentiality lens over the skill's files when the skill ships from an exposed repo — skills (agent fragments, personas, example content) are a primary leak vector, so this flavor is not exempt.

---

## Pre-flight

Skills are reviewed by path, not by PR, so exposure is derived from the skill's **containing repo** (fail CLOSED — see `Confidentiality.md` → "Exposure detection"):

```bash
# Derive the skill's repo from its git remote; map to owner/repo; check visibility.
REMOTE=$(git -C {skill-root-path} remote get-url origin 2>/dev/null)
# If REMOTE resolves to a GitHub repo, check it; otherwise fail closed.
gh repo view "{owner}/{repo}" --json visibility --jq '.visibility' 2>/dev/null
# PUBLIC ⇒ exposed. Not in a git repo / no remote / error / rate-limit / unknown ⇒ treat as EXPOSED.
# A skill dir carrying arc-manifest*.yaml (arc-shipped) ⇒ EXPOSED even if the repo is private.
```

Output this status line before proceeding:
```
SOP: skill-review | Skill: {skill-name} | Path: {skill-root-path} | exposure={public|arc-shipped|unknown-treated-as-exposed|private} | confidentiality={active|n/a-private}
```

---

## Procedure

### Step 1: Locate and Read the Skill

Identify the skill to review. The user may provide:
- A path to the skill directory
- A skill name (search `~/.claude/skills/` and `.claude/skills/`)
- "this skill" (review the skill in the current working directory)

```bash
# List skill contents
ls -la {skill-root}/
ls -la {skill-root}/Workflows/ 2>/dev/null || true
ls -la {skill-root}/docs/ 2>/dev/null || true
```

Read the SKILL.md file completely. Note the line count — this is needed for SK-01.

### Step 2: Read All Referenced Files

Read every file referenced from SKILL.md:
- Workflow files
- Lens/checklist files
- Template files
- Script files

Also note any files in the skill directory that are NOT referenced from SKILL.md (orphaned files).

If the skill has an `arc-manifest.yaml`, read that too for trigger and capability declarations.

### Step 3: Run SkillQuality Lens

Load `SkillQuality.md` from the skill root and apply its complete checklist.

**Work through each category systematically:**

For each category (SK-01 through SK-08):
1. Determine if the category is applicable
2. Check every item in the category's checklist
3. For each item: record whether it **passes**, **fails**, or is **partially met**
4. Include specific evidence — quote the actual description text, count the actual line numbers, name the actual files

**Key assessments to make:**

**Description analysis (SK-02):**
- Extract the exact description text
- Check point of view (first/second/third person)
- Count characters
- List all trigger keywords found
- Assess specificity vs vagueness

**Examples analysis (SK-04):**
- Count examples
- Measure examples section length vs rules section length
- Assess whether examples use concrete data or abstract placeholders

**Progressive disclosure (SK-05):**
- Map the loading chain: what loads at Level 1, Level 2, Level 3
- Identify any heavy content that should be in referenced files but is inline

Record findings with severity, category tag, location, finding, and fix.

### Step 4: Run Confidentiality Lens

Load `Confidentiality.md` from the skill root and apply the full C1–C6 checklist to the skill's own files (the SKILL.md + every referenced file read in Steps 1–2). Skills are a primary leak vector — agent fragments, personas, and example content are exactly the material the confidentiality controls exist to catch.

- If the skill's containing repo is **not exposed** (confirmed private and not arc-shipped), record `confidentiality=n/a-private` and skip to Step 5.
- Otherwise (exposed, arc-shipped, or unknown-treated-as-exposed per the pre-flight check), run the lens.
- **Rule 0 (never-quote) applies:** cite category + `file:line` only, never the suspected literal. Route "is this a real party?" questions to the private control plane, never a public surface.

Record findings: severity, lens=confidentiality, file/line, category (C1–C6), finding (never the literal), fix.

### Step 5: Activation Assessment

Based on the description quality and trigger patterns, estimate the skill's activation tier:

| Tier | Expected Rate | Characteristics |
|------|--------------|-----------------|
| **Unoptimized** | ~20% | Vague description, no USE WHEN, no examples |
| **Basic** | ~50% | Specific description with USE WHEN patterns |
| **Good** | ~72% | USE WHEN + concrete examples |
| **Excellent** | ~84%+ | USE WHEN + examples + mandatory gates/hooks |

Explain which tier the skill falls into and what would move it to the next tier.

### Step 6: Post Findings

**Summary output:**

```
## Skill Review: {skill-name}

### Skill Quality Assessment
| Category | Status | Findings |
|----------|--------|----------|
| SK-01 Structure | {pass/partial/fail} | {count} |
| SK-02 Description | {pass/partial/fail} | {count} |
| SK-03 Activation Triggers | {pass/partial/fail} | {count} |
| SK-04 Examples | {pass/partial/fail} | {count} |
| SK-05 Progressive Disclosure | {pass/partial/fail} | {count} |
| SK-06 Folder Structure | {pass/partial/fail} | {count} |
| SK-07 Boundaries & Scope | {pass/partial/fail} | {count} |
| SK-08 Anti-Patterns | {pass/partial/fail} | {count} |
| Confidentiality (C1–C6) | {active/n-a-private/findings} | {count} |

### Activation Tier: {tier} (~{rate}% expected)
{What would improve activation to next tier}

### Findings
| Severity | Count | Category |
|----------|-------|----------|
| critical | {n} | {categories} |
| warning | {n} | {categories} |
| suggestion | {n} | {categories} |
| nit | {n} | {categories} |

### Detail
{Per-finding: severity, category, location, finding, fix}

### Verdict: {well-built / needs-work / major-gaps}
{Overall quality assessment — is this skill reliable, discoverable, and maintainable?}
```

---

## Verdict Criteria

- **Well-built** if all categories pass or partially pass, activation tier is Good or Excellent, and no critical/warning findings
- **Needs-work** if 1-2 categories fail OR activation tier is Basic OR 2+ warning findings
- **Major-gaps** if 3+ categories fail OR activation tier is Unoptimized OR any critical findings
- **Confidentiality criticals are never waivable.** Any confidentiality critical (C1–C6) forces **major-gaps** regardless of quality-category scores, and cannot be reclassified up; it clears only by removal of the offending content or a linked principal-comment URL authorising the exception — never by quoting the value to argue it is safe.

---

## Output Format

```
## Skill Review: {skill-name}

### Categories
{Category-by-category results, including Confidentiality (C1–C6) — active/n-a-private}

### Activation Tier: {tier}
{Assessment and improvement path}

### Findings Summary
| Severity | Count | Category |
|----------|-------|----------|
| critical | {n} | {categories} |
| warning | {n} | {categories} |
| suggestion | {n} | {categories} |
| nit | {n} | {categories} |

### Verdict: {well-built / needs-work / major-gaps}
{Is this skill reliable, discoverable, and maintainable for its intended use cases?}
```
