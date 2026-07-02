import type { DetectEnv, HostAdapter, SkillScope } from "@vovy-ai/host-detect";
import { getAllSkills } from "@vovy-ai/skills";
import { runInstall } from "./install.js";

export type DoctorStatus = "ok" | "missing" | "stale";

export interface DoctorEntry {
  skillId: string;
  path: string;
  status: DoctorStatus;
}

export interface DoctorReport {
  adapter: HostAdapter;
  entries: DoctorEntry[];
  mcp: { path: string; status: DoctorStatus } | null;
  healthy: boolean;
}

/** Read-only health check: reuses `runInstall`'s dry-run mode so "would this change
 * anything" and "is this actually installed" can never drift apart into two separate,
 * inconsistent code paths. */
export function runDoctor(env: DetectEnv, hosts?: string[], scope?: SkillScope): DoctorReport[] {
  const dryRunResults = runInstall({ env, hosts, scope, dryRun: true });
  const totalSkillCount = getAllSkills().length;

  return dryRunResults.map(({ adapter, skillResults, mcpResult }) => {
    const entries: DoctorEntry[] = skillResults.map((r) => ({
      skillId: r.skillId,
      path: r.path,
      status: r.action === "unchanged" ? "ok" : r.action === "created" ? "missing" : "stale",
    }));
    const mcp = mcpResult
      ? {
          path: mcpResult.path,
          status: (mcpResult.action === "unchanged" ? "ok" : "stale") as DoctorStatus,
        }
      : null;

    return {
      adapter,
      entries,
      mcp,
      healthy:
        entries.length === totalSkillCount &&
        entries.every((e) => e.status === "ok") &&
        (mcp === null || mcp.status === "ok"),
    };
  });
}
