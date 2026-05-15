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

The repo runs an enforced lint gate iff `package.json` has a `lint` script *or* a known config exists at the root (`eslint.config.js`, `eslint.config.ts`, `biome.json`, `.eslintrc*`). Detect once, then act.

- [ ] **Lint gate detected.** Confirm via `gh api repos/{owner}/{repo}/contents/package.json` (or read the PR's working copy) which lint command this repo runs. State it in the review header — e.g. `lint gate: bun run lint (eslint)`. If no script or config is present, say so explicitly (`lint gate: none`) and skip the rest of this section.
- [ ] **CI lint job is green on the PR head.** Look up the lint check:
  ```bash
  gh pr checks {N} --repo {owner/repo}
  # When you need the run ID for log retrieval:
  gh run list --branch {headRefName} --workflow Lint --limit 1 --repo {owner/repo} \
    --json databaseId,conclusion,status
  ```
  Map the result:
  - `conclusion: failure` → **critical** finding. The PR cannot merge until the gate is green. Pull the actual eslint output so the author doesn't have to dig.
  - `status: in_progress` or check not yet run → note as **suggestion** ("lint result pending") and proceed; do not pretend you verified what's not there.
  - `conclusion: success` → green check, move on.
- [ ] **New violations on touched lines only.** When the lint job failed, read its log and cross-reference each violation against the PR's diff:
  ```bash
  gh run view {run-id} --repo {owner/repo} --log-failed
  ```
  An eslint error on a line this PR added or modified is a **warning** finding (or **critical** if it's the actual reason the gate is red). Pre-existing eslint debt on untouched lines is *not* this PR's problem — do not flag it. Echo's review is about what this diff introduces, not the repo's historical lint backlog.
- [ ] **No `eslint-disable` comments without justification.** Inline (`// eslint-disable-next-line <rule>`) and file-level (`/* eslint-disable */`) disables added in this PR must each carry a one-line comment explaining *why* the rule is being suppressed. Drive-by disables to silence the gate are a discipline regression — flag every undocumented one as **warning**.
- [ ] **No silent lint-config relaxation.** Diffs that touch `eslint.config.*`, `tsconfig.eslint.json`, `.eslintrc*`, or `biome.json` and downgrade a rule (`error → warn`, `warn → off`) or remove a rule entirely are a structural change to the quality bar. Each downgrade is a **warning** finding even if the diff line count is tiny; the author must justify each in the PR description, not bury it in a config change.
- [ ] **Auto-fix loops are not reviews.** If the PR title or body claims `lint --fix` was run, still read the resulting diff line-by-line. `--fix` can rewrite semantics (e.g. reordering imports across side-effectful modules, collapsing chains). The lint gate going green does not mean the diff is correct.

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
| CI lint job failing on this PR | **critical** |
| New eslint error on a line this PR touches | **warning** |
| New eslint warning on a line this PR touches | **suggestion** |
| `eslint-disable` added without justification comment | **warning** |
| Lint config rule downgrade (`error → warn → off`) without rationale | **warning** |
| Lint check pending / not yet run | **suggestion** (note, don't block) |
| Pre-existing eslint error on a line this PR did not touch | not flagged |
| Repo has no lint script or config | not flagged (state `lint gate: none`) |
