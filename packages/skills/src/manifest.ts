import type { SkillMeta } from "./types.js";

/**
 * Every skill Vovy ships. This is the single source of truth: both `npx @vovy-ai/go
 * install` (writes SKILL.md into each host's native skill directory) and
 * `@vovy-ai/mcp-server` (serves the same content as MCP prompts/resources) read from here.
 *
 * Each skill's `triggers` must stay consistent with the phrases in its SKILL.md
 * `description` — `src/index.test.ts` enforces that, so the two cannot drift.
 */
export const SKILL_MANIFEST: SkillMeta[] = [
  {
    id: "prompt-rescoper",
    title: "Prompt Rescoper",
    summary:
      "Rewrites a vague or oversized request into a properly scoped spec before any code gets written.",
    triggers: {
      phrases: ["build me", "add a", "create a", "can you make", "i want", "implement", "set up"],
      keywords: ["feature", "build", "scope", "spec", "plan", "request"],
      antiPhrases: ["what did that just do", "is it safe to change"],
    },
  },
  {
    id: "project-skill-drafter",
    title: "Project Skill Drafter",
    summary:
      "Analyzes the current project and drafts a tailored, project-specific skill file so future requests come with the right context automatically.",
    triggers: {
      phrases: [
        "learn this codebase",
        "set up vovy",
        "generate a project skill",
        "remember how this project works",
      ],
      keywords: ["onboard", "codebase", "context", "claude.md", "skill"],
    },
  },
  {
    id: "founder-explainer",
    title: "Founder Explainer",
    summary:
      "Explains high-stakes or destructive actions in plain English before they happen, and flags common vibe-coding security foot-guns.",
    triggers: {
      phrases: [
        "what did that just do",
        "delete",
        "drop table",
        "force push",
        "deploy to production",
        "migrate",
      ],
      // `explain` and `deploy` were added after `scripts/eval-skill-routing` showed that
      // "explain what this deploy script does" matched no skill at all — a coverage gap in
      // the skill whose stated job is explaining high-stakes actions, not a benchmark
      // artifact. The two remaining `hard` failures were left alone deliberately: they turn
      // on intent, which literal matching cannot recover.
      keywords: [
        "secret",
        "auth",
        "payment",
        "env",
        "destructive",
        "production",
        "explain",
        "deploy",
      ],
    },
  },
  {
    id: "memory-keeper",
    title: "Memory Keeper",
    summary:
      "Records decisions, mistakes, and constraints with their rationale into git-committed project memory, and recalls them before new work repeats an old failure.",
    triggers: {
      phrases: ["remember this", "don't do that again", "why did we", "have we tried"],
      keywords: ["memory", "decision", "mistake", "constraint", "rationale", "remember"],
    },
  },
  {
    id: "context-scoper",
    title: "Context Scoper",
    summary:
      "Finds the exact symbol, method, or file before reading whole files — cutting tokens spent and avoiding same-named false matches.",
    triggers: {
      phrases: [
        "where is",
        "how does",
        "which file",
        "what calls",
        "is it safe to change",
        "who uses",
      ],
      keywords: ["function", "symbol", "defined", "references", "rename", "signature"],
      antiPhrases: ["build me", "create a"],
    },
  },
];
