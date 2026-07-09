/**
 * The trigger conditions a skill's description encodes, pulled out into data so they can be
 * tested and benchmarked instead of only asserted in prose.
 *
 * This is *not* the mechanism that fires a skill — the host model reads the SKILL.md
 * `description` and decides. These fields exist to keep that description honest: every
 * phrase here must appear in the description, and `scripts/eval-skill-routing` measures
 * whether the set as a whole separates the skills cleanly.
 */
export interface SkillTriggers {
  /** Verbatim things a founder types that should load this skill. */
  phrases: string[];
  /** Single words that raise this skill's relevance without being decisive on their own. */
  keywords: string[];
  /** Phrases that mean this skill should stay out of the way, even if `phrases` matched. */
  antiPhrases?: string[];
}

export interface SkillMeta {
  /** Directory name under skills/, also the stable id used by the CLI and MCP server. */
  id: string;
  /** Human-readable title. */
  title: string;
  /** One-line summary of what the skill does, shown in `npx @vovy-ai/go install` output and docs. */
  summary: string;
  triggers: SkillTriggers;
}

export interface LoadedSkill extends SkillMeta {
  /** The `name` field from the SKILL.md YAML frontmatter. */
  name: string;
  /** The `description` field from the SKILL.md YAML frontmatter (the trigger text the host model reads). */
  description: string;
  /** The markdown body, with frontmatter stripped. */
  body: string;
  /** The full file contents including frontmatter — what gets written to disk, after
   * `{{PROJECT}}` has been substituted for the detected stack. */
  raw: string;
  /** Absolute path to the source SKILL.md this was loaded from. */
  sourcePath: string;
}
