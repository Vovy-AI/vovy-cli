import { findProjectRoot, selectBackend } from "./backends/index.js";
import type { ImpactNode, ReferenceInfo, SymbolInfo } from "./types.js";

/**
 * Top-level declarations in `filePath`, plus the members hanging off them (class methods,
 * interface members, object-literal methods). Returns `[]` for an unsupported or
 * unreadable file rather than throwing.
 *
 * `root` decides which backend answers (see `selectBackend`); when omitted it is inferred
 * from `filePath`'s nearest project marker.
 */
export async function getSymbolsOverview(filePath: string, root?: string): Promise<SymbolInfo[]> {
  const backend = await selectBackend(root ?? findProjectRoot(filePath));
  return backend.overview(filePath);
}

/** All declaration sites across `root` matching `name` exactly. */
export async function findSymbol(name: string, root: string): Promise<SymbolInfo[]> {
  const backend = await selectBackend(root);
  return backend.findSymbol(name);
}

/**
 * Usage sites of `name` across `root`, excluding declaration sites.
 *
 * With the `typescript` backend each result carries the `declaration` it resolves to, so
 * two same-named symbols in different scopes stay distinguishable. With the `tree-sitter`
 * fallback, results are identifier-token matches by name — never a substring inside a
 * string literal or comment (the concrete win over grep), but not scope- or type-aware.
 * Call `backendKind(root)` to find out which answered.
 */
export async function findReferencingSymbols(name: string, root: string): Promise<ReferenceInfo[]> {
  const backend = await selectBackend(root);
  return backend.findReferences(name);
}

/**
 * "What breaks if I change this": usage sites of `name`, then usage sites of the callers
 * enclosing those, out to `maxDepth` hops, each tagged with its depth. With the
 * `typescript` backend every hop is checker-resolved; with `tree-sitter` every hop is a
 * name match and can over-report — check `backendKind(root)` before trusting the tail.
 */
export async function impactOf(name: string, root: string, maxDepth = 3): Promise<ImpactNode[]> {
  const backend = await selectBackend(root);
  return backend.impact(name, maxDepth);
}
