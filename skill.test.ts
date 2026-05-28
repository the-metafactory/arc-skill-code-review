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
});
