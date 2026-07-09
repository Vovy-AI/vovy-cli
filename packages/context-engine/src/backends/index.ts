import { existsSync } from "node:fs";
import { dirname, join, parse } from "node:path";
import { loadTypeScript } from "./load-typescript.js";
import { createTreeSitterBackend } from "./tree-sitter.js";
import type { BackendKind, SymbolBackend } from "./types.js";
import { createTypeScriptBackend } from "./typescript.js";

const ROOT_MARKERS = ["package.json", "tsconfig.json", ".git"];

/**
 * Nearest ancestor directory holding a project marker. Callers that already know the root
 * (the MCP tool always does — it's `cwd`) should pass it rather than rely on this.
 */
export function findProjectRoot(fromPath: string): string {
  let dir = existsSync(fromPath) && !parse(fromPath).ext ? fromPath : dirname(fromPath);
  const { root } = parse(dir);
  while (dir !== root) {
    if (ROOT_MARKERS.some((marker) => existsSync(join(dir, marker)))) return dir;
    dir = dirname(dir);
  }
  return dirname(fromPath);
}

// One backend per root, reused for the life of the process — building a TypeScript program
// is the expensive part, and every subsequent query against the same root is warm.
const backendCache = new Map<string, Promise<SymbolBackend>>();

export function selectBackend(root: string): Promise<SymbolBackend> {
  const cached = backendCache.get(root);
  if (cached) return cached;

  const created = (async (): Promise<SymbolBackend> => {
    const ts = await loadTypeScript(root);
    return ts ? createTypeScriptBackend(ts, root) : createTreeSitterBackend(root);
  })();

  backendCache.set(root, created);
  return created;
}

/** Which backend will answer queries for `root` — surfaced to callers so a `tree-sitter`
 * result is never read as if a type checker had vouched for it. */
export async function backendKind(root: string): Promise<BackendKind> {
  return (await selectBackend(root)).kind;
}

export { createTreeSitterBackend } from "./tree-sitter.js";
export { createTypeScriptBackend } from "./typescript.js";
export type { BackendKind, SymbolBackend } from "./types.js";
