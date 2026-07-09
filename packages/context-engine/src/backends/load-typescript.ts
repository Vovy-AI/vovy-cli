import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type * as TS from "typescript";

export type TypeScriptModule = typeof TS;

/**
 * Escape hatch for benchmarks, tests, and any founder whose project's TypeScript version
 * misbehaves: `VOVY_CONTEXT_BACKEND=tree-sitter` forces the fallback backend.
 */
export function forcedBackend(): string | undefined {
  return process.env.VOVY_CONTEXT_BACKEND;
}

async function importTypeScriptFrom(resolveFrom: string): Promise<TypeScriptModule | null> {
  try {
    const entry = createRequire(resolveFrom).resolve("typescript");
    const namespace = await import(pathToFileURL(entry).href);
    // `typescript` is CommonJS; an ESM dynamic import of it puts `module.exports` on
    // `default`. Older bundling setups occasionally surface the namespace directly.
    const ts = (namespace.default ?? namespace) as TypeScriptModule;
    return typeof ts?.createLanguageService === "function" ? ts : null;
  } catch {
    return null;
  }
}

/**
 * Resolves the *project's own* TypeScript, not one Vovy bundles. This is the whole reason
 * the TS backend costs a founder nothing to install: every JS/TS project that has
 * TypeScript already has it in `node_modules`, and a project that doesn't gets the
 * tree-sitter fallback rather than an 8 MB dependency it never asked for. Vovy never
 * declares `typescript` as a runtime dependency — only as a type-only devDependency.
 */
export async function loadTypeScript(root: string): Promise<TypeScriptModule | null> {
  if (forcedBackend() === "tree-sitter") return null;

  // `createRequire` needs a file path, not a directory, to anchor resolution.
  const fromProject = await importTypeScriptFrom(join(root, "package.json"));
  if (fromProject) return fromProject;

  // Second chance: a TypeScript hoisted next to Vovy's own install (a monorepo running
  // from source, or a host that already depends on it). Still never a declared dependency.
  return importTypeScriptFrom(import.meta.url);
}
