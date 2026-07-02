import { existsSync } from "node:fs";
import { join } from "node:path";
import { mergeJsonMcpConfig } from "../json-mcp-config.js";
import type { DetectEnv, HostAdapter, SkillScope } from "../types.js";

/**
 * Claude Code — Agent Skills at `~/.claude/skills/<id>/SKILL.md` (personal, user scope)
 * or `.claude/skills/<id>/SKILL.md` (project scope, committed to the repo). Project-scoped
 * MCP servers register in a `.mcp.json` file at the project root.
 * https://code.claude.com/docs/en/skills
 */
export const claudeCodeAdapter: HostAdapter = {
  id: "claude-code",
  label: "Claude Code",

  detect(env: DetectEnv): boolean {
    return existsSync(join(env.home, ".claude"));
  },

  skillFilePath(env: DetectEnv, scope: SkillScope, skillId: string): string {
    const base = scope === "user" ? join(env.home, ".claude") : join(env.cwd, ".claude");
    return join(base, "skills", skillId, "SKILL.md");
  },

  mcpConfigPath(env: DetectEnv, scope: SkillScope): string {
    return scope === "user" ? join(env.home, ".claude", "mcp.json") : join(env.cwd, ".mcp.json");
  },

  mergeMcpConfig: mergeJsonMcpConfig,
};
