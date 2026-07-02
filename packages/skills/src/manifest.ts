import type { SkillMeta } from "./types.js";

/**
 * The full set of skills Vovy ships in v0.1. This is the single source of truth: both
 * `vovy install` (writes SKILL.md into each host's native skill directory) and
 * `@vovy/mcp-server` (serves the same content as MCP prompts/resources) read from here.
 */
export const SKILL_MANIFEST: SkillMeta[] = [
  {
    id: "prompt-rescoper",
    title: "Prompt Rescoper",
    summary:
      "Rewrites a vague or oversized request into a properly scoped spec before any code gets written.",
  },
  {
    id: "project-skill-drafter",
    title: "Project Skill Drafter",
    summary:
      "Analyzes the current project and drafts a tailored, project-specific skill file so future requests come with the right context automatically.",
  },
  {
    id: "founder-explainer",
    title: "Founder Explainer",
    summary:
      "Explains high-stakes or destructive actions in plain English before they happen, and flags common vibe-coding security foot-guns.",
  },
];
