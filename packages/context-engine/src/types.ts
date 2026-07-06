export type SymbolKind = "function" | "class" | "interface" | "type" | "variable";

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
}

export interface ReferenceInfo {
  file: string;
  /** 1-based. */
  line: number;
  /** 1-based. */
  column: number;
}

export interface PatternMatch {
  file: string;
  /** 1-based. */
  line: number;
  text: string;
}
