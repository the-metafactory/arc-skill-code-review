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
      "EcosystemCompliance.md",
      "Performance.md",
    ];
    for (const lens of lenses) {
      expect(existsSync(resolve(SKILL_DIR, lens))).toBe(true);
    }
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
