import { type ProjectContext, UNKNOWN_PROJECT_STACK, detectProjectContext } from "./context.js";

/** The single placeholder a SKILL.md may use in its frontmatter description or body. */
const PROJECT_PLACEHOLDER = /\{\{PROJECT\}\}/g;

/**
 * Substitutes `{{PROJECT}}` with the detected stack.
 *
 * A host model decides whether to load a skill by reading its `description` and nothing
 * else. A description that names the founder's actual stack ("...about the current Next.js
 * + TypeScript project...") matches the words in their question more often than one that
 * says "JS/TS/JSX/TSX", and it costs zero extra tokens because it *replaces* the generic
 * phrase rather than being appended to it.
 *
 * Skill files always ship with the placeholder, never with a stack baked in, so a file
 * written for one project is never silently wrong about another.
 */
export function contextualize(raw: string, context?: ProjectContext): string {
  return raw.replace(PROJECT_PLACEHOLDER, context?.stack ?? UNKNOWN_PROJECT_STACK);
}

/** Convenience wrapper for callers that have a project root but no `ProjectContext` yet. */
export function contextualizeForRoot(raw: string, root: string): string {
  return contextualize(raw, detectProjectContext(root));
}
