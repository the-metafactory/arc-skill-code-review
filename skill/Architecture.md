# Architecture Lens

**Activated when:** PR adds new modules, changes directory structure, introduces new patterns, modifies core abstractions, or changes public API surfaces. Always applied in FullReview workflow.

---

## Checklist

### 0. Load canonical architecture docs (FIRST)

**Reuse, don't re-fetch (compass#98 F9).** In every workflow-driven review (`FullReview.md`, `StandardReview.md`), the canonical docs below are already fetched, parsed, and cached by the workflow-level **Step 0** — which runs before lens detection, so it fires whether or not the Architecture lens itself activates. When this lens runs as part of one of those workflows, reuse that cached content; do not re-fetch. Only perform the fetch described below when this lens is invoked standalone, outside a workflow that already ran its Step 0.

**Before applying any heuristic checklist item below**, load the target repo's own architecture source-of-truth documents. Later checklist items will cross-check the diff against these docs; heuristics §§1–7 remain the fallback whenever canonical docs are absent.

Load `ArchitectureDocs.md` from the skill root for the full protocol. The summary:

- [ ] **Fetch canonical docs** from the target repo (not this skill's repo):
  - `CONTEXT.md` (bounded-context glossary — **grill-with-docs** output)
  - `docs/architecture.md` (layered model + componentisation)
  - `compass/ecosystem/CONTEXT-MAP.md` (cross-context reconciliation — ecosystem repos only)
  - Optional: `docs/design-*.md` only when cited from `docs/architecture.md`
- [ ] **Cache loaded docs** for the duration of this review session — multiple lens passes must not re-fetch.
- [ ] **Parse glossary entries** from `CONTEXT.md` (and `CONTEXT-MAP.md` when present) — every `**Term**:` block with its definition + `_Avoid_:` alias list, tagged with section + source line. See `ArchitectureDocs.md` §§2–3 for the parser contract.
- [ ] **Parse layer + boundary rules** from `docs/architecture.md` — the layer table (M1–M7 or equivalent) plus boundary sentences containing `does NOT`, `never`, `must not`, `owns no`, `belongs at`, `consumes`. See `ArchitectureDocs.md` §4.
- [ ] **Cross-check the diff** against the parsed rules: Avoid-alias use, cross-layer imports in the wrong direction, new responsibilities contradicting documented roles. Each finding MUST cite the source doc + line. See `ArchitectureDocs.md` §§5–6.
- [ ] **Emit provenance line** in the lens output, even when no docs were found. Canonical shape — every doc gets a `(loaded)` or `(not-found)` parenthesized state token, comma-separated:
  - Loaded: `architecture-docs: CONTEXT.md (loaded), docs/architecture.md (loaded), CONTEXT-MAP.md (not-found)`
  - Fallback (zero docs): `architecture-docs: CONTEXT.md (not-found), docs/architecture.md (not-found), CONTEXT-MAP.md (not-found) — running legacy heuristic checklist only`
  - Use hyphenated `(not-found)` everywhere. Never `(missing)`, `none-found`, or bare tokens. See `ArchitectureDocs.md` §1.

When none of the canonical docs are present, **fall back to the heuristic checklist (§§1–7) unmodified**. This is the no-regression guarantee for older repos that have not yet been through a grill-with-docs session.

### 1. Single Responsibility Principle

- [ ] **Each module has one reason to change.** A file that handles HTTP routing AND database queries AND email sending violates SRP.
- [ ] **Each function has one purpose.** If a function name contains "and" (even implicitly), it probably does too much. A function must have exactly one responsibility — not "fetch and transform" or "validate and save".
- [ ] **Functions are under 25 lines.** Functions longer than 25 lines should be broken into smaller, well-named functions. Each extracted function should represent a single logical step.
- [ ] **Side effects are contained.** Functions that compute values should not also write to disk, send network requests, or mutate global state. Separate pure logic from I/O.
- [ ] **Configuration is separated from logic.** Hardcoded values that may vary between environments should be in configuration, not in business logic.

### 2. Coupling Analysis

- [ ] **No circular dependencies.** Module A should not import from Module B if Module B already imports from Module A (directly or transitively).
- [ ] **Minimal cross-module imports.** New code should depend on as few other internal modules as possible. High fan-out (importing many modules) signals a god-module.
- [ ] **Stable dependencies principle.** Modules that change frequently should depend on modules that change rarely — not the other way around.
- [ ] **Interface segregation.** If a module imports another module but only uses one function, consider whether the dependency is justified or if the function should be relocated.
- [ ] **No implicit coupling.** Modules should not depend on each other through shared mutable state, global variables, or assumed execution order.

### 3. Pattern Consistency

- [ ] **Follows existing patterns.** If the codebase uses pattern A for similar operations (e.g., error handling, API routing, data access), new code should use the same pattern.
- [ ] **New patterns are justified.** If a new pattern is introduced, the PR description should explain why the existing pattern doesn't work for this case.
- [ ] **No mixed paradigms.** Don't mix callback-style and promise-style in the same module. Don't mix OOP and functional approaches inconsistently.
- [ ] **Consistent file organization.** New files should follow the same structure as existing files in the same directory (exports at top/bottom, type definitions location, etc.).
- [ ] **Naming conventions match.** If existing services are named `{thing}-service.ts`, new services should follow the same convention — not `{thing}Manager.ts` or `{thing}Handler.ts`.

### 4. Abstraction Level

- [ ] **No premature abstraction.** Don't create interfaces, base classes, or generics for something that only has one implementation. Wait for the second use case.
- [ ] **No missing abstraction.** If the same logic pattern appears 3+ times, it should be extracted. Copy-paste code that's nearly identical signals a missing abstraction.
- [ ] **Appropriate abstraction depth.** Wrappers around wrappers around wrappers add indirection without value. Each layer should add meaningful functionality.
- [ ] **Framework features used directly.** Don't wrap framework APIs in custom abstractions unless there's a specific reason (testability, portability). See Article VIII: Anti-Abstraction Gate.
- [ ] **Leaky abstractions identified.** If an abstraction requires callers to understand the underlying implementation to use it correctly, the abstraction is leaky and needs rethinking.

### 5. API Surface Changes

- [ ] **Breaking changes are documented.** If public interfaces, function signatures, or configuration formats change, the PR must document the migration path.
- [ ] **Backwards compatibility considered.** If this is a library or shared module, do consumers need to change? Are there runtime checks for old vs new format?
- [ ] **Exports are intentional.** New exports from modules should be deliberate. Check that internal helpers aren't accidentally exported.
- [ ] **Type exports match runtime exports.** TypeScript type exports should align with what's actually available at runtime.
- [ ] **API surface is minimal.** Export only what consumers need. Internal implementation details should not be part of the public API.

### 6. Dependency Direction

- [ ] **Dependencies flow inward.** In layered architecture: handlers -> services -> repositories. Never the reverse.
- [ ] **No business logic in infrastructure layers.** Route handlers, middleware, and database adapters should delegate to service/domain layers for business decisions.
- [ ] **Shared types in the right layer.** Types used across modules should live in a shared types module, not in one module that others import from.

### 7. Scalability Considerations

- [ ] **No single points of failure introduced.** New services or connections should handle failure gracefully (retry, fallback, circuit breaker as appropriate).
- [ ] **Stateless where possible.** New request handlers should not depend on in-memory state that would break with multiple instances.
- [ ] **Resource cleanup.** New connections, file handles, or subscriptions should have corresponding cleanup/close logic.

---

## Severity Guide

| Finding | Severity |
|---------|----------|
| Circular dependency introduced | **critical** |
| Breaking change to public API without migration | **critical** |
| Cross-layer import in the wrong direction (per `docs/architecture.md`) | **critical** |
| Business logic in infrastructure layer | **warning** |
| New pattern without justification | **warning** |
| Function over 25 lines | **suggestion** |
| Function with multiple responsibilities | **warning** |
| Exact / case-variant use of a `CONTEXT.md` `_Avoid_:` alias as a **public** symbol | **warning** |
| Exact / case-variant use of a `CONTEXT.md` `_Avoid_:` alias as an **internal** symbol | **nit** |
| Avoid alias appearing only in prose / comments | **advisory** |
| New responsibility on a class contradicting documented role | **warning** |
| Premature abstraction (one implementation) | **suggestion** |
| New term introduced with no entry in `CONTEXT.md` (prompt for grill-with-docs) | **suggestion** |
| Fuzzy / substring match (Avoid alias is part of a larger compound symbol) | **nit** |
| Minor naming convention inconsistency | **nit** |
| Missing export documentation | **nit** |

All `CONTEXT.md`-/`docs/architecture.md`-derived findings MUST cite the source doc + line per the format in `ArchitectureDocs.md` §6.
