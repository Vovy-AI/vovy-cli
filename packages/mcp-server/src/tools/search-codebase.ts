import { isAbsolute, resolve } from "node:path";
import {
  type BackendKind,
  backendKind,
  findReferencingSymbols,
  findSymbol,
  getSymbolsOverview,
  impactOf,
  searchPattern,
} from "@vovy-ai/context-engine";

export type SearchCodebaseAction =
  | "overview"
  | "find_symbol"
  | "find_references"
  | "impact"
  | "pattern";

export interface SearchCodebaseInput {
  action: SearchCodebaseAction;
  cwd?: string;
  filePath?: string;
  query?: string;
  /** `impact` only — how many caller hops to walk. Defaults to 3. */
  maxDepth?: number;
}

export interface SearchCodebaseResult {
  /**
   * Which engine answered. `typescript` results are resolved through the real type
   * checker; `tree-sitter` results are identifier-name matches, so two same-named symbols
   * in different scopes are indistinguishable. Returned on every call so the model reading
   * it never mistakes a name match for a proven one.
   */
  backend: BackendKind;
  results: unknown;
}

function resolvePath(root: string, filePath: string): string {
  return isAbsolute(filePath) ? filePath : resolve(root, filePath);
}

async function run(input: SearchCodebaseInput, root: string): Promise<unknown> {
  switch (input.action) {
    case "overview": {
      if (!input.filePath) {
        throw new Error('`filePath` is required for action "overview".');
      }
      return getSymbolsOverview(resolvePath(root, input.filePath), root);
    }
    case "find_symbol": {
      if (!input.query) {
        throw new Error('`query` (the symbol name) is required for action "find_symbol".');
      }
      return findSymbol(input.query, root);
    }
    case "find_references": {
      if (!input.query) {
        throw new Error('`query` (the symbol name) is required for action "find_references".');
      }
      return findReferencingSymbols(input.query, root);
    }
    case "impact": {
      if (!input.query) {
        throw new Error('`query` (the symbol name) is required for action "impact".');
      }
      return impactOf(input.query, root, input.maxDepth);
    }
    case "pattern": {
      if (!input.query) {
        throw new Error('`query` (a regex or literal string) is required for action "pattern".');
      }
      return searchPattern(input.query, root);
    }
    default: {
      const exhaustiveCheck: never = input.action;
      throw new Error(`Unknown search_codebase action "${exhaustiveCheck}".`);
    }
  }
}

/**
 * One consolidated tool with an `action` enum rather than four separate `registerTool`
 * calls — every registered MCP tool's description+schema is token overhead paid every
 * session regardless of whether it's ever called, so fewer, richer tools is itself a
 * cost-saving choice, not just a style preference. Deterministic and backed by
 * `@vovy-ai/context-engine` — no LLM calls, no network access, same ethos as
 * `analyze_project`.
 */
export async function searchCodebase(input: SearchCodebaseInput): Promise<SearchCodebaseResult> {
  const root = input.cwd ?? process.cwd();
  const results = await run(input, root);
  // `pattern` is a plain text scan that no backend resolves, but reporting the root's
  // backend anyway keeps the response shape uniform.
  return { backend: await backendKind(root), results };
}
