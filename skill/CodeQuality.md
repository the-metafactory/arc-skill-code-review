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
| Unnecessary type assertion | **suggestion** |
| TODO without issue reference | **suggestion** |
