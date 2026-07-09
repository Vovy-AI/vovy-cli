import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

/** Source entry points tried, in order, for a workspace package that builds to `dist`. */
const SOURCE_ENTRIES = ["src/index.ts", "src/index.tsx", "src/index.js", "index.ts"];

function packageGlobs(root: string): string[] {
  const pnpmWorkspace = join(root, "pnpm-workspace.yaml");
  if (existsSync(pnpmWorkspace)) {
    // Deliberately not a YAML parser: the only shape that matters is a `packages:` list of
    // quoted or bare globs, and taking on a YAML dependency to read four lines would cost
    // more than it buys.
    const lines = readFileSync(pnpmWorkspace, "utf8").split(/\r?\n/);
    const start = lines.findIndex((line) => line.trim() === "packages:");
    if (start === -1) return [];
    const globs: string[] = [];
    for (const line of lines.slice(start + 1)) {
      const match = line.match(/^\s*-\s*["']?([^"'\s#]+)["']?\s*$/);
      if (!match?.[1]) break;
      globs.push(match[1]);
    }
    return globs;
  }

  const packageJsonPath = join(root, "package.json");
  if (!existsSync(packageJsonPath)) return [];
  try {
    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    const workspaces = Array.isArray(pkg.workspaces) ? pkg.workspaces : pkg.workspaces?.packages;
    return Array.isArray(workspaces) ? workspaces : [];
  } catch {
    return [];
  }
}

/** Expands `packages/*` and literal directory entries. Deeper glob syntax is not supported
 * and is skipped rather than half-matched. */
function expandGlob(root: string, glob: string): string[] {
  if (!glob.includes("*")) {
    const dir = join(root, glob);
    return existsSync(join(dir, "package.json")) ? [dir] : [];
  }
  if (!glob.endsWith("/*")) return [];
  const parent = join(root, glob.slice(0, -2));
  try {
    return readdirSync(parent, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(parent, entry.name))
      .filter((dir) => existsSync(join(dir, "package.json")));
  } catch {
    return [];
  }
}

/**
 * `paths` entries mapping each workspace package's name to its **source** entry point.
 *
 * Without this, a monorepo's cross-package import (`packages/cli` importing
 * `@vovy-ai/host-detect`) resolves through the built `dist/index.d.ts`, which the checker
 * treats as a different symbol from the one declared in `src/`. `find_references` on a
 * symbol in one package would then silently omit every usage in a sibling package —
 * strictly worse than the grep it replaces, and silently so. Verified against this repo:
 * before this mapping, `find_references("detect")` missed `packages/cli/src/targets.ts`.
 *
 * A single-package project (the common case for the founders Vovy targets) has no
 * workspaces and gets an empty mapping, costing nothing.
 */
export function workspaceSourcePaths(root: string): Record<string, string[]> {
  const paths: Record<string, string[]> = {};

  for (const glob of packageGlobs(root)) {
    for (const packageDir of expandGlob(root, glob)) {
      let name: string;
      try {
        name = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8")).name;
      } catch {
        continue;
      }
      if (typeof name !== "string" || !name) continue;

      const entry = SOURCE_ENTRIES.map((candidate) => join(packageDir, candidate)).find((file) =>
        existsSync(file),
      );
      if (!entry) continue;

      paths[name] = [entry];
      paths[`${name}/*`] = [join(dirname(entry), "*")];
    }
  }

  return paths;
}
