import { existsSync } from "node:fs";
import { join } from "node:path";
import { mergeJsonMcpConfig } from "../json-mcp-config.js";
import type { DetectEnv, HostAdapter, SkillScope } from "../types.js";

/**
 * Windsurf — project rules live as flat markdown files under `.windsurf/rules/`, read by
 * Cascade (Windsurf's agent) as always-on context, similar in shape to Cline's convention.
 * Global config, including MCP servers, lives under `~/.codeium/windsurf/`.
 *
 * BEST EFFORT: the exact MCP config filename/shape below was not independently confirmed
 * against a live Windsurf install during research — flagged in
 * docs/host-support-matrix.md as a good first contribution to verify/fix.
 */
export const windsurfAdapter: HostAdapter = {
  id: "windsurf",
  label: "Windsurf",

  detect(env: DetectEnv): boolean {
    return existsSync(join(env.home, ".codeium", "windsurf"));
  },

  skillFilePath(env: DetectEnv, scope: SkillScope, skillId: string): string {
    const base =
      scope === "user" ? join(env.home, ".codeium", "windsurf") : join(env.cwd, ".windsurf");
    return join(base, "rules", `${skillId}.md`);
  },

  mcpConfigPath(env: DetectEnv, _scope: SkillScope): string {
    return join(env.home, ".codeium", "windsurf", "mcp_config.json");
  },

  mergeMcpConfig: mergeJsonMcpConfig,
};
