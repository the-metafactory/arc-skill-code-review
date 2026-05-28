# Architecture-lens fixtures

Test fixtures exercising the CONTEXT.md-aware Architecture lens (issue #17).

## Files

| File | Role |
|------|------|
| `CONTEXT.md` | Stand-in for a target repo's bounded-context glossary. Models the cortex shape (canonical `**Term**:` + `_Avoid_:` aliases). The parser in `skill/ArchitectureDocs.md` §2 should yield 6 rules from this file. |
| `diff-avoid-alias-violation.diff` | A diff that uses two `_Avoid_:` aliases (`dispatch-source`, `sender`) as exported symbol names + a new file at the listener layer doing resolver work. **Expected:** at least one `warning/architecture` finding citing `CONTEXT.md` `Originator` and one `warning/architecture` finding for adapter-vs-listener responsibility drift. |
| `diff-canonical-respect.diff` | A diff that uses the canonical term `originator` and places resolution in the adapter, matching the documented role. **Expected:** zero CONTEXT-derived findings. |
| `diff-no-docs-fallback.diff` | A diff for a hypothetical repo that ships no `CONTEXT.md` / `docs/architecture.md`. **Expected:** lens falls back to the legacy heuristic checklist + emits the `architecture-docs: none-found` provenance line. No CONTEXT-derived findings emitted. |

These fixtures are consumed by `skill.test.ts` for structural assertions (file existence, parse-regex sanity) and serve as the manual-exercise inputs operators can hand the lens to confirm behaviour end-to-end.

## Acceptance criteria mapping (per issue #17)

- *"A test fixture: a diff that violates a clear CONTEXT.md rule produces an Architecture-lens major finding citing the doc"* → `diff-avoid-alias-violation.diff` + `CONTEXT.md`.
- *"When neither exists, lens falls back to current heuristic behaviour (no regression)"* → `diff-no-docs-fallback.diff`.
- *"When a target repo has CONTEXT.md, the Architecture lens automatically loads it + cites relevant sections in findings"* → `diff-canonical-respect.diff` + `CONTEXT.md` (zero-finding sanity case).
