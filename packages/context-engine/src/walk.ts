import { type Dirent, readdirSync } from "node:fs";
import { extname, join } from "node:path";

/**
 * Same ignore set as `@vovy-ai/mcp-server`'s `analyze-project.ts` — duplicated rather
 * than imported, since mcp-server depends on this package and not the other way around.
 */
const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".turbo",
  ".next",
  "coverage",
  ".cache",
]);

/** Extensions the tree-sitter symbol layer understands (see `parser.ts`'s grammar registry). */
export const CODE_EXTENSIONS = [".js", ".jsx", ".mjs", ".cjs", ".ts", ".mts", ".cts", ".tsx"];

/** Recursively lists files under `root`, skipping the same noise directories `analyze_project`
 * already ignores. Never throws — an unreadable directory is silently skipped, matching the
 * rest of this codebase's "deterministic, best-effort, no surprises" convention. */
export function walkFiles(root: string, extensions?: string[]): string[] {
  const results: string[] = [];
  const stack = [root];

  while (stack.length > 0) {
    const dir = stack.pop();
    if (!dir) continue;

    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) stack.push(full);
      } else if (entry.isFile()) {
        if (!extensions || extensions.includes(extname(entry.name))) {
          results.push(full);
        }
      }
    }
  }

  return results;
}
