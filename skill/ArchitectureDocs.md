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

## 2. Glossary parsing — CONTEXT.md

`CONTEXT.md` follows a stable shape produced by **grill-with-docs**. Each glossary entry looks like:

```markdown
**TermName**:
One-sentence canonical definition that may run across multiple lines until the
next blank line.
_Avoid_: alias1, alias2, alias3
```

Extract one **rule** per entry:

| Field | Source |
|-------|--------|
| `term` | The bolded heading (between `**` markers, before the colon). Canonical noun. |
| `definition` | The prose body up to the next blank line or next `**Term**:` heading. |
| `avoid` | Comma-separated list under `_Avoid_:` (may be the next line or appear inline). |
| `section` | The nearest preceding `###` or `##` heading — gives the rule its categorical context (e.g. "Assistants & agents", "The bus"). |
| `source` | `CONTEXT.md:{line-number}` of the term heading — cited verbatim in findings. |

**Parsing rules:**

- Term headings are identified by the regex `^\*\*([A-Z][A-Za-z0-9 -]+)\*\*:` at start of line. Case matters — only bolded title-case terms with a trailing colon.
- `_Avoid_:` may appear on the same line as the closing definition or on its own line. Aliases are comma-separated; trim whitespace and trailing punctuation from each.
- Some entries do not declare `_Avoid_:` — those still count as canonical-term rules but produce no alias-violation findings.
- Embedded backtick code spans (e.g. `` `tasks` ``) inside the definition are normal prose; do not treat as code.

**Cite-on-finding format:**

```
CONTEXT.md (canonical term `{term}`, §{section}) — avoids: {alias-list}
```

---

## 3. Ecosystem boundary terms — CONTEXT-MAP.md

`compass/ecosystem/CONTEXT-MAP.md` (when present) reconciles terms that cross repo boundaries. Parse it the same way as `CONTEXT.md` but tag each rule with `scope: ecosystem` instead of `scope: repo`. Ecosystem rules win against repo rules in the cite text:

```
CONTEXT-MAP.md (ecosystem boundary term `{term}`) — repo aliases: {avoid-list}
```

When a term appears in both `CONTEXT.md` and `CONTEXT-MAP.md`, the ecosystem reconciliation takes precedence — the repo entry typically defers to the ecosystem definition for boundary-spanning concepts.

---

## 4. Layer + boundary parsing — `docs/architecture.md`

`docs/architecture.md` is freer-form. Extract two classes of rules heuristically:

### 4a. Layer model

Look for the M1–M7 (or equivalent) stack rendering. The cortex example:

```
M7 SURFACES (cortex, pilot, signal-collector, future apps)
M6 COMPOSITION (myelin)
M5 DISCOVERY   (myelin)
…
```

For each layer line, record `{layer-id, owner-list, role-summary}`. Use the layer table to spot **upward** dependencies (lower layer importing from higher layer) and **cross-layer leakage** (M7 implementing M2–M6 concerns).

### 4b. Componentisation & responsibility rules

Look for sentences of the form:

- `<component> consumes <other>` — establishes a directed dependency.
- `<component> owns no part of <other>` — forbids reverse dependency.
- `<component> does NOT have …` — explicit negative rule (very common in cortex's CLAUDE.md style).
- `<role> belongs at the <layer>, not at the <other-layer>` — separation-of-concerns rule.

Each becomes a rule `{kind: "boundary", subject, verb, object, source: "docs/architecture.md:{line}"}`. Apply the regex `\b(does NOT|never|must not|owns no|belongs at|consumes)\b` to surface candidates.

These are heuristic — false positives are acceptable as long as findings cite the line and let the human adjudicate.

---

## 5. Cross-check against the diff

After parsing rules, walk the diff. For each added or renamed symbol (function name, class name, variable, comment-line term, file/directory name):

1. **Avoid-alias check.** If the symbol matches an entry in any rule's `avoid` list (case-insensitive, word-boundary match), emit a **warning**-severity Architecture finding:

   ```
   [warning/architecture] Symbol `{symbol}` matches a CONTEXT.md "Avoid" alias.
   Canonical term: `{term}` (per CONTEXT.md §{section}, line {N}).
   Use `{term}` instead, or document why the alias is intentional in this scope.
   ```

2. **Layer-direction check.** If a new import crosses a layer boundary in the wrong direction (per §4a), emit a **critical** finding citing `docs/architecture.md:{line}`.

3. **Responsibility-drift check.** If a new method or behaviour added to a class contradicts a §4b boundary rule (e.g., a renderer gaining a side-effect when CONTEXT.md says renderers display only), emit a **warning** finding citing the rule.

4. **Ambiguous match.** When a symbol is suggestive of an Avoid alias but the match is not exact (substring, plural, abbreviation), emit a **nit** rather than warning. Better to surface and let humans judge than to silently miss drift.

**Severity guide for CONTEXT-cited findings:**

| Finding | Severity |
|---------|----------|
| Exact use of an `_Avoid_:` alias as a public symbol name | **warning** |
| Cross-layer import in the wrong direction | **critical** |
| New responsibility on a class contradicting a documented role | **warning** |
| Symbol suggestive of an Avoid alias (fuzzy / substring match) | **nit** |
| New term introduced that has no entry yet in CONTEXT.md | **suggestion** (prompt to grill-with-docs) |

---

## 6. Output integration

The Architecture lens emits its findings using the standard PR-comment shape (see `Workflows/FullReview.md` Step 10 and `Workflows/StandardReview.md` Step 7). The only difference for CONTEXT-derived findings is the cited source — include the doc + line. Example inline comment body:

```
**[warning/architecture]** Function name `dispatchSource` uses CONTEXT.md "Avoid" alias.
Canonical term per CONTEXT.md §"The bus" (line 87): `originator`.
CONTEXT.md (canonical term `Originator`, §"The bus") — avoids: dispatch-source, sender, publisher
```

The lens summary appends the provenance line (per §1) so reviewers know which docs informed the verdict.

---

## 7. Worked example — cortex#483

The motivating case. `docs/architecture.md` §dispatch said *"adapter populates `originator.identity` with the resolved DID"*. `CONTEXT.md` `**Originator**:` entry listed `_Avoid_: dispatch-source, sender`. The cortex#483 diff introduced a resolver-side `reverseLookup()` call in `src/runner/dispatch-listener.ts` (M7 listener layer), papering over the missing resolution at the adapter (M7 adapter layer — a different responsibility).

The Architecture lens would have flagged:

```
[critical/architecture] dispatch-listener.ts:142 — reverseLookup() places identity-resolution
  responsibility on the listener. docs/architecture.md:412 says "adapter populates
  originator.identity with the resolved DID" — resolution belongs at the adapter, not the
  listener. CONTEXT.md (canonical role `Adapter`, §"Surfaces") confirms the boundary.
  Fix: move reverseLookup() into the adapter; let the listener receive a fully-resolved envelope.
```

— which is the exact finding the end-of-day operator audit produced manually.

---

## 8. Fallback when no docs found

If zero canonical docs are found, the lens proceeds with its legacy heuristic checklist (`Architecture.md` §§1–7) only and records:

```
architecture-docs: none-found — running legacy heuristic checklist only
```

No CONTEXT-cited findings are emitted in this mode. This guarantees zero regression on repos that don't carry the new docs (older grove projects, third-party repos, freshly-bootstrapped repos before their first grill-with-docs session).
