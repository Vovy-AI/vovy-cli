import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SKILL_MANIFEST,
  UNKNOWN_PROJECT_STACK,
  contextualize,
  detectProjectContext,
  getAllSkills,
  getSkill,
  matchSkills,
} from "./index.js";

/** Same normalization the trigger matcher uses, so this test compares like with like. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

describe("@vovy-ai/skills", () => {
  it("loads every skill in the manifest without throwing", () => {
    const skills = getAllSkills();
    expect(skills).toHaveLength(SKILL_MANIFEST.length);
  });

  it("parses required frontmatter fields for every skill", () => {
    for (const skill of getAllSkills()) {
      expect(skill.name).toBeTruthy();
      expect(skill.description.length).toBeGreaterThan(20);
      expect(skill.body.length).toBeGreaterThan(0);
    }
  });

  it("keeps frontmatter name in sync with the manifest id", () => {
    for (const skill of getAllSkills()) {
      expect(skill.name).toBe(skill.id);
    }
  });

  it("throws a helpful error for an unknown skill id", () => {
    expect(() => getSkill("does-not-exist")).toThrow(/Unknown skill id/);
  });

  it("keeps every description assertive enough to actually trigger (no single-word/lazy descriptions)", () => {
    for (const skill of getAllSkills()) {
      expect(skill.description.split(/\s+/).length).toBeGreaterThan(15);
    }
  });
});

describe("trigger metadata", () => {
  it("declares every trigger phrase verbatim in the skill's own description", () => {
    // The description is what the host model reads. A trigger phrase absent from it is a
    // phrase this skill will never actually fire on, no matter what the manifest claims.
    for (const skill of getAllSkills()) {
      const description = normalize(skill.description);
      for (const phrase of skill.triggers.phrases) {
        expect(description, `${skill.id} description must contain "${phrase}"`).toContain(
          normalize(phrase),
        );
      }
    }
  });

  it("never lets a skill's anti-phrase appear in its own description", () => {
    for (const skill of getAllSkills()) {
      const description = normalize(skill.description);
      for (const antiPhrase of skill.triggers.antiPhrases ?? []) {
        expect(description).not.toContain(normalize(antiPhrase));
      }
    }
  });
});

describe("matchSkills", () => {
  it("routes a scoped-change question to context-scoper, not prompt-rescoper", () => {
    const [top] = matchSkills("where is the signup function defined?");
    expect(top?.id).toBe("context-scoper");
  });

  it("routes a build request to prompt-rescoper, not context-scoper", () => {
    const [top] = matchSkills("build me a login page");
    expect(top?.id).toBe("prompt-rescoper");
  });

  it("routes a destructive action to founder-explainer", () => {
    const [top] = matchSkills("can you delete the users table and deploy to production");
    expect(top?.id).toBe("founder-explainer");
  });

  it("returns nothing for a prompt no skill claims", () => {
    expect(matchSkills("what is the weather in Paris")).toEqual([]);
  });

  it("explains which triggers fired rather than returning a bare score", () => {
    const [top] = matchSkills("what calls this function");
    expect(top?.matched).toContain("what calls");
  });
});

describe("project context injection", () => {
  it("substitutes the detected stack into a skill description", () => {
    const raw = "description: about the current {{PROJECT}} project";
    expect(
      contextualize(raw, {
        language: "TypeScript",
        frameworks: ["Next.js"],
        stack: "Next.js + TypeScript",
      }),
    ).toBe("description: about the current Next.js + TypeScript project");
  });

  it("falls back to the generic wording when the project is unrecognized", () => {
    expect(contextualize("a {{PROJECT}} project")).toBe(`a ${UNKNOWN_PROJECT_STACK} project`);
  });

  it("never leaves an unsubstituted placeholder in a loaded skill", () => {
    for (const skill of getAllSkills()) {
      expect(skill.raw).not.toContain("{{PROJECT}}");
      expect(skill.description).not.toContain("{{PROJECT}}");
    }
  });

  it("detects a Next.js + TypeScript project from its package.json", () => {
    const root = mkdtempSync(join(tmpdir(), "vovy-ctx-"));
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({
        dependencies: { next: "15.0.0", react: "19.0.0" },
        devDependencies: { typescript: "5.7.2" },
      }),
    );

    const context = detectProjectContext(root);
    expect(context.language).toBe("TypeScript");
    expect(context.frameworks).toContain("Next.js");
    expect(context.stack).toBe("Next.js + React + TypeScript");
  });

  it("reports the unknown stack for a directory that is not a project", () => {
    const root = mkdtempSync(join(tmpdir(), "vovy-ctx-empty-"));
    expect(detectProjectContext(root).stack).toBe(UNKNOWN_PROJECT_STACK);
  });

  it("bakes the detected stack into what install writes to disk", () => {
    const context = {
      language: "TypeScript" as const,
      frameworks: ["Next.js"],
      stack: "Next.js + TypeScript",
    };
    const scoper = getSkill("context-scoper", context);
    expect(scoper.description).toContain("Next.js + TypeScript project");
  });
});
