# CodeQuality Lens

**Always applied.** This is the baseline lens for every PR review. It covers fundamental code health that every change must maintain.

---

## Checklist

### 1. Error Handling

- [ ] **No empty catch blocks.** Every catch must either:
  - (a) Log the error via `process.stderr.write()` or the project's logging system
  - (b) Handle it meaningfully (return a fallback value with a comment explaining why)
  - (c) Name the variable `_err` with a comment explaining why it's safe to ignore
- [ ] **Errors are surfaced, not swallowed.** Callers should know when something fails.
- [ ] **Error messages are descriptive.** Include context: what operation failed, what input caused it, what the caller should do.
- [ ] **No `catch (e) { throw e }` anti-pattern.** Either add context to the error or don't catch it.
- [ ] **Async errors are handled.** Promises have `.catch()` or are in try/catch. No unhandled rejections.
- [ ] **Error types are appropriate.** Don't throw strings. Use Error subclasses where the caller needs to distinguish error types.

### 2. Dead Code and Unused Imports

- [ ] **No unused imports.** Every import is referenced in the file.
- [ ] **No unused variables.** Every declared variable is read. Underscore-prefix (`_unused`) is acceptable only with a comment explaining why.
- [ ] **No unreachable code.** Code after return/throw/break/continue is dead — remove it.
- [ ] **No commented-out code.** If it's not needed, delete it. Git has history.
- [ ] **No TODO comments without issue references.** TODOs must link to a tracked issue or be resolved in this PR.
- [ ] **No leftover debug statements.** `console.log`, `debugger`, `print()` used for debugging must be removed.

### 3. Naming

- [ ] **Variables and functions describe what they hold/do.** `data`, `result`, `temp`, `val` are too vague — name them for their content/purpose.
- [ ] **Boolean variables/functions use is/has/should/can prefixes.** `isValid`, `hasPermission`, not `valid`, `permission`.
- [ ] **Consistent naming convention.** camelCase for variables/functions, PascalCase for types/classes, UPPER_SNAKE for constants. Follow the repo's existing convention.
- [ ] **No abbreviations that obscure meaning.** `btn`, `msg`, `cfg` are acceptable if established in the codebase. New abbreviations should be spelled out.
- [ ] **Function names describe the action.** `getUserById`, not `getUser` when the function takes an ID parameter.

### 4. Code Structure

- [ ] **Functions are focused.** Each function does one thing. If a function has AND in its description, it probably does too much.
- [ ] **No deeply nested conditionals.** More than 3 levels of nesting signals need for extraction or early returns.
- [ ] **Guard clauses over nested if-else.** Return early for edge cases instead of wrapping the main path in conditionals.
- [ ] **No magic numbers/strings.** Literals with non-obvious meaning should be named constants.
- [ ] **Consistent patterns.** If the codebase uses pattern A for similar operations, new code should use pattern A too — not introduce pattern B without justification.
- [ ] **Reasonable function length.** Functions over 50 lines are suspicious. Over 100 lines almost certainly need decomposition.

### 5. Type Safety (TypeScript)

- [ ] **No `any` type.** Use proper types. If truly dynamic, use `unknown` and narrow.
- [ ] **No non-null assertions (`!`) without justification.** Each `!` should have a comment explaining why the value is guaranteed non-null.
- [ ] **No `as any` casts.** `as any` disables all type checking and is almost never justified. If the type system is fighting you, fix the types — don't escape them. Flag every `as any` as a warning.
- [ ] **No type assertions (`as`) without justification.** Prefer type narrowing (type guards, instanceof) over assertions.
- [ ] **Generic types are constrained.** `<T>` should be `<T extends SomeBase>` when a base is known.
- [ ] **Return types are explicit on public functions.** Don't rely on inference for exported functions — explicit return types document the contract.

### 6. Test Coverage

- [ ] **New code has tests.** Every new function, endpoint, or behavior should have at least one test.
- [ ] **Tests cover the happy path and at least one error path.** Don't just test success — test what happens when things fail.
- [ ] **Existing tests are not removed without reason.** If tests are deleted, the PR description should explain why.
- [ ] **Test names describe the behavior being tested.** `"returns 404 when user not found"`, not `"test getUserById"`.
- [ ] **No flaky test indicators.** `setTimeout` in tests, `.only`, `.skip` without issue reference, random data without seeding.

### 7. Commit Hygiene

- [ ] **Conventional commit format.** `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:` prefixes.
- [ ] **Focused commits.** Each commit does one thing. No "fix bug and add feature and update docs" in one commit.
- [ ] **No unrelated changes.** The PR should not include formatting changes, dependency updates, or refactors unrelated to the stated purpose.
- [ ] **Meaningful commit messages.** Messages explain WHY, not just WHAT. "Fix race condition in session cleanup" not "fix bug".

### 8. Code Duplication

- [ ] **No copy-pasted blocks.** If the same logic appears in 2+ places in the PR, extract it. Three similar lines is fine — three similar paragraphs is not.
- [ ] **No re-implementation of existing utilities.** Check if the codebase already has a function that does what the new code does.
- [ ] **Repeated patterns across files signal a missing abstraction.** If multiple files follow the same boilerplate sequence, consider whether a shared helper or base class is warranted.
- [ ] **DRY applies to knowledge, not just code.** Two functions with similar-looking code that serve different purposes and will evolve independently are NOT duplication — forced extraction would create coupling.

### 9. Linting

Echo reads the **CI lint gate**, she does not run the linter herself. CI is what actually blocks merge; running a separate local lint would risk disagreeing with CI (different config resolution, different `node_modules`) and would mean Echo executing arbitrary PR code via `bun install` postinstall hooks. The CI-output path is cheap, safe, and matches the gate that gates the PR.

**The whole section is conditional on a lint gate existing.** Decide once at the top, then proceed.

#### Step 0 — Detect the lint gate

Three states. Decide which one this repo is in *before* doing anything else, and state it in the review header:

1. **`lint gate: ci` (full gate)** — both of the following are true:
   - `package.json` has a `lint` script *or* a known config exists at the repo root (`eslint.config.js`, `eslint.config.ts`, `eslint.config.mjs`, `biome.json`, `.eslintrc*`, `.eslintrc.cjs`).
   - The PR has a CI check whose name matches `/lint/i` (case-insensitive). Detect via `gh pr checks {N} --repo {owner/repo}` and scan the `Name` column.

2. **`lint gate: local-only`** — lint script or config exists, but no `/lint/i` check is present on the PR. Lint is configured but unenforced. Note it in the header, optionally flag it as a **suggestion** ("repo has lint config but no CI gate"), and **skip the CI-output checks** below. Do not run lint locally — that's out of scope for review mode.

3. **`lint gate: none`** — neither a lint script nor a known config file exists. State `lint gate: none` in the review header and **skip the rest of this section entirely**. Do not invent findings about missing lint; that belongs in an ecosystem-level discussion, not a per-PR review. (arc, meta-factory currently fall here.)

Lookup commands for the detection step:
```bash
# Does the repo have a lint script in package.json?
gh api repos/{owner}/{repo}/contents/package.json \
  --jq '.content' | base64 -d | jq -r '.scripts.lint // "none"'

# Does the repo have a known lint config at root?
gh api repos/{owner}/{repo}/contents \
  --jq '[.[] | .name] | map(select(test("^(eslint\\.config\\.|biome\\.json$|\\.eslintrc)"))) | .[]'

# Is there a CI check on this PR whose name matches /lint/i?
# Note the parens around each test() call — `or` does not bind tighter than `|`,
# so without them the second test would consume the result of the first.
# Also guard against the empty-checks case: `gh pr checks` exits non-zero with
# plain text "no checks reported on the '<branch>' branch" when a PR has not
# yet triggered any workflow runs (e.g. PRs opened before the lint workflow
# existed, draft PRs, PRs gated by a path filter). Treat that as "no CI lint
# check" and fall through to state 2.
gh pr checks {N} --repo {owner/repo} --json name,state,bucket,workflow 2>/dev/null \
  | jq '.[] | select((.name | test("lint"; "i")) or (.workflow | test("lint"; "i")))'
```

The `gh pr checks --json` shape returned by each entry is:
- `name` — job name (e.g. `Lint`, `lint`, `Lint, Typecheck & Unit Tests`). Match case-insensitively.
- `workflow` — workflow file's display name. Match this too — cortex calls the job `Lint` inside `ci.yml` (workflow name = `CI`), myelin has a dedicated workflow named `Lint, Typecheck & Unit Tests` with job name `lint`. Matching both fields catches both patterns.
- `state` — one of `SUCCESS`, `FAILURE`, `IN_PROGRESS`, `PENDING`, `SKIPPED`, `NEUTRAL`, `CANCELLED`.
- `bucket` — coarser grouping: `pass`, `fail`, `pending`, `skipping`. Use this for the simple "did it pass" check; use `state` when you need to distinguish in-progress from pending.

If state 2 or 3, you're done with this section. Move on.

#### Steps 1-5 — Only when `lint gate: ci`

- [ ] **CI lint job result.** Map `state` to a finding:
  - `state: FAILURE` (or `bucket: fail`) → **critical** finding. The PR cannot merge until the gate is green. Pull the actual lint output (next step) so the author doesn't have to dig.
  - `state: IN_PROGRESS` / `PENDING` (or `bucket: pending`) → **suggestion** ("lint result pending"). Note it, do not pretend you verified what's not there, and re-check at re-review time.
  - `state: SUCCESS` (or `bucket: pass`) → green check, move on.
- [ ] **New violations on touched lines only.** When the lint job failed, locate the failing job and read its log. **Use `--log` (full), not `--log-failed`** — `--log-failed` only contains the workflow's terminal `##[error]Process completed with exit code 1.` marker, not the eslint output that preceded it. The eslint violations live in the step's stdout, which `--log-failed` strips.
  ```bash
  # The link on the failing check has the form
  # https://github.com/{owner}/{repo}/actions/runs/{run-id}/job/{job-id}
  gh pr checks {N} --repo {owner/repo} --json name,state,link 2>/dev/null \
    | jq -r '.[] | select((.name | test("lint"; "i"))) | .link'

  # Extract run-id (integer after /runs/) and job-id (integer after /job/), then
  # pull the lint job's full log. The --job filter scopes output to that job only.
  gh run view {run-id} --repo {owner/repo} --log --job={job-id}
  ```

  Each log line is tab-separated and prefixed: `{job_name}\t{step_name}\t{ISO_timestamp} {content}`. Strip the prefix before pattern-matching eslint output:
  ```bash
  gh run view {run-id} --repo {owner/repo} --log --job={job-id} \
    | awk -F'\t' '$2 ~ /ESLint|Lint|lint/ {sub(/^[0-9TZ:.-]+ /, "", $3); print $3}' \
    | grep -E '^\s*[^:[:space:]]+:[0-9]+:[0-9]+'
  ```
  eslint's default formatter emits `<file>:<line>:<col>  <severity>  <message>  <rule-id>`. Biome's default emits `<file>:<line>:<col> <severity>: <message>`. Cross-reference each `<file>:<line>` pair against the PR's diff:
  ```bash
  gh pr diff {N} --repo {owner/repo} | grep -E '^(\+\+\+ |@@)' | head -200
  ```
  Only flag violations on lines this PR added or modified — pre-existing lint debt on untouched lines is not this PR's problem. An eslint/biome error on a touched line is a **warning** finding (or **critical** if the gate being red is solely due to violations in this PR's diff). If the gate is red due to a *non-lint reason* upstream (bun install failure, missing system dep, runner cache miss), that's still **critical** but report it as an infrastructure finding rather than a code-quality finding — Echo's review is about code, not the CI runner's pantry.
- [ ] **No `eslint-disable` / `biome-ignore` comments without justification.** Inline (`// eslint-disable-next-line <rule>`, `// biome-ignore <rule>`) and file-level (`/* eslint-disable */`) disables added in this PR must each carry a one-line comment explaining *why* the rule is being suppressed. Drive-by disables to silence the gate are a discipline regression — flag every undocumented one as **warning**.
- [ ] **No silent lint-config relaxation.** Diffs that touch `eslint.config.*`, `tsconfig.eslint.json`, `.eslintrc*`, or `biome.json` and downgrade a rule (`error → warn`, `warn → off`) or remove a rule entirely are a structural change to the quality bar. Each downgrade is a **warning** finding even if the diff line count is tiny; the author must justify each in the PR description, not bury it in a config change.
- [ ] **Auto-fix loops are not reviews.** If the PR title or body claims `lint --fix` was run, still read the resulting diff line-by-line. `--fix` can rewrite semantics (e.g. reordering imports across side-effectful modules, collapsing method chains). The lint gate going green does not mean the diff is correct.

---

## Severity Guide

| Finding | Severity |
|---------|----------|
| Empty catch block in error path | **critical** |
| Swallowed errors hiding failures | **critical** |
| Unused code that adds confusion | **warning** |
| Missing tests for new code | **warning** |
| Vague naming that obscures intent | **suggestion** |
| Minor style inconsistency | **nit** |
| `as any` cast | **warning** |
| Unnecessary type assertion | **suggestion** |
| TODO without issue reference | **suggestion** |
| Copy-pasted block with 3+ similar lines | **warning** |
| Re-implementation of existing utility | **warning** |
| Forced extraction creating coupling | **nit** (don't flag) |
| CI lint job failing on this PR (`lint gate: ci`) | **critical** |
| New eslint/biome error on a line this PR touches | **warning** |
| New eslint/biome warning on a line this PR touches | **suggestion** |
| `eslint-disable` / `biome-ignore` added without justification comment | **warning** |
| Lint config rule downgrade (`error → warn → off`) without rationale | **warning** |
| Lint check pending / not yet run | **suggestion** (note, don't block) |
| Pre-existing lint error on a line this PR did not touch | not flagged |
| Repo has lint config but no CI gate (`lint gate: local-only`) | **suggestion** (optional, note in header) |
| Repo has no lint script or config (`lint gate: none`) | not flagged (state `lint gate: none`) |
