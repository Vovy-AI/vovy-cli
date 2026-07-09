export type SymbolKind =
  | "function"
  | "class"
  | "interface"
  | "type"
  | "variable"
  | "method"
  | "property"
  | "enum";

export interface SymbolInfo {
  name: string;
  kind: SymbolKind;
  /** Whether this symbol is exported from its file — a reasonable proxy for "public API". */
  exported: boolean;
  file: string;
  /** 1-based, inclusive. */
  startLine: number;
  /** 1-based, inclusive. */
  endLine: number;
  /** Name of the enclosing class, interface, or object literal for a member symbol.
   * Absent for a top-level declaration. */
  container?: string;
}

export interface ReferenceInfo {
  file: string;
  /** 1-based. */
  line: number;
  /** 1-based. */
  column: number;
  /**
   * The declaration this usage actually resolves to, when the backend can prove it. Only
   * the `typescript` backend fills this in; the `tree-sitter` fallback matches on name
   * alone and leaves it absent, which is precisely the difference between the two (see
   * `backendKind`).
   */
  declaration?: { file: string; startLine: number };
}

export interface PatternMatch {
  file: string;
  /** 1-based. */
  line: number;
  text: string;
}

/**
 * One usage site reached by walking the reverse call/reference graph outward from a
 * symbol — the answer to "what breaks if I change this".
 */
export interface ImpactNode {
  /** The named declaration enclosing the usage site (the caller), or `"<module>"` when the
   * usage sits at top level of a file. */
  symbol: string;
  file: string;
  /** 1-based line of the usage site itself. */
  line: number;
  /** 1 = directly references the queried symbol; 2 = references something that does; etc. */
  depth: number;
}
