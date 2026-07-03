export interface SkillMeta {
  /** Directory name under skills/, also the stable id used by the CLI and MCP server. */
  id: string;
  /** Human-readable title. */
  title: string;
  /** One-line summary of what the skill does, shown in `vibez install` output and docs. */
  summary: string;
}

export interface LoadedSkill extends SkillMeta {
  /** The `name` field from the SKILL.md YAML frontmatter. */
  name: string;
  /** The `description` field from the SKILL.md YAML frontmatter (the trigger text the host model reads). */
  description: string;
  /** The markdown body, with frontmatter stripped. */
  body: string;
  /** The full, unmodified file contents, including frontmatter — this is what gets written to disk verbatim. */
  raw: string;
  /** Absolute path to the source SKILL.md this was loaded from. */
  sourcePath: string;
}
