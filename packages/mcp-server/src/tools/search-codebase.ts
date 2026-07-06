import { isAbsolute, resolve } from "node:path";
import {
  findReferencingSymbols,
  findSymbol,
  getSymbolsOverview,
  searchPattern,
} from "@vovy-ai/context-engine";

export type SearchCodebaseAction = "overview" | "find_symbol" | "find_references" | "pattern";

export interface SearchCodebaseInput {
  action: SearchCodebaseAction;
  cwd?: string;
  filePath?: string;
  query?: string;
}

function resolvePath(root: string, filePath: string): string {
  return isAbsolute(filePath) ? filePath : resolve(root, filePath);
}

/**
 * One consolidated tool with an `action` enum rather than four separate `registerTool`
 * calls — every registered MCP tool's description+schema is token overhead paid every
 * session regardless of whether it's ever called, so fewer, richer tools is itself a
 * cost-saving choice, not just a style preference. Deterministic and tree-sitter-backed
 * (see `@vovy-ai/context-engine`) — no LLM calls, no network access, same ethos as
 * `analyze_project`.
 */
export async function searchCodebase(input: SearchCodebaseInput) {
  const root = input.cwd ?? process.cwd();

  switch (input.action) {
    case "overview": {
      if (!input.filePath) {
        throw new Error('`filePath` is required for action "overview".');
      }
      return getSymbolsOverview(resolvePath(root, input.filePath));
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
