import type { ProjectContext } from "./context.js";
import { loadSkill, skillDir, skillPath } from "./load.js";
import { SKILL_MANIFEST } from "./manifest.js";
import type { LoadedSkill } from "./types.js";

export type { LoadedSkill, SkillMeta, SkillTriggers } from "./types.js";
export type { ProjectContext, ProjectLanguage } from "./context.js";
export { SKILL_MANIFEST } from "./manifest.js";
export { skillDir, skillPath } from "./load.js";
export { detectProjectContext, UNKNOWN_PROJECT_STACK } from "./context.js";
export { contextualize, contextualizeForRoot } from "./contextualize.js";
export { matchSkills } from "./triggers.js";
export type { SkillMatch } from "./triggers.js";

/** Every skill, with `{{PROJECT}}` resolved against `context` when one is supplied. */
export function getAllSkills(context?: ProjectContext): LoadedSkill[] {
  return SKILL_MANIFEST.map((meta) => loadSkill(meta, context));
}

export function getSkill(id: string, context?: ProjectContext): LoadedSkill {
  const meta = SKILL_MANIFEST.find((s) => s.id === id);
  if (!meta) {
    throw new Error(
      `Unknown skill id "${id}". Known ids: ${SKILL_MANIFEST.map((s) => s.id).join(", ")}`,
    );
  }
  return loadSkill(meta, context);
}
