import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import {
  type DetectEnv,
  type HostAdapter,
  type SkillScope,
  removeCodexMcpEntry,
  removeJsonMcpEntry,
} from "@vovy-ai/host-detect";
import { SKILL_MANIFEST } from "@vovy-ai/skills";
import { resolveTargets } from "../targets.js";

export interface UninstallOptions {
  env: DetectEnv;
  hosts?: string[];
  scope?: SkillScope;
  dryRun?: boolean;
}

export interface UninstallReport {
  adapter: HostAdapter;
  removedSkillPaths: string[];
  removedMcpEntry: string | null;
}

const VOVY_ID = "vovy";

/** Removes exactly what `install` wrote: the known skill ids at the given scope, and the
 * single `vovy` entry from the host's MCP config — never touches anything else a founder
 * or another tool put in those files. */
export function runUninstall(opts: UninstallOptions): UninstallReport[] {
  const scope = opts.scope ?? "user";
  const targets = resolveTargets(opts.env, opts.hosts);
  const dryRun = opts.dryRun ?? false;

  return targets.map((adapter) => {
    const removedSkillPaths: string[] = [];
    for (const skill of SKILL_MANIFEST) {
      const path = adapter.skillFilePath(opts.env, scope, skill.id);
      if (existsSync(path)) {
        removedSkillPaths.push(path);
        if (!dryRun) rmSync(path, { force: true });
      }
    }

    let removedMcpEntry: string | null = null;
    const mcpPath = adapter.mcpConfigPath(opts.env, scope);
    if (mcpPath && existsSync(mcpPath)) {
      const existing = readFileSync(mcpPath, "utf8");
      const next =
        adapter.id === "codex"
          ? removeCodexMcpEntry(existing, VOVY_ID)
          : removeJsonMcpEntry(existing, VOVY_ID);
      if (next !== null) {
        removedMcpEntry = mcpPath;
        if (!dryRun) writeFileSync(mcpPath, next, "utf8");
      }
    }

    return { adapter, removedSkillPaths, removedMcpEntry };
  });
}
