import type { ImpactNode, ReferenceInfo, SymbolInfo } from "../types.js";

/**
 * Which engine actually answered a query. Callers surface this so a result is never
 * mistaken for more than it is: `tree-sitter` matches identifier tokens by name and
 * cannot distinguish two same-named symbols in different scopes; `typescript` resolves
 * through the real type checker and can.
 */
export type BackendKind = "typescript" | "tree-sitter";

/**
 * The seam a future external language-server backend (`gopls`, `pyright`,
 * `rust-analyzer`) plugs into without touching callers — see docs/architecture.md's
 * roadmap. A backend is bound to one project root at construction so it can hold a warm
 * program/index for it.
 */
export interface SymbolBackend {
  readonly kind: BackendKind;
  readonly root: string;
  /** Top-level declarations and their members in one file. `[]` for an unsupported or unreadable file. */
  overview(filePath: string): Promise<SymbolInfo[]>;
  /** Every declaration site of `name` under `root`. */
  findSymbol(name: string): Promise<SymbolInfo[]>;
  /** Every usage site of `name` under `root`, excluding declaration sites. */
  findReferences(name: string): Promise<ReferenceInfo[]>;
  /**
   * Transitive reverse reachability from `name`: its usage sites, then the usage sites of
   * whatever encloses those, out to `maxDepth` hops — "what breaks if I change this".
   * On the `typescript` backend each hop is checker-resolved; on `tree-sitter` each hop is
   * a name match, so the whole walk inherits that backend's same-name blind spot.
   */
  impact(name: string, maxDepth?: number): Promise<ImpactNode[]>;
}
