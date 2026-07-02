import { loadSkill, skillDir, skillPath } from "./load.js";
import { SKILL_MANIFEST } from "./manifest.js";
import type { LoadedSkill } from "./types.js";

export type { LoadedSkill, SkillMeta } from "./types.js";
export { SKILL_MANIFEST } from "./manifest.js";
export { skillDir, skillPath } from "./load.js";

export function getAllSkills(): LoadedSkill[] {
  return SKILL_MANIFEST.map(loadSkill);
}

export function getSkill(id: string): LoadedSkill {
  const meta = SKILL_MANIFEST.find((s) => s.id === id);
  if (!meta) {
    throw new Error(
      `Unknown skill id "${id}". Known ids: ${SKILL_MANIFEST.map((s) => s.id).join(", ")}`,
    );
  }
  return loadSkill(meta);
}
