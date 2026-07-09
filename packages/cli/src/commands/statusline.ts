import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { DetectEnv } from "@vovy-ai/host-detect";
import { runDoctor } from "./doctor.js";

/**
 * One line for a host's status bar (e.g. Claude Code's `statusLine` setting) — a
 * permanent, glanceable answer to "is Vovy actually active here, and in what mode",
 * instead of the founder having to remember to run `doctor`.
 *
 * Runs on every status-bar refresh, so it stays cheap: local fs reads only, no MCP
 * round-trip, no network. Memory entries are counted with a plain readdir rather than
 * imported from @vovy-ai/mcp-server — that package is deliberately not a runtime
 * dependency of the CLI (see doctor.ts's MCP_TOOL_METADATA comment for the reasoning).
 */
export function buildStatusline(env: DetectEnv): string {
  const { reports, contextBackend } = runDoctor(env);

  const healthy = reports.filter((r) => r.healthy).length;
  const skills =
    reports.length === 0
      ? "not installed"
      : `skills ${healthy}/${reports.length} host${reports.length === 1 ? "" : "s"} ok`;

  const parts = [`[vovy] ${skills}`, `engine:${contextBackend.backend}`];

  const memoryCount = countMemoryEntries(env.cwd);
  if (memoryCount > 0) parts.push(`memory:${memoryCount}`);

  return parts.join(" · ");
}

function countMemoryEntries(cwd: string): number {
  const memoryDir = join(cwd, ".vovy", "memory");
  if (!existsSync(memoryDir)) return 0;
  let count = 0;
  for (const typeDir of ["decisions", "mistakes", "constraints"]) {
    const dir = join(memoryDir, typeDir);
    if (!existsSync(dir)) continue;
    try {
      count += readdirSync(dir).filter((f) => f.endsWith(".md")).length;
    } catch {
      // Unreadable directory — show what we can count, same best-effort convention as
      // everywhere else.
    }
  }
  return count;
}
