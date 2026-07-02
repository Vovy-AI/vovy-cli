import {
  type DetectEnv,
  type HostAdapter,
  type SkillScope,
  type WriteResult,
  writeMcpConfig,
  writeSkillFile,
} from "@vovy-ai/host-detect";
import { getAllSkills } from "@vovy-ai/skills";
import { resolveTargets } from "../targets.js";

export interface InstallOptions {
  env: DetectEnv;
  hosts?: string[];
  scope?: SkillScope;
  dryRun?: boolean;
}

export interface InstallReport {
  adapter: HostAdapter;
  skillResults: Array<WriteResult & { skillId: string }>;
  mcpResult: WriteResult | null;
}

const VOVY_MCP_ENTRY = { id: "vovy", command: "npx", args: ["-y", "@vovy-ai/mcp-server"] };

/** Writes every skill in @vovy-ai/skills into each target host's native skill directory
 * (the primary, zero-protocol-dependency delivery mechanism), plus registers
 * @vovy-ai/mcp-server in the host's MCP config where supported (secondary, redundant path). */
export function runInstall(opts: InstallOptions): InstallReport[] {
  const scope = opts.scope ?? "user";
  const targets = resolveTargets(opts.env, opts.hosts);
  const skills = getAllSkills();

  return targets.map((adapter) => {
    const skillResults = skills.map((skill) => ({
      skillId: skill.id,
      ...writeSkillFile({
        adapter,
        env: opts.env,
        scope,
        skillId: skill.id,
        content: skill.raw,
        dryRun: opts.dryRun,
      }),
    }));

    const mcpResult = writeMcpConfig({
      adapter,
      env: opts.env,
      scope,
      entry: VOVY_MCP_ENTRY,
      dryRun: opts.dryRun,
    });

    return { adapter, skillResults, mcpResult };
  });
}
