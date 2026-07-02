# SweepReview Workflow

Fix-or-justify sweep — the `--fix` mode of the CodeReview skill. Where every other
workflow **reports** findings and submits a verdict, SweepReview **resolves** each
finding in place: it either fixes it or records an explicit technical justification
for why it stands, then hands the PR back for re-review.

This is the mode the autonomous-work loop invokes per slice (`/code-review --fix`),
and the versioned home of the fix-or-justify contract that compass
`sops/pr-review.md` → "Sweep / --fix mode" points at.

**SweepReview emits NO verdict block and never self-approves.** It ends at "ready
for re-review". It is therefore **exempt** from the "Structured verdict block"
contract that binds FullReview / StandardReview / SecurityReview / HardeningReview
(see `SKILL.md` → "Severity → verdict"). A sweep changes code and answers findings;
deciding the PR's fate is the next review pass's job, not the sweep's.

---

## Pre-flight

Confidentiality is exposure-gated and applies to a sweep exactly as it does to a
review — a fix can introduce a leak, and a justification reply can echo one. So
determine repo exposure first (fail CLOSED — see `Confidentiality.md` →
"Exposure detection"):

```bash
gh repo view {owner}/{repo} --json visibility --jq '.visibility'
# PUBLIC ⇒ exposed. error / rate-limit / timeout / empty / unknown ⇒ treat as EXPOSED.
# arc-shipped (arc-manifest*.yaml at repo root) ⇒ EXPOSED even if private.
```

Then output this status line before proceeding:
```
SOP: pr-review | Mode: sweep (--fix) | PR: {owner/repo}#{N} | exposure={public|arc-shipped|unknown-treated-as-exposed|private} | confidentiality={active|n/a-private} | emits-verdict-block=no
```

---

## Procedure

### Step 1: Assemble the finding set

A sweep works a concrete list of findings. Assemble it from both sources:

1. **Open review feedback on the PR** — unresolved review comments, inline
   comments, and requested changes from prior review passes:
   ```bash
   gh pr view {N} --repo {owner/repo} --json reviews,comments
   gh api repos/{owner}/{repo}/pulls/{N}/comments
   ```
2. **A fresh pass** when invoked without a prior review (or to catch what the
   diff introduced since): read the diff and run the applicable lenses exactly as
   FullReview Steps 1–10 do, recording each finding with `severity`, `lens`,
   `file:line`. Confidentiality is always in the set on an exposed repo.

Deduplicate. Each finding enters the sweep with a severity
(`critical`/`warning`/`suggestion`/`nit`) and a location.

### Step 2: Resolve each finding — fix-or-justify

Work every finding to exactly one of two outcomes. This is the whole contract;
`## The Bar` below defines it precisely.

- **Outcome A — Fix.** Change the code (or doc, or config) so the finding no
  longer holds. Prefer this. Nits **default to A** — a nit is cheaper to fix than
  to argue.
- **Outcome B — Justify.** Leave the finding standing **only** with a specific,
  technical justification for why it is correct as-is. A justification is a claim
  about the code, not a deferral.

Apply the fix (Outcome A) as an actual edit on the PR branch. Record the
justification (Outcome B) as a reply on the finding's thread.

### Step 3: Reply discipline

- One reply per finding, stating the outcome: **A** (what changed, `file:line`)
  or **B** (the technical reason it stands).
- **Rule 0 (never-quote) applies to every sweep reply.** For a confidentiality
  finding, cite the category + `file:line` only — never reproduce the suspected
  literal in a fix commit message, a reply, a summary, or anywhere else the reply
  travels. Route any "is this a real party?" question to the private control
  plane, never a public PR reply.
- No hedging, no "will address later", no "out of scope for now", no punting to a
  follow-up issue **in place of** an outcome. Every finding gets A or B, now.

### Step 4: Push and hand back

Push the fixes to the PR branch, then post a single sweep summary and stop at
**ready for re-review**:

```bash
gh pr comment {N} --repo {owner/repo} --body "## Sweep complete — ready for re-review

Fixed (A): {count}
Justified (B): {count}
{per-finding one-liners: outcome + file:line, confidentiality entries cite category + file:line only}

Handing back for re-review."
```

Do **not** submit a `gh pr review` verdict. Do **not** emit a structured verdict
block. Do **not** self-approve. The sweep's job ends here; a subsequent review
pass decides the verdict.

---

## The Bar

The fix-or-justify contract is **A-or-B only** — there is no third outcome.

- **Outcome A — Fix.** The default. Make the change. **Every nit defaults to A**:
  if a finding is a `suggestion`/`nit`, fix it rather than argue it — justifying a
  nit costs more than fixing it and stalls the loop.
- **Outcome B — Justify.** Permitted only with a **specific technical
  justification** — a concrete claim about why the code is correct as written
  (an invariant the finding missed, a measured trade-off, a false-positive with
  the reason it is false). "Working as intended", "style preference", "later", or
  "I disagree" are **not** justifications. A vague or hand-waved Outcome B is not
  a valid outcome — resolve it as A.
- **No hedge, no defer, no third option.** There is no "acknowledged", no
  "will follow up", no "non-blocking so leaving it". A finding is not resolved
  until it is A or B.

### Confidentiality is not Outcome-B justifiable

A confidentiality **critical** (C1–C6) is **NOT** Outcome-B justifiable. It closes
**only** by:

- **Outcome-A removal** of the offending content from the diff, **or**
- a **linked principal-comment URL** authorising the exception in the private
  control plane.

It **never** closes by a justification reply, and **never** by quoting the value
to argue it is safe. Rule 0 (never-quote) applies to every reply about it. This
mirrors the non-waivable carve-out in `Confidentiality.md` → "Verdict impact" and
compass `sops/pr-review.md` → "Severity → Verdict": a confidentiality critical is
never waivable in report mode, and it is not "justify"-able in sweep mode either.

---

## Output Format

```
## Sweep Review: {owner/repo}#{N}

### Mode
Fix-or-justify (--fix) — no verdict block, no self-approve.

### Findings Resolved
| Outcome | Count |
|---------|-------|
| A (fixed) | {n} |
| B (justified) | {n} |

### Detail
{Per-finding: severity, lens, file:line, outcome (A: what changed / B: technical reason).
 Confidentiality findings cite category + file:line only — never the literal.}

### Status: ready for re-review
{One line — fixes pushed, all findings A-or-B resolved. No verdict issued.}
```
