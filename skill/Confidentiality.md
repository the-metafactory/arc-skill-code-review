# Confidentiality Lens

**Activated when:** the target repository is **exposed** — public, or arc-shipped (its committed tree ships verbatim to downstream installers). Confidentiality is **exposure-gated, not content-gated, and not flavor-gated**: exposure is a property of the *repo*, not of the diff or the requested review flavor, so this lens runs on **every** review of an exposed repo regardless of which files changed or which flavor was requested. It is wired into **every requestable review workflow** — FullReview, SecurityReview, StandardReview, HardeningReview, and SkillReview. No flavor is exempt, and no skip is silent: each workflow records `exposure=`/`confidentiality=` in its pre-flight line even when the repo is private and the lens does not run. It is never skipped because "the diff didn't look sensitive" or because "this is only a hardening/skill review" — a one-line change (or a single skill fragment) on an exposed repo can leak.

**Scope note — no workflow is scoped out.** All five review flavors are wired (fail-closed default). SkillReview is a skill-authoring review rather than a PR review, but skills (agent fragments, personas, example content) are a primary leak vector, so it is wired too — its exposure is derived from the skill's *containing repo* rather than a PR target, and it fails closed to EXPOSED when the repo cannot be determined. Should a future workflow be a pure meta/authoring flow with genuinely no target repo, scope it out here with a one-line rationale — but default to wiring it.

This lens catches the class of leak where confidential material — a client's identity, a deployment's live IDs, a real person's contact — reaches a surface that ships to third parties. It is a **probabilistic** control: a review lens is never the sole gate (deterministic CI gates and local hooks are the primary controls). It is, however, the only control that catches a **brand-new** client's identity before any denylist entry exists.

---

## Rule 0 — Never quote the suspected literal

**Findings cite the category and `file:line` ONLY. Never reproduce the suspected confidential value** — not the org name, not the email, not the ID, not the code — anywhere a finding travels. A review comment that quotes the leaked value to "show" it re-publishes the exact string you are trying to contain, on a surface (a public PR comment, the bus, a Discord echo, a worklog, the verdict block) that is itself exposed.

- **Do:** `[critical/confidentiality] C4 live-platform-id — a non-placeholder 18-digit ID is committed at surfaces/foo.yaml:42; unknown-privacy IDs are treated as private. Replace with a __ENV__ placeholder or move to ~/.config/.`
- **Never:** quote the digits, the name, the address, or the code — not in the comment body, not in the summary, not in the verdict block, not in a Discord one-liner.
- The never-quote rule extends to **every downstream echo** of a finding: inline comments, summary comments, the structured verdict block, worklogs, bus events, and Discord.
- A **"is this a real party / real person / private channel?"** question routes to the **private control plane** (a principal DM or a private compass issue), **never** a public PR comment. Asking the question in public leaks the same thing the finding was protecting.

The denylist that powers deterministic matching for known clients is **never loaded into this lens's context**. Denylist matching runs as a separate deterministic pre-step that emits only `file:line` positions — so a hostile string planted in a diff cannot make the lens exfiltrate the list.

---

## Exposure detection — fail CLOSED

Before running the checklist, determine whether the target repo is exposed:

```bash
gh repo view {owner}/{repo} --json visibility --jq '.visibility'
```

- `PUBLIC` ⇒ **EXPOSED**.
- Any **error, rate-limit, timeout, empty, or unrecognised** result ⇒ **treat as EXPOSED**. Never fail open — an unknown visibility is assumed public.
- A repo that is **arc-shipped** (consumed by `arc upgrade` / carries an `arc-manifest*.yaml`) is **EXPOSED even if the GitHub repo is private**, because its committed tree ships verbatim to every downstream installer. Confirm arc-shipped status from the presence of `arc-manifest*.yaml` at the repo root.

State the outcome in the **pre-flight line** (`exposure=public|arc-shipped|unknown-treated-as-exposed`) and note `confidentiality=active` so a clean run and a silent skip are distinguishable in the transcript. When the cortex `confidentiality` flavor is active, the verdict block additionally carries a `confidentiality_lens_ran` flag + finding count the autonomous loop parses.

---

## Checklist

### C1 — Real organizations or people as content

- [ ] **Real external org as content.** A company, customer, partner, or engagement name that appears to denote a **real external organization**, used as content — in an agent fragment, persona, doc example, comment, or fixture. This is **semantic recall**: reason about whether the token denotes a real party, not whether it matches a list. C1 is one of only two genuinely semantic-only criteria (with C2) — it catches a brand-new client with no denylist entry.
- [ ] **Real person as content.** A real individual's name used as sample data, an example author, a persona, or a fixture value, where it plausibly denotes an actual person rather than an obvious placeholder (`Jane Doe`, `Alice`, `test-user`).
- [ ] **Distinguish placeholders.** Obvious placeholders (`Acme Corp`, `example.com`, `Foo Industries`, `<CLIENT_NAME>`) are **not** findings. The signal is *realness*, not the mere presence of a proper noun.

### C2 — Deployment fragments in shippable paths (ships-verbatim rule)

- [ ] **Ships-verbatim is the primary rule.** In an arc-shipped repo **every committed path is shippable** — it ships verbatim to every downstream installer. So deployment-specific configuration committed to **any** path is a leak. `agents.d/`, `personas/`, and `arc-manifest*.yaml` are **examples, not the boundary** — do not treat "it's not under `agents.d/`" as safe.
- [ ] **The deployment-config test.** *"Would this value differ between two principals' deployments?"* If yes, it is deployment config and belongs in `~/.config/`, not in the repo. Real tokens, hostnames, principal-specific identifiers, and environment-specific values all fail this test.
- [ ] **Shippable content must be generic or templated.** A committed fragment on a shippable path must be a `.example`/template (`<REPLACE_ME>`, `__ENV_VAR__`, zeroed IDs) or an explicitly generic fragment. A real deployment fragment committed as live config is critical. C2, like C1, is semantic — it does not depend on a denylist.

### C3 — Real identities in seeds, fixtures, and migrations

- [ ] **Real identities in data files.** Real people's emails, handles, usernames, or agent-ids embedded in seed files, DB migrations, test fixtures, or sample data. These reach production/exports and are PII once shipped.
- [ ] **Own-brand carve-out is NAMES ONLY.** The org's own brand/product/repo **names** used as examples are a legitimate false-positive carve-out — do not flag them. This carve-out **does not extend to real identities**: a real person's **email/handle/agent-id at the org's own domain** in a seed/fixture/migration stays **critical**. A real address is PII regardless of whose domain it is on.
- [ ] **Honor the allowlist file.** A symmetric allowlist (path/identifier carve-outs the principal has explicitly sanctioned — e.g. maintainer contact in `THIRD-PARTY-NOTICES.md`, git author metadata, sanctioned doc-example identifiers) suppresses principal-sanctioned identifiers. Respect it; do not re-flag an allowlisted entry.

### C4 — Live platform IDs — DEFAULT-CRITICAL

- [ ] **Unknown-privacy platform IDs are critical.** Live platform identifiers committed in config — Discord/Slack/Mattermost guild, channel, team, or user IDs; webhook URLs; snowflakes — are **critical by default**. An ID whose privacy you cannot establish is treated as **private**.
- [ ] **Downgrade only with positive proof of public-ness.** Reduce severity only when there is affirmative evidence the ID is public (a documented public invite, a well-known public channel). Absence of evidence is not proof — a private back-office channel ID looks identical to a public one. When in doubt, it is critical.
- [ ] **Placeholders are clear.** All-zero sentinels, `__ENV__` placeholders, and zeroed IDs are **not** findings.

### C5 — Identity-embedding codes and acronyms (denylist-dependent)

- [ ] **Codes that embed an identity.** Compliance codes, engagement codenames, instance ids, or acronyms whose structure embeds a client's initials or identity (e.g. a standard-code shape that encodes an org's initials).
- [ ] **Honest recall limit.** For **known** clients this is caught by the deterministic denylist pre-step. For a **new** client with no denylist entry yet, recall is **limited** — the lens can flag a suspicious identity-embedding *shape*, but cannot reliably know a novel acronym denotes a real party. State this honestly in findings; **C5 is denylist-dependent for new clients**, not semantically complete. Do not claim clean coverage of C5 on a fresh engagement.

### C6 — Private → public content lifts

- [ ] **Lifted internal content.** Content that reads as copied from a **private** source into an exposed repo — internal design docs, private issue/PR text, internal-only architecture detail, incident specifics, internal screenshots, or private runbook steps.
- [ ] **Signal.** A PR that adds prose/config/assets that reference internal-only systems, unreleased specifics, or private-repo detail. When a value or passage would be classified internal-confidential, its appearance on an exposed surface is the finding — cite the category + `file:line`, never the passage.

---

## Non-goals (declared residual)

This lens does **not** cover, and does not claim to cover:

- **Obfuscated content** — base64-encoded, homoglyph-substituted, split-string, or otherwise encoded confidential material. The lens reads content at face value; it does not decode.
- **Binary assets** — images, compiled artifacts, embedded databases. The lens does not inspect or decode binaries; a new binary/image under a sensitive path is a matter for the deterministic gate's new-binary rule, not this lens.

These are recorded residuals owned by no layer. Do not silently treat their absence-of-findings as coverage.

---

## Severity Guide

| Finding | Severity |
|---------|----------|
| Real external org or real person used as content (C1) | **critical** |
| Real deployment fragment / deployment-specific value on a shippable path (C2) | **critical** |
| Real identity (email/handle/agent-id) in a seed/fixture/migration (C3) | **critical** |
| Live platform ID of unknown or private nature in committed config (C4) | **critical** |
| Identity-embedding code confirmed (denylist or unambiguous structure) (C5) | **critical** |
| Internal-confidential content lifted onto an exposed surface (C6) | **critical** |
| Suspicious identity-embedding code shape, new client, no denylist confirmation (C5) | **warning** |
| Borderline internal-process detail (not clearly confidential) (C6) | **warning** |
| Own-brand name used as an example (carve-out) | *not a finding* |
| Obvious placeholder / zeroed sentinel / templated value | *not a finding* |

## Verdict impact

A **confidentiality critical is ALWAYS `request-changes`** and is **never waivable, downgradable, or "approved over"** — it is exempt from any per-workflow rule that would otherwise permit approving a PR with minor findings, and (in sweeps) it is **not** closable by justification. A confidentiality critical closes only by **removal of the offending content** or by a **linked principal-comment URL** in the private control plane authorising the exception. Never resolve a confidentiality critical by quoting the value to argue it is safe — route the question privately.
