import { describe, expect, it } from "vitest";
import { SKILL_MANIFEST, getAllSkills, getSkill } from "./index.js";

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
