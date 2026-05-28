import { describe, test, expect } from "bun:test";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { parse } from "yaml";

const SKILL_DIR = resolve(import.meta.dir, "skill");

describe("skill structure", () => {
  test("SKILL.md exists with valid frontmatter", () => {
    const path = resolve(SKILL_DIR, "SKILL.md");
    expect(existsSync(path)).toBe(true);
    const content = readFileSync(path, "utf-8");
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    expect(match).not.toBeNull();
    const frontmatter = parse(match![1]);
    expect(frontmatter.name).toBe("CodeReview");
  });

  test("all workflow files referenced in SKILL.md exist", () => {
    const workflows = ["FullReview.md", "StandardReview.md", "SecurityReview.md"];
    for (const wf of workflows) {
      expect(existsSync(resolve(SKILL_DIR, "Workflows", wf))).toBe(true);
    }
  });

  test("all lens files exist", () => {
    const lenses = [
      "CodeQuality.md",
      "Security.md",
      "Architecture.md",
      "ArchitectureDocs.md",
      "EcosystemCompliance.md",
      "Performance.md",
    ];
    for (const lens of lenses) {
      expect(existsSync(resolve(SKILL_DIR, lens))).toBe(true);
    }
  });

  test("Architecture lens has Step 0 doc-loading section", () => {
    const content = readFileSync(resolve(SKILL_DIR, "Architecture.md"), "utf-8");
    // Section 0 was added in arc-skill-code-review#17 — the lens must
    // load CONTEXT.md / docs/architecture.md before applying heuristics.
    expect(content).toMatch(/### 0\. Load canonical architecture docs/);
    expect(content).toContain("CONTEXT.md");
    expect(content).toContain("docs/architecture.md");
    expect(content).toContain("ArchitectureDocs.md");
    expect(content).toContain("architecture-docs:");
  });

  test("ArchitectureDocs.md defines the parsing + cross-check protocol", () => {
    const content = readFileSync(resolve(SKILL_DIR, "ArchitectureDocs.md"), "utf-8");
    // Required sections for the lens to behave as designed.
    expect(content).toMatch(/## 1\. Doc discovery/);
    expect(content).toMatch(/## 2\. Glossary parsing/);
    expect(content).toMatch(/## 5\. Cross-check against the diff/);
    expect(content).toMatch(/## 8\. Fallback when no docs found/);
    // Fallback provenance line.
    expect(content).toContain("none-found");
  });

  test("ArchitectureDocs glossary regex matches the cortex-shape CONTEXT.md fixture", () => {
    const fixture = readFileSync(
      resolve(import.meta.dir, "fixtures/architecture-context/CONTEXT.md"),
      "utf-8",
    );
    // The same regex documented in ArchitectureDocs.md §2.
    const headingRe = /^\*\*([A-Z][A-Za-z0-9 -]+)\*\*:/gm;
    const matches = Array.from(fixture.matchAll(headingRe)).map(m => m[1]);
    // The fixture defines: Assistant, Agent, Originator, Envelope, Adapter, Renderer.
    expect(matches).toEqual([
      "Assistant",
      "Agent",
      "Originator",
      "Envelope",
      "Adapter",
      "Renderer",
    ]);
    // Each term must have its `_Avoid_:` alias list.
    const avoidLines = fixture.match(/^_Avoid_:/gm) ?? [];
    expect(avoidLines.length).toBe(matches.length);
  });

  test("FullReview Step 6 + StandardReview Step 5 instruct the lens to load docs", () => {
    const fr = readFileSync(resolve(SKILL_DIR, "Workflows/FullReview.md"), "utf-8");
    const sr = readFileSync(resolve(SKILL_DIR, "Workflows/StandardReview.md"), "utf-8");
    // FullReview's Architecture step must mention the docs-load + provenance line.
    expect(fr).toContain("CONTEXT.md");
    expect(fr).toContain("architecture-docs:");
    expect(fr).toContain("ArchitectureDocs.md");
    // StandardReview's lens table must cross-reference the doc-loading step.
    expect(sr).toContain("ArchitectureDocs.md");
    expect(sr).toContain("CONTEXT.md");
  });

  test("architecture-context fixtures present (issue #17 acceptance criteria)", () => {
    const fixtureDir = resolve(import.meta.dir, "fixtures/architecture-context");
    const required = [
      "CONTEXT.md",
      "diff-avoid-alias-violation.diff",
      "diff-canonical-respect.diff",
      "diff-no-docs-fallback.diff",
      "README.md",
    ];
    for (const f of required) {
      expect(existsSync(resolve(fixtureDir, f))).toBe(true);
    }
  });

  test("avoid-alias-violation fixture references the canonical CONTEXT.md aliases", () => {
    const diff = readFileSync(
      resolve(import.meta.dir, "fixtures/architecture-context/diff-avoid-alias-violation.diff"),
      "utf-8",
    );
    // The diff must use at least one alias the CONTEXT.md fixture flags as
    // `_Avoid_:` under the Originator entry — that is the violation the lens
    // is expected to catch as a `warning/architecture` finding.
    const violates = ["dispatch-source", "dispatchSource", "sender", "publisher"].some(alias =>
      diff.includes(alias),
    );
    expect(violates).toBe(true);
  });

  test("arc-manifest.yaml is valid", () => {
    const content = readFileSync(resolve(import.meta.dir, "arc-manifest.yaml"), "utf-8");
    const manifest = parse(content);
    expect(manifest.schema).toBe("arc/v1");
    expect(manifest.name).toBe("code-review");
    expect(manifest.type).toBe("skill");
  });

  test("all workflows include duplication analysis step", () => {
    const workflows = ["FullReview.md", "StandardReview.md", "SecurityReview.md"];
    for (const wf of workflows) {
      const content = readFileSync(resolve(SKILL_DIR, "Workflows", wf), "utf-8");
      expect(content).toContain("Code Duplication Analysis");
    }
  });

  test("provenance line uses canonical (loaded)/(not-found) shape — no drift to (not found) or none-found", () => {
    // The provenance line shape is the documented machine-parseable
    // contract — every doc gets `(loaded)` or `(not-found)`, comma-separated.
    // Older drafts used `(not found)` (space) and `none-found` (bare token);
    // both are banned. See ArchitectureDocs.md §1 + Architecture.md §0.
    const archDocs = readFileSync(resolve(SKILL_DIR, "ArchitectureDocs.md"), "utf-8");
    const arch = readFileSync(resolve(SKILL_DIR, "Architecture.md"), "utf-8");
    const fr = readFileSync(resolve(SKILL_DIR, "Workflows/FullReview.md"), "utf-8");

    for (const [name, content] of [
      ["ArchitectureDocs.md", archDocs],
      ["Architecture.md", arch],
      ["FullReview.md", fr],
    ] as const) {
      // Canonical shape present.
      expect(content, `${name} must contain hyphenated (not-found)`).toContain("(not-found)");
      // Banned drift forms must NOT appear in normative text. We allow
      // them in prose only if explicitly quoted as the forbidden form;
      // simplest check is that no provenance-line render uses them.
      const provenanceLines = content.match(/architecture-docs:[^\n]+/g) ?? [];
      for (const line of provenanceLines) {
        expect(line, `${name} provenance line must not use "(not found)" with space`).not.toMatch(
          /\(not found\)/,
        );
        expect(line, `${name} provenance line must not use bare "none-found" token`).not.toMatch(
          /^architecture-docs:\s*none-found/,
        );
      }
    }
  });

  test("base64 decode commands strip newlines before decode (macOS-safe)", () => {
    // `gh api contents/{path} --jq .content` returns RFC 2045 hard-wrapped
    // base64. macOS `base64 -d` rejects embedded newlines. The fetch
    // commands must pipe through `tr -d '\n'` first.
    const archDocs = readFileSync(resolve(SKILL_DIR, "ArchitectureDocs.md"), "utf-8");
    const fr = readFileSync(resolve(SKILL_DIR, "Workflows/FullReview.md"), "utf-8");

    for (const [name, content] of [
      ["ArchitectureDocs.md", archDocs],
      ["FullReview.md", fr],
    ] as const) {
      // Each `gh api ... contents/...` block must contain both base64 -d
      // and tr -d '\n' within the same multi-line pipeline (a `\` line
      // continuation may join them across lines). Match non-greedy
      // through to the next semicolon, blank line, or fence end.
      const fetches = [...content.matchAll(/gh api[^\n]+contents\/[\s\S]+?base64 -d/g)];
      expect(fetches.length, `${name} must have base64 -d in contents fetch`).toBeGreaterThan(0);
      for (const m of fetches) {
        expect(m[0], `${name} base64 decode must pipe through tr -d '\\n'`).toContain("tr -d");
      }
    }
  });

  test("severity calibration: ArchitectureDocs §5.2 + §6 + Architecture.md agree on public vs internal", () => {
    // Major-2 contradiction fix: §5.4 said fuzzy/substring → nit; §6 worked
    // example flagged dispatchSource (case-variant of dispatch-source) as
    // warning. Pin the rule: case-variants of an Avoid alias used as a
    // PUBLIC symbol → warning; INTERNAL → nit. Both §5.2 and the
    // Architecture.md severity table must say so, and §6 must call the
    // example "exact" (not fuzzy).
    const archDocs = readFileSync(resolve(SKILL_DIR, "ArchitectureDocs.md"), "utf-8");
    const arch = readFileSync(resolve(SKILL_DIR, "Architecture.md"), "utf-8");

    // §5.1 must establish the normalization rule that makes camelCase ≡ kebab-case.
    expect(archDocs).toMatch(/### 5\.1\. Match classification/);
    expect(archDocs).toContain("camelCase");
    expect(archDocs).toContain("kebab-case");
    // §5.2 must split severity by scope (public vs internal).
    expect(archDocs).toMatch(/### 5\.2\. Severity by symbol scope/);
    // The §5.2 table header must list Public, Internal, Prose as columns.
    const sec52 = archDocs.match(/### 5\.2\.[\s\S]+?(?=\n### |\n## )/);
    expect(sec52).not.toBeNull();
    expect(sec52![0]).toContain("Public");
    expect(sec52![0]).toContain("Internal");
    // The Exact-match row must assign warning to Public and nit to Internal.
    expect(sec52![0]).toMatch(/\|\s*Exact\s*\|\s*\*\*warning\*\*\s*\|\s*\*\*nit\*\*/);
    // §6 worked example must use "exact" (per §5.1 normalization), not "fuzzy".
    const sec6 = archDocs.match(/## 6\. Output integration[\s\S]+?(?=\n## )/);
    expect(sec6).not.toBeNull();
    expect(sec6![0]).toContain("match: exact");
    expect(sec6![0]).toContain("warning/architecture");

    // Architecture.md severity table must split the same way.
    expect(arch).toMatch(/\*\*public\*\* symbol.*warning/);
    expect(arch).toMatch(/\*\*internal\*\* symbol.*nit/);
  });

  test("cite format is normalized across §2, §6, §7 — single canonical shape", () => {
    // Nit-3 fix: §2 and §6 used different cite shapes. Pin one form:
    // `CONTEXT.md §{section} — canonical term \`{term}\` (avoid: {alias-list}) — source CONTEXT.md:{line}`
    // Every CONTEXT-derived rendering in the spec must use this shape.
    const archDocs = readFileSync(resolve(SKILL_DIR, "ArchitectureDocs.md"), "utf-8");

    // §2 declares the canonical shape.
    expect(archDocs).toMatch(
      /CONTEXT\.md §\{section\} — canonical term `\{term\}` \(avoid: \{alias-list\}\) — source/,
    );

    // §6 worked example must use the same shape (Originator + bus aliases).
    const sec6 = archDocs.match(/## 6\. Output integration[\s\S]+?(?=\n## )/);
    expect(sec6).not.toBeNull();
    expect(sec6![0]).toMatch(/CONTEXT\.md §.*— canonical term `Originator` \(avoid: .*\) — source/);

    // §7 worked example (Adapter) must use the same shape.
    const sec7 = archDocs.match(/## 7\. Worked example[\s\S]+?(?=\n## )/);
    expect(sec7).not.toBeNull();
    expect(sec7![0]).toMatch(/CONTEXT\.md §.*— canonical term `Adapter` \(avoid: .*\) — source/);
  });

  // ----- _Avoid_ parser contract (Major-1) --------------------------------
  //
  // The skill currently lives as Markdown + a documented algorithm; the
  // parser is implemented at runtime by the reviewing agent following the
  // §2 contract. These tests reproduce the documented algorithm in
  // TypeScript so the test suite proves the algorithm gives the expected
  // output for every tricky pattern that appears in cortex's actual
  // CONTEXT.md. If the algorithm changes, both the spec and this
  // implementation must move in lockstep — that is the regression guard.

  /** Extract the `_Avoid_:` payload for a given term from CONTEXT.md text. */
  function extractAvoidLine(content: string, term: string): string | null {
    // Match `**Term**:` heading, skip to the next `_Avoid_:` before the next
    // term heading or EOF, and return the text after `_Avoid_:` on that line
    // (Avoid lines are single-line in cortex's CONTEXT.md).
    const headingRe = new RegExp(
      `\\*\\*${term}\\*\\*:[\\s\\S]+?^_Avoid_:\\s*([^\\n]+)`,
      "m",
    );
    const m = content.match(headingRe);
    return m ? m[1] : null;
  }

  /** Apply the §2 alias-extraction algorithm. */
  function parseAliases(avoidLine: string): string[] {
    // Step 1: strip parentheticals (non-nested).
    let s = avoidLine.replace(/\([^)]*\)/g, "");
    // Step 2: truncate at the EARLIEST of (a) ". " + uppercase (sentence
    // start), (b) " — " + lowercase (em-dash aside), (c) trailing "." at EOS.
    const cuts = [
      s.search(/\.\s+[A-Z]/),
      s.search(/\s—\s+[a-z]/),
    ].filter(i => i >= 0);
    if (cuts.length > 0) s = s.slice(0, Math.min(...cuts));
    s = s.replace(/\.\s*$/, "");
    // Step 3: split on `,`, trim whitespace + trailing punctuation.
    return s
      .split(",")
      .map(a => a.trim().replace(/[.`;]+$/, "").trim())
      .filter(a => a.length > 0);
  }

  test("_Avoid_ parser — Principal (simple, no parens/prose)", () => {
    const fixture = readFileSync(
      resolve(import.meta.dir, "fixtures/architecture-context/CONTEXT-tricky.md"),
      "utf-8",
    );
    const line = extractAvoidLine(fixture, "Principal")!;
    expect(line).not.toBeNull();
    expect(parseAliases(line)).toEqual(["operator", "user", "owner", "human", "org"]);
  });

  test("_Avoid_ parser — Stack (prose extension after `.`)", () => {
    const fixture = readFileSync(
      resolve(import.meta.dir, "fixtures/architecture-context/CONTEXT-tricky.md"),
      "utf-8",
    );
    const line = extractAvoidLine(fixture, "Stack")!;
    // Raw line ends with: "deployment, instance, node. Never use `stack` for the M1–M7 ..."
    // Parser must truncate at the prose extension.
    expect(parseAliases(line)).toEqual(["deployment", "instance", "node"]);
  });

  test("_Avoid_ parser — Network (parenthetical with embedded comma)", () => {
    const fixture = readFileSync(
      resolve(import.meta.dir, "fixtures/architecture-context/CONTEXT-tricky.md"),
      "utf-8",
    );
    const line = extractAvoidLine(fixture, "Network")!;
    // Raw line: "federation (that is the relationship, not the thing), mesh, fabric, org, cluster"
    // A naive split would yield 6 items including "not the thing)".
    const aliases = parseAliases(line);
    expect(aliases).toEqual(["federation", "mesh", "fabric", "org", "cluster"]);
    // Belt + braces: no alias contains a parenthesis or stray prose.
    for (const a of aliases) {
      expect(a).not.toContain("(");
      expect(a).not.toContain(")");
      expect(a).not.toContain("the thing");
    }
  });

  test("_Avoid_ parser — Agent (trailing parenthetical on last alias)", () => {
    const fixture = readFileSync(
      resolve(import.meta.dir, "fixtures/architecture-context/CONTEXT-tricky.md"),
      "utf-8",
    );
    const line = extractAvoidLine(fixture, "Agent")!;
    // Raw line: "bot, persona, daemon (as the domain term)"
    expect(parseAliases(line)).toEqual(["bot", "persona", "daemon"]);
  });

  test("_Avoid_ parser — Subject (mid-list parenthetical with embedded prose)", () => {
    const fixture = readFileSync(
      resolve(import.meta.dir, "fixtures/architecture-context/CONTEXT-tricky.md"),
      "utf-8",
    );
    const line = extractAvoidLine(fixture, "Subject")!;
    // Raw line: "topic (the Kafka/MQTT word — NATS subjects have different semantics), channel, path"
    expect(parseAliases(line)).toEqual(["topic", "channel", "path"]);
  });

  test("_Avoid_ parser — Capability (mid-list parenthetical)", () => {
    const fixture = readFileSync(
      resolve(import.meta.dir, "fixtures/architecture-context/CONTEXT-tricky.md"),
      "utf-8",
    );
    const line = extractAvoidLine(fixture, "Capability")!;
    // Raw line: "skill (that is the SOMA implementation term), ability, function, command, tool"
    expect(parseAliases(line)).toEqual(["skill", "ability", "function", "command", "tool"]);
  });

  test("_Avoid_ parser — Dispatch (prose extension with quoted phrase)", () => {
    const fixture = readFileSync(
      resolve(import.meta.dir, "fixtures/architecture-context/CONTEXT-tricky.md"),
      "utf-8",
    );
    const line = extractAvoidLine(fixture, "Dispatch")!;
    // Raw line: "routing, assignment, hand-off. Never call the Offer mode "broadcast" — exactly one ..."
    expect(parseAliases(line)).toEqual(["routing", "assignment", "hand-off"]);
  });

  test("_Avoid_ parser — Domain (em-dash prose aside + trailing parenthetical)", () => {
    const fixture = readFileSync(
      resolve(import.meta.dir, "fixtures/architecture-context/CONTEXT-tricky.md"),
      "utf-8",
    );
    const line = extractAvoidLine(fixture, "Domain")!;
    // Raw line: "channel, category — and never use `domain` for the DDD bounded-context sense (that is always written **bounded context**)."
    // The em-dash + lowercase aside truncates at "— and"; the final trailing
    // parenthetical is stripped first (step 1) but does not matter because
    // the em-dash cut comes earlier.
    expect(parseAliases(line)).toEqual(["channel", "category"]);
  });

  test("_Avoid_ parser — every cortex CONTEXT.md tricky entry round-trips cleanly", () => {
    // Single guard test: for every term defined in the tricky fixture,
    // the parser must produce a non-empty alias list with no parens, no
    // sentence fragments, and no embedded punctuation noise.
    const fixture = readFileSync(
      resolve(import.meta.dir, "fixtures/architecture-context/CONTEXT-tricky.md"),
      "utf-8",
    );
    const terms = ["Principal", "Stack", "Network", "Agent", "Subject", "Capability", "Dispatch", "Domain"];
    for (const term of terms) {
      const line = extractAvoidLine(fixture, term)!;
      expect(line, `Avoid line must exist for ${term}`).not.toBeNull();
      const aliases = parseAliases(line);
      expect(aliases.length, `${term}: aliases must be non-empty`).toBeGreaterThan(0);
      for (const a of aliases) {
        // No parenthetical noise.
        expect(a, `${term} alias "${a}" must not contain parens`).not.toMatch(/[()]/);
        // No multi-word fragments (real Avoid aliases are single words or
        // hyphenated compounds — never sentence fragments).
        expect(a, `${term} alias "${a}" must not be a sentence fragment`).not.toMatch(/\s/);
        // No stray quote-mark noise.
        expect(a, `${term} alias "${a}" must not contain quotes`).not.toMatch(/["'—]/);
      }
    }
  });
});
