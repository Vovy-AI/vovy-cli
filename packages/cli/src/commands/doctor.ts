import type { DetectEnv, HostAdapter, SkillScope } from "@vovy-ai/host-detect";
import { getAllSkills } from "@vovy-ai/skills";
import { runInstall } from "./install.js";

/**
 * Mirrors `packages/mcp-server/src/tools/definitions.ts`'s `TOOL_DEFINITIONS`
 * name/title/description fields, deliberately duplicated rather than imported: `@vovy-ai/go`
 * depending on `@vovy-ai/mcp-server` would pull the MCP SDK + zod (~10MB combined) into
 * every `npx @vovy-ai/go` invocation just to read three short strings, which cuts directly
 * against the zero-friction/free-forever pitch this token-footprint feature exists to
 * support. If you add or edit a tool's name/title/description there, update this list too.
 */
const MCP_TOOL_METADATA = [
  {
    name: "analyze_project",
    title: "Analyze Project",
    description:
      "Deterministic, non-LLM static analysis of a project: detected framework/stack, package manager, test runner, top-level directories, and any obvious security footguns (e.g. an untracked .env). No network access, no guessing.",
  },
  {
    name: "search_codebase",
    title: "Search Codebase",
    description:
      'Deterministic, non-LLM symbol search over a JS/TS/JSX/TSX project via tree-sitter (no embeddings, no network access). Use this BEFORE reading whole files to answer a \'where is X handled\' / \'how does Y work\' question — it finds the exact symbol or file first so you read only what\'s relevant, not entire files. Actions: "overview" (top-level functions/classes/interfaces/exports in one file, needs filePath), "find_symbol" (declaration sites of a name across the project, needs query), "find_references" (identifier-boundary-aware usage sites of a name — more precise than grep since it never matches inside a string/comment, needs query), "pattern" (plain regex/text search fallback for non-code content, needs query).',
  },
];

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

/**
 * A rough, deterministic estimate — chars/4, the same well-known heuristic caveman's own
 * benchmark uses — not an exact tokenizer count. Good enough to compare "does adding a
 * skill roughly double this" without pulling in a tokenizer dependency.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface TokenFootprint {
  skillCount: number;
  skillsEstTokens: number;
  toolCount: number;
  toolsEstTokens: number;
  /** What every session pays whether or not any skill fires or any tool gets called —
   * this is the honest, buildable version of "cost savings": show the real number
   * instead of an unverifiable savings-percentage marketing claim. */
  totalEstTokens: number;
}

function computeTokenFootprint(): TokenFootprint {
  const skills = getAllSkills();
  const skillsEstTokens = skills.reduce((sum, skill) => sum + estimateTokens(skill.raw), 0);
  const toolsEstTokens = MCP_TOOL_METADATA.reduce(
    (sum, tool) => sum + estimateTokens(tool.name + tool.title + tool.description),
    0,
  );
  return {
    skillCount: skills.length,
    skillsEstTokens,
    toolCount: MCP_TOOL_METADATA.length,
    toolsEstTokens,
    totalEstTokens: skillsEstTokens + toolsEstTokens,
  };
}

export interface DoctorResult {
  reports: DoctorReport[];
  tokenFootprint: TokenFootprint;
}

/** Read-only health check: reuses `runInstall`'s dry-run mode so "would this change
 * anything" and "is this actually installed" can never drift apart into two separate,
 * inconsistent code paths. */
export function runDoctor(env: DetectEnv, hosts?: string[], scope?: SkillScope): DoctorResult {
  const dryRunResults = runInstall({ env, hosts, scope, dryRun: true });
  const totalSkillCount = getAllSkills().length;

  const reports = dryRunResults.map(({ adapter, skillResults, mcpResult }) => {
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

  return { reports, tokenFootprint: computeTokenFootprint() };
}
