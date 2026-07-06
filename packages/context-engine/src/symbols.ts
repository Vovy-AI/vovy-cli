import type { SyntaxNode } from "web-tree-sitter";
import { parseFile } from "./parser.js";
import type { ReferenceInfo, SymbolInfo, SymbolKind } from "./types.js";
import { CODE_EXTENSIONS, walkFiles } from "./walk.js";

/**
 * Tree-sitter node-type names for JS/TS/TSX top-level declarations. These are stable,
 * documented node types in the `tree-sitter-javascript`/`tree-sitter-typescript` grammars
 * (not internal implementation details we're guessing at).
 */
const DECLARATION_KIND_BY_NODE_TYPE: Record<string, SymbolKind> = {
  function_declaration: "function",
  class_declaration: "class",
  interface_declaration: "interface",
  type_alias_declaration: "type",
};

interface RawSymbol {
  name: string;
  kind: SymbolKind;
  exported: boolean;
  node: SyntaxNode;
}

function collectFromStatement(node: SyntaxNode, exported: boolean, out: RawSymbol[]): void {
  if (node.type === "export_statement") {
    const declaration = node.childForFieldName("declaration");
    if (declaration) {
      collectFromStatement(declaration, true, out);
    } else {
      // `export { a, b }` / `export default <expr>` — no single wrapped declaration node;
      // best-effort walk of whatever children exist rather than asserting a shape.
      for (const child of node.namedChildren) collectFromStatement(child, true, out);
    }
    return;
  }

  const kind = DECLARATION_KIND_BY_NODE_TYPE[node.type];
  if (kind) {
    const nameNode = node.childForFieldName("name");
    if (nameNode) out.push({ name: nameNode.text, kind, exported, node });
    return;
  }

  if (node.type === "lexical_declaration" || node.type === "variable_declaration") {
    for (const declarator of node.namedChildren) {
      if (declarator.type !== "variable_declarator") continue;
      const nameNode = declarator.childForFieldName("name");
      if (!nameNode) continue;
      const valueNode = declarator.childForFieldName("value");
      const isFunctionLike =
        valueNode?.type === "arrow_function" || valueNode?.type === "function_expression";
      out.push({
        name: nameNode.text,
        kind: isFunctionLike ? "function" : "variable",
        exported,
        node: declarator,
      });
    }
  }
}

function isDeclarationNameNode(node: SyntaxNode): boolean {
  const parent = node.parent;
  if (!parent) return false;
  // Compare by `.equals()`/`.id`, not `!==` — web-tree-sitter hands back a fresh Node
  // wrapper object on every access, so two references to the same underlying tree node
  // are never `===`.
  const nameNode = parent.childForFieldName("name");
  if (!nameNode || nameNode.id !== node.id) return false;
  return parent.type in DECLARATION_KIND_BY_NODE_TYPE || parent.type === "variable_declarator";
}

function toSymbolInfo(raw: RawSymbol, file: string): SymbolInfo {
  return {
    name: raw.name,
    kind: raw.kind,
    exported: raw.exported,
    file,
    startLine: raw.node.startPosition.row + 1,
    endLine: raw.node.endPosition.row + 1,
  };
}

/** Top-level functions/classes/interfaces/types/exported-consts declared directly in
 * `filePath` — not symbols nested inside them. Returns `[]` for an unsupported or
 * unreadable file rather than throwing. */
export async function getSymbolsOverview(filePath: string): Promise<SymbolInfo[]> {
  const parsed = await parseFile(filePath);
  if (!parsed) return [];
  const raw: RawSymbol[] = [];
  for (const child of parsed.rootNode.namedChildren) {
    collectFromStatement(child, false, raw);
  }
  return raw.map((s) => toSymbolInfo(s, filePath));
}

/** All declaration sites across `root` matching `name` exactly. */
export async function findSymbol(name: string, root: string): Promise<SymbolInfo[]> {
  const results: SymbolInfo[] = [];
  for (const file of walkFiles(root, CODE_EXTENSIONS)) {
    for (const symbol of await getSymbolsOverview(file)) {
      if (symbol.name === name) results.push(symbol);
    }
  }
  return results;
}

/**
 * Identifier-boundary-aware usage sites of `name` across `root` — the concrete win over
 * plain grep: matches only whole identifier tokens as tree-sitter tokenized them, never a
 * substring inside a string literal, comment, or a longer identifier. This is NOT
 * scope/type-aware like a real language server (see docs/architecture.md's Phase 2
 * roadmap) — two unrelated symbols with the same name in different scopes will both
 * appear here.
 */
export async function findReferencingSymbols(name: string, root: string): Promise<ReferenceInfo[]> {
  const results: ReferenceInfo[] = [];
  for (const file of walkFiles(root, CODE_EXTENSIONS)) {
    const parsed = await parseFile(file);
    if (!parsed) continue;
    for (const node of parsed.rootNode.descendantsOfType(["identifier", "type_identifier"])) {
      if (node.text !== name || isDeclarationNameNode(node)) continue;
      results.push({
        file,
        line: node.startPosition.row + 1,
        column: node.startPosition.column + 1,
      });
    }
  }
  return results;
}
