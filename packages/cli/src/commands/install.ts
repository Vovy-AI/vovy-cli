import {
  type DetectEnv,
  type HostAdapter,
  type SkillScope,
  type WriteResult,
  writeMcpConfig,
  writeSkillFile,
} from "@vovy-ai/host-detect";
import { detectProjectContext, getAllSkills } from "@vovy-ai/skills";
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

  // A project-scoped skill lives in one repo and may name that repo's stack, which makes
  // its description match the founder's own words more often. A user-scoped skill applies
  // to every project on the machine, so it must stay generic — naming the stack of
  // whichever directory `install` happened to run in would be actively wrong everywhere
  // else.
  const skills = getAllSkills(scope === "project" ? detectProjectContext(opts.env.cwd) : undefined);

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
