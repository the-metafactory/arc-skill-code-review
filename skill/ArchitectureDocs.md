# ArchitectureDocs — Canonical Architecture Source Loader

**Loaded by:** the Architecture lens, as Step 0 of its checklist (see `Architecture.md` §0). May also be cited by other lenses when they need to cross-reference the target repo's bounded-context language.

**Purpose:** make the Architecture lens *aware of the target repo's own documented architecture* — bounded-context glossary, layer model, separation-of-concerns boundaries — so it can flag drift against those rules instead of operating purely on diff heuristics.

**Motivation:** the metafactory ecosystem (cortex, myelin, soma, signal, pilot, …) now carries a `CONTEXT.md` in every repo (the **grill-with-docs** output of the C-388 vocabulary migration) plus a `docs/architecture.md` describing the layered model. PRs that violated explicit CONTEXT.md rules slipped past prior reviews — cortex#483 (resolver at wrong layer) and cortex#484 (executor disguised as renderer) being the concrete cases that motivated this enhancement. When those docs exist, the Architecture lens MUST consult them.

---

## 1. Doc discovery

At the **start** of the Architecture lens, before applying any checklist, scan the target repo (the repo whose PR is being reviewed — *not* this skill's repo) for the following files, in this order. Stop at the first set that yields content; do **not** require all to exist.

| Priority | Path (relative to repo root) | Role |
|----------|------------------------------|------|
| 1 | `CONTEXT.md` | Bounded-context glossary — canonical terms + Avoid lists. Authored by **grill-with-docs**. |
| 2 | `docs/architecture.md` | Layered model + componentisation. Static reference. |
| 3 | `compass/ecosystem/CONTEXT-MAP.md` | Ecosystem-wide cross-context reconciliation (metafactory repos that vendor the compass shared docs). |
| 4 | `docs/design-*.md` | Optional — load only when `docs/architecture.md` cites them by filename. |

**Fetching:** the PR-review workflow typically operates against a remote repo via `gh`. Fetch via:

```bash
gh api "repos/{owner}/{repo}/contents/CONTEXT.md" --jq '.content' 2>/dev/null | base64 -d
gh api "repos/{owner}/{repo}/contents/docs/architecture.md" --jq '.content' 2>/dev/null | base64 -d
gh api "repos/{owner}/{repo}/contents/compass/ecosystem/CONTEXT-MAP.md" --jq '.content' 2>/dev/null | base64 -d
```

A non-zero exit (file missing) is **expected and non-fatal**. Record which docs were loaded; the lens output cites them by name.

**Caching:** within one review session (one workflow invocation), cache loaded doc contents in memory — the lens may pass over them multiple times during finding emission. Do not re-fetch.

**Provenance line:** every Architecture lens output emits a one-line provenance string listing which docs were loaded and which were absent. Example:

```
architecture-docs: CONTEXT.md (loaded), docs/architecture.md (loaded), CONTEXT-MAP.md (not found)
```

This makes it visible *which* docs informed the review and which were absent — pilot and downstream auditors rely on this provenance line.

---

## 2. Fallback when no docs found

If zero canonical docs are found, the lens proceeds with its legacy heuristic checklist (`Architecture.md` §§1–7) only and records:

```
architecture-docs: none-found — running legacy heuristic checklist only
```

No CONTEXT-cited findings are emitted in this mode. This guarantees zero regression on repos that don't carry the new docs (older grove projects, third-party repos, freshly-bootstrapped repos before their first grill-with-docs session).

---

*Parsing and cross-check protocols are added in subsequent commits — this commit establishes the doc-discovery + provenance contract only.*
