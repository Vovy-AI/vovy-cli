import { createRequire } from "node:module";
import { join } from "node:path";
import type { DetectEnv, HostAdapter, SkillScope } from "@vovy-ai/host-detect";
import { getAllSkills } from "@vovy-ai/skills";
import { runInstall } from "./install.js";

/**
 * Mirrors `packages/mcp-server/src/tools/definitions.ts`'s `TOOL_DEFINITIONS`
 * name/title/description fields, deliberately duplicated rather than imported: `@vovy-ai/go`
 * depending on `@vovy-ai/mcp-server` would pull the MCP SDK + zod (~10MB combined) into
 * every `npx @vovy-ai/go` invocation just to read three short strings, which cuts directly
 * against the zero-friction/free-forever pitch this token-footprint feature exists to
 * support. If you add or edit a tool's name/title/description there, update this list too —
 * `doctor.test.ts` compares the two byte-for-byte via a dev-only workspace dependency, so
 * drift fails the build instead of silently under-counting the token footprint.
 */
export const MCP_TOOL_METADATA = [
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
      'Deterministic, non-LLM symbol search over a JS/TS/JSX/TSX project (no embeddings, no network access). Use this BEFORE reading whole files to answer a \'where is X handled\' / \'what calls Y\' / \'is it safe to change Z\' question — it finds the exact symbol, method, or file first, so you read one function instead of one whole file. Covers class methods, interface members, and object-literal methods, not just top-level declarations. Actions: "overview" (declarations and their members in one file, needs filePath), "find_symbol" (declaration sites of a name across the project, needs query), "find_references" (usage sites of a name, excluding declarations, needs query), "impact" (transitive blast radius: who references this symbol, who references THOSE callers, and so on, depth-tagged — the \'what breaks if I change this\' answer; needs query, optional maxDepth default 3), "pattern" (plain regex/text search fallback for non-code content, needs query). Every response names the `backend` that answered: "typescript" means results were resolved through the real type checker and each reference carries the declaration it resolves to; "tree-sitter" means results are identifier-name matches (never inside a string or comment, unlike grep) that cannot distinguish two same-named symbols in different scopes — treat those as candidates, not proof, and treat "impact" tails as over-approximate.',
  },
  {
    name: "project_memory",
    title: "Project Memory",
    description:
      'Records and recalls this project\'s decisions, mistakes, and constraints as plain markdown under .vovy/memory/, committed to git — so rationale survives across sessions, tools, and teammates with no server or account. Actions: "record" (save an entry; needs type: "decision" | "mistake" | "constraint", title, body — for decisions include what was REJECTED and why, for mistakes include why it happened and how to avoid it, for constraints include the why behind the rule), "recall" (deterministic keyword search over saved entries; needs query — use BEFORE starting non-trivial work and before revisiting any past choice), "list" (every entry\'s title and type, no bodies). Never pass secrets, API keys, or passwords in a body — entries are committed to git, and record refuses content that looks like a credential.',
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

export interface ContextBackendProbe {
  backend: "typescript" | "tree-sitter";
  /** One founder-readable sentence saying why, and what it means for result quality. */
  reason: string;
}

/**
 * Which Context Engine backend `search_codebase` will use for the project at `cwd`.
 *
 * Mirrors `@vovy-ai/context-engine`'s own selection rule (the project's resolved
 * `typescript`, with `VOVY_CONTEXT_BACKEND=tree-sitter` as the escape hatch) without
 * importing the package — pulling its WASM grammar bundle into every `npx @vovy-ai/go`
 * run just to answer a yes/no question cuts against the zero-friction pitch, the same
 * reasoning as `MCP_TOOL_METADATA` above. One honest caveat: the engine also gives
 * TypeScript a second chance to resolve from next to its own install; this probe only
 * checks the project's, which is the resolution that matters in practice.
 */
export function probeContextBackend(cwd: string): ContextBackendProbe {
  if (process.env.VOVY_CONTEXT_BACKEND === "tree-sitter") {
    return {
      backend: "tree-sitter",
      reason:
        "forced by VOVY_CONTEXT_BACKEND — name-matching only, unset to restore scope-aware search",
    };
  }
  try {
    createRequire(join(cwd, "package.json")).resolve("typescript");
    return {
      backend: "typescript",
      reason:
        "this project's own TypeScript — scope-aware, references name the declaration they resolve to",
    };
  } catch {
    return {
      backend: "tree-sitter",
      reason:
        "no typescript resolvable from this project — name matches only; `npm i -D typescript` upgrades search_codebase to scope-aware results",
    };
  }
}

export interface DoctorResult {
  reports: DoctorReport[];
  tokenFootprint: TokenFootprint;
  contextBackend: ContextBackendProbe;
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

  return {
    reports,
    tokenFootprint: computeTokenFootprint(),
    contextBackend: probeContextBackend(env.cwd),
  };
}
