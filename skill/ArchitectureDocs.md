# ArchitectureDocs — Canonical Architecture Source Loader

**Loaded by:** the workflow-level Step 0 in `Workflows/FullReview.md` and `Workflows/StandardReview.md` (compass#98 F9) — grounding now runs on EVERY review, before lens detection, not just when the Architecture lens activates. `Architecture.md` §0 reuses the same cached fetch rather than re-fetching. May also be cited by other lenses when they need to cross-reference the target repo's bounded-context language.

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

**Fetching (pipe-free, canonical form):** the PR-review workflow typically operates against a remote repo via `gh`, frequently inside a **review-session lockdown** whose bash-guard (`rejectsChaining` / `bash-guard.hook.ts`) denies any pipe or redirect OUTRIGHT — before the command allowlist is even consulted. Fetch each doc with a **single un-piped GET** using the raw-media `Accept` header:

```bash
gh api repos/{owner}/{repo}/contents/CONTEXT.md -H "Accept: application/vnd.github.raw"
gh api repos/{owner}/{repo}/contents/docs/architecture.md -H "Accept: application/vnd.github.raw"
gh api repos/{owner}/{repo}/contents/compass/ecosystem/CONTEXT-MAP.md -H "Accept: application/vnd.github.raw"
```

Each command returns the fully decoded file content directly in the response body — no `--jq`, no `| base64 -d`, no `tr -d '\n'` cleanup required, and nothing to break under a pipe-denying bash-guard.

⚠️ **Lockdown-inert legacy form — do not use.** An earlier revision of this doc fetched via `gh api "repos/{owner}/{repo}/contents/{path}" --jq '.content' | tr -d '\n' | base64 -d` (the `tr -d '\n'` pre-strip was needed because the `contents` endpoint returns base64 in RFC 2045 hard-wrapped form, and macOS `base64 -d` rejects embedded newlines without `-i`). That form still works in an unrestricted shell, but it is a **pipe chain**, so it is silently blocked inside any review-session lockdown before the fetch ever runs — the lens then proceeds as if the docs were absent, with no error surfaced. Always use the pipe-free `-H "Accept: application/vnd.github.raw"` form above (compass#98 F6/F9 — this is the same carrier fix cortex#1420 applied to the bus review-prompt path).

A non-zero exit (file missing) is **expected and non-fatal**. Record which docs were loaded; the lens output cites them by name.

**Caching:** within one review session (one workflow invocation), cache loaded doc contents in memory — the lens may pass over them multiple times during finding emission. Do not re-fetch.

**Provenance line (canonical shape):** every Architecture lens output emits a one-line provenance string listing which docs were loaded and which were absent. The shape is pinned — every doc gets a `(loaded)` or `(not-found)` parenthesized state token, comma-separated:

```
architecture-docs: CONTEXT.md (loaded), docs/architecture.md (loaded), CONTEXT-MAP.md (not-found)
```

Use hyphenated `(not-found)` — never `(missing)`, `none-found`, `(absent)`, or a bare `not-found` token. Downstream parsers (pilot, dashboard, audit log) grep for the `(loaded)` / `(not-found)` pair and depend on this exact shape.

The fallback case — zero canonical docs loaded — uses the same shape, with every entry marked `(not-found)`. See §8 for the fallback form.

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
| `avoid` | Comma-separated list under `_Avoid_:` (may be the next line or appear inline). See parser rules below — the line is **not** a flat CSV. |
| `section` | The nearest preceding `###` or `##` heading — gives the rule its categorical context (e.g. "Assistants & agents", "The bus"). |
| `source` | `CONTEXT.md:{line-number}` of the term heading — cited verbatim in findings. |

**Parsing rules:**

- Term headings are identified by the regex `^\*\*([A-Z][A-Za-z0-9 -]+)\*\*:` at start of line. Case matters — only bolded title-case terms with a trailing colon.
- `_Avoid_:` may appear on the same line as the closing definition or on its own line.
- Some entries do not declare `_Avoid_:` — those still count as canonical-term rules but produce no alias-violation findings.
- Embedded backtick code spans (e.g. `` `tasks` ``) inside the definition are normal prose; do not treat as code.

**`_Avoid_:` line — alias extraction (parser contract):**

A naive `split(',')` on the Avoid line is **wrong** — cortex's CONTEXT.md uses three patterns the parser must handle:

| Pattern | Example | Handling |
|---------|---------|----------|
| Parenthetical clarification after an alias | `federation (that is the relationship, not the thing), mesh, fabric` | Strip `(…)` groups **before** splitting. The comma inside the parens must not become a separator. |
| Prose extension after a terminal `.` | `deployment, instance, node. Never use \`stack\` for the M1–M7 architecture …` | Truncate the line at the first `". "` that is followed by an uppercase letter (start of a sentence) or end-of-line `.`. Everything before that point is the alias list; everything after is commentary and is discarded. |
| Trailing parenthetical on the last alias | `bot, persona, daemon (as the domain term)` | Same as pattern 1 — the `(as the domain term)` is parser-stripped, leaving `daemon`. |

Concrete algorithm — apply in order to the text after `_Avoid_:`:

1. **Strip parentheticals.** Remove every `\([^)]*\)` group (non-nested — cortex's CONTEXT.md does not nest parens inside Avoid lines).
2. **Truncate prose extensions.** Cut the line at the **earliest** of these markers, whichever comes first:
   - `\. ` followed by an uppercase letter (sentence start: `". Never"`, `". Always"`).
   - ` — ` (em-dash surrounded by spaces) followed by a lowercase letter (mid-sentence aside: `" — and never use"`).
   - A terminal `\.` at end-of-string.

   Everything before the cut is the alias list; everything after is commentary and is discarded.
3. **Split on `,`.** Then trim whitespace and trailing punctuation (`.`, `;`, backticks) from each candidate.
4. **Drop empties.** Any empty string after trim is discarded.

Worked examples (cortex CONTEXT.md):

- `federation (that is the relationship, not the thing), mesh, fabric, org, cluster`
  → after step 1: `federation , mesh, fabric, org, cluster`
  → final: `["federation", "mesh", "fabric", "org", "cluster"]`
- `deployment, instance, node. Never use \`stack\` for the M1–M7 architecture — that is the **Myelin layer model**.`
  → after step 2: `deployment, instance, node`
  → final: `["deployment", "instance", "node"]`
- `bot, persona, daemon (as the domain term)`
  → after step 1: `bot, persona, daemon `
  → final: `["bot", "persona", "daemon"]`
- `channel, category — and never use \`domain\` for the DDD bounded-context sense (that is always written **bounded context**).`
  → after step 1 (strip parens): `channel, category — and never use \`domain\` for the DDD bounded-context sense .`
  → after step 2 (em-dash cut): `channel, category`
  → final: `["channel", "category"]`
- `operator, user, owner, human, org` (simple case — no parens, no prose)
  → final: `["operator", "user", "owner", "human", "org"]`

If `CONTEXT.md` introduces a fourth pattern not covered here, prefer **under-extracting** (drop the ambiguous segment) over emitting a broken alias — false-positive alias matches against split-prose ("not the thing)") are worse than missing one alias.

**Cite-on-finding format (canonical):**

```
CONTEXT.md §{section} — canonical term `{term}` (avoid: {alias-list}) — source {repo-relative-path}:{line}
```

Use this exact shape everywhere — §1 provenance, §5 cross-check findings, §6 worked example. See §9 for the worked-example rendering.

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

### 5.1. Match classification (single normalization rule)

Before assigning severity, classify the match. **Normalize both sides** of the comparison — alias and candidate symbol — by:

1. Splitting on word boundaries: camelCase, snake_case, kebab-case, dot.separated, and PascalCase all break into their constituent tokens.
2. Lowercasing each token.
3. Joining the token stream back as a flat sequence.

A match is then exactly one of:

| Class | Definition | Examples vs alias `dispatch-source` |
|-------|-----------|------------------------------------|
| **Exact** | After normalization, the symbol's token sequence equals the alias's token sequence. Word-boundary, case-insensitive, separator-insensitive. | `dispatchSource`, `DispatchSource`, `dispatch_source`, `DISPATCH_SOURCE`, `dispatch.source` |
| **Plural / case-variant** | Exact match with a trailing `s`/`es`, or an English plural (`-ies` → `-y`). | `dispatchSources`, `dispatch_sources` |
| **Fuzzy / substring** | The alias appears as a substring of the symbol but the surrounding tokens make it a different concept. | `dispatchSourceResolver`, `redispatchSource` |
| **Prose** | The alias appears only in a comment, docstring, or string literal — never in an identifier. | `// fallback when dispatch-source is null` |

This single rule is shared by §5.2 (severity assignment) and §6 (worked example). camelCased / snake_cased / kebab-cased forms of an Avoid alias are **exact** matches, not fuzzy.

### 5.2. Severity by symbol scope and match class

Severity is the product of two axes: **match class** (§5.1) × **symbol scope** (public API vs internal vs prose). A symbol's scope is:

- **Public** — exported from the module (TS `export`, Python module-level non-`_`-prefixed, public class member). Externally visible API surface.
- **Internal** — local variables, private members, unexported helpers, file-scoped names. Visible only inside the file/module.
- **Prose** — comments, docstrings, README text, string literals not used as identifiers.

| Match class | Public symbol | Internal symbol | Prose |
|------------|---------------|-----------------|-------|
| Exact | **warning** | **nit** | **advisory** (or skip) |
| Plural / case-variant | **warning** | **nit** | **advisory** (or skip) |
| Fuzzy / substring | **nit** | **nit** | skip |
| Prose | **advisory** | skip | skip |

"Advisory" findings are informational only — emitted to surface the cite, never blocking. Empty-cell `skip` entries are not emitted at all (would create excessive noise).

### 5.3. Finding shape (Avoid-alias)

```
[warning/architecture] Public symbol `{symbol}` matches CONTEXT.md Avoid alias `{alias}` (match: exact).
Canonical term: `{term}` per CONTEXT.md §{section} (line {N}).
Use `{term}` instead, or document why the alias is intentional in this scope.
```

For nits, swap `[warning/architecture]` → `[nit/architecture]` and `Public symbol` → `Internal symbol` (or whatever scope applied).

### 5.4. Layer-direction check

If a new import crosses a layer boundary in the wrong direction (per §4a), emit a **critical** finding citing `docs/architecture.md:{line}`.

### 5.5. Responsibility-drift check

If a new method or behaviour added to a class contradicts a §4b boundary rule (e.g., a renderer gaining a side-effect when CONTEXT.md says renderers display only), emit a **warning** finding citing the rule.

### 5.6. New-term check

A new identifier that names a concept the target repo's CONTEXT.md does not yet cover (judged heuristically — significant new noun, not a local variable) emits a **suggestion**: prompt the author to run `grill-with-docs` to declare the term canonically.

**Severity guide for CONTEXT-cited findings (summary — derived from §5.2):**

| Finding | Severity |
|---------|----------|
| Exact / case-variant match of an `_Avoid_:` alias as a **public** symbol | **warning** |
| Exact / case-variant match of an `_Avoid_:` alias as an **internal** symbol | **nit** |
| Avoid alias appearing only in prose / comments | **advisory** |
| Cross-layer import in the wrong direction | **critical** |
| New responsibility on a class contradicting a documented role | **warning** |
| Fuzzy / substring match (alias is part of a larger compound name) | **nit** |
| New term introduced that has no entry yet in CONTEXT.md | **suggestion** (prompt to grill-with-docs) |

---

## 6. Output integration

The Architecture lens emits its findings using the standard PR-comment shape (see `Workflows/FullReview.md` Step 10 and `Workflows/StandardReview.md` Step 7). The only difference for CONTEXT-derived findings is the cited source — include the doc + line.

The cite block on every CONTEXT-derived finding uses the canonical shape pinned in §2:

```
CONTEXT.md §{section} — canonical term `{term}` (avoid: {alias-list}) — source {repo-relative-path}:{line}
```

Example inline comment body — `dispatchSource` is an **exact** match (§5.1) for the Avoid alias `dispatch-source` (camelCase → kebab-case is a case-variant of the same token sequence). Exported function → **public** scope → **warning** severity per §5.2:

```
**[warning/architecture]** Public symbol `dispatchSource` matches CONTEXT.md Avoid alias `dispatch-source` (match: exact).
Canonical term: `Originator` per CONTEXT.md §"The bus" (line 87).
Use `originator` instead, or document why the alias is intentional in this scope.

CONTEXT.md §"The bus" — canonical term `Originator` (avoid: dispatch-source, sender, publisher) — source CONTEXT.md:87
```

The lens summary appends the provenance line (per §1) so reviewers know which docs informed the verdict.

---

## 7. Worked example — cortex#483

The motivating case. `docs/architecture.md` §dispatch said *"adapter populates `originator.identity` with the resolved DID"*. `CONTEXT.md` `**Originator**:` entry listed `_Avoid_: dispatch-source, sender`. The cortex#483 diff introduced a resolver-side `reverseLookup()` call in `src/runner/dispatch-listener.ts` (M7 listener layer), papering over the missing resolution at the adapter (M7 adapter layer — a different responsibility).

The Architecture lens would have flagged:

```
**[critical/architecture]** `reverseLookup()` at src/runner/dispatch-listener.ts:142 places identity-resolution responsibility on the listener.
docs/architecture.md §dispatch (line 412): "adapter populates originator.identity with the resolved DID" — resolution belongs at the adapter, not the listener.
CONTEXT.md §"Surfaces" — canonical term `Adapter` (avoid: connector, gateway, plugin) — source CONTEXT.md:42

Fix: move reverseLookup() into the adapter; let the listener receive a fully-resolved envelope.
```

— which is the exact finding the end-of-day operator audit produced manually.

---

## 8. Fallback when no docs found

If zero canonical docs are found, the lens proceeds with its legacy heuristic checklist (`Architecture.md` §§1–7) only and emits the provenance line in the canonical shape (per §1):

```
architecture-docs: CONTEXT.md (not-found), docs/architecture.md (not-found), CONTEXT-MAP.md (not-found) — running legacy heuristic checklist only
```

The trailing `— running legacy heuristic checklist only` clause is a human-readable suffix on the canonical shape, not a replacement. Downstream parsers still find `(not-found)` tokens at the documented positions.

No CONTEXT-cited findings are emitted in this mode. This guarantees zero regression on repos that don't carry the new docs (older grove projects, third-party repos, freshly-bootstrapped repos before their first grill-with-docs session).
