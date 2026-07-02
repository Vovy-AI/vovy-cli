import { existsSync } from "node:fs";
import { join } from "node:path";
import type { DetectEnv, HostAdapter, SkillScope } from "../types.js";

/**
 * Cline — project instructions live as flat markdown files under `.clinerules/`, one
 * file per concern rather than Claude/Codex's folder-per-skill convention; Cline's own
 * agent loop reads every file in that directory as always-on context.
 *
 * BEST EFFORT: Cline is a VS Code extension, not a standalone CLI/config-dir tool, so
 * there's no reliable filesystem signal to auto-detect it's installed — `detect()` here
 * always returns false, meaning Cline is only set up via an explicit `--host cline` flag,
 * never silently. MCP registration is intentionally unimplemented for v0.1 (Cline's MCP
 * config lives inside VS Code's extension storage, which varies by OS/VS Code variant
 * and wasn't independently confirmed) — the `.clinerules/` skill file alone is enough for
 * Cline's agent loop to pick up Vovy's skills. See docs/host-support-matrix.md.
 */
export const clineAdapter: HostAdapter = {
  id: "cline",
  label: "Cline",

  detect(_env: DetectEnv): boolean {
    return false;
  },

  skillFilePath(env: DetectEnv, scope: SkillScope, skillId: string): string {
    const base = scope === "user" ? join(env.home, ".clinerules") : join(env.cwd, ".clinerules");
    return join(base, `${skillId}.md`);
  },

  mcpConfigPath(_env: DetectEnv, _scope: SkillScope): null {
    return null;
  },

  mergeMcpConfig(_existing: string | undefined): string {
    throw new Error("Cline MCP config registration is not yet supported — skill files only.");
  },
};
