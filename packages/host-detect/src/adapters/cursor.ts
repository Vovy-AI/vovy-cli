import { existsSync } from "node:fs";
import { join } from "node:path";
import { mergeJsonMcpConfig } from "../json-mcp-config.js";
import type { DetectEnv, HostAdapter, SkillScope } from "../types.js";

/**
 * Cursor — project rules live at `.cursor/rules/<id>.mdc`; MCP servers register in
 * `.cursor/mcp.json` (project scope) or `~/.cursor/mcp.json` (global scope), both using
 * the same `{ "mcpServers": {...} }` shape as Claude Code. https://docs.cursor.com/context/mcp
 *
 * BEST EFFORT: Cursor also ships a newer native "Skills" concept alongside Rules as of
 * mid-2026, but its exact on-disk convention wasn't independently confirmed during
 * research. This adapter targets the older, well-documented `.mdc` Rules mechanism,
 * which Cursor's own agent loop reliably picks up. If you can confirm Cursor's Skills
 * path, that's a great first PR — see docs/host-support-matrix.md.
 */
export const cursorAdapter: HostAdapter = {
  id: "cursor",
  label: "Cursor",

  detect(env: DetectEnv): boolean {
    return existsSync(join(env.home, ".cursor"));
  },

  skillFilePath(env: DetectEnv, scope: SkillScope, skillId: string): string {
    const base = scope === "user" ? join(env.home, ".cursor") : join(env.cwd, ".cursor");
    return join(base, "rules", `${skillId}.mdc`);
  },

  mcpConfigPath(env: DetectEnv, scope: SkillScope): string {
    return scope === "user"
      ? join(env.home, ".cursor", "mcp.json")
      : join(env.cwd, ".cursor", "mcp.json");
  },

  mergeMcpConfig: mergeJsonMcpConfig,
};
