import type { SyntaxNode } from "web-tree-sitter";
import { parseFile } from "../parser.js";
import type { ImpactNode, ReferenceInfo, SymbolInfo, SymbolKind } from "../types.js";
import { CODE_EXTENSIONS, walkFiles } from "../walk.js";
import type { SymbolBackend } from "./types.js";

/**
 * Tree-sitter node-type names for JS/TS/TSX declarations. Every name here was verified
 * against the shipped grammars by parsing a sample file and dumping the tree — not
 * guessed from documentation. Note the JS and TS grammars disagree on class fields
 * (`field_definition` vs `public_field_definition`), so both appear.
 */
const TOP_LEVEL_KIND_BY_NODE_TYPE: Record<string, SymbolKind> = {
  function_declaration: "function",
  generator_function_declaration: "function",
  class_declaration: "class",
  abstract_class_declaration: "class",
  interface_declaration: "interface",
  type_alias_declaration: "type",
  enum_declaration: "enum",
};

/** Node types whose `name`-field child is a declaration site, not a usage. */
const DECLARATION_PARENT_TYPES = new Set([
  ...Object.keys(TOP_LEVEL_KIND_BY_NODE_TYPE),
  "variable_declarator",
  "method_definition",
  "public_field_definition",
  "field_definition",
  "property_signature",
  "method_signature",
  "abstract_method_signature",
]);

/** Every node type that can carry an identifier we'd want to count as a reference. */
const REFERENCE_NODE_TYPES = [
  "identifier",
  "type_identifier",
  "property_identifier",
  "shorthand_property_identifier",
  "shorthand_property_identifier_pattern",
];

interface RawSymbol {
  name: string;
  kind: SymbolKind;
  exported: boolean;
  node: SyntaxNode;
  container?: string;
}

function isFunctionLike(node: SyntaxNode | null): boolean {
  return (
    node?.type === "arrow_function" ||
    node?.type === "function_expression" ||
    node?.type === "function"
  );
}

/** A `property_signature` whose type annotation is a function type is a method in all but
 * spelling (`skillFilePath: (e: E) => string`), and founders ask about it as one. */
function propertySignatureKind(node: SyntaxNode): SymbolKind {
  const annotation = node.childForFieldName("type");
  const inner = annotation?.namedChildren[0];
  return inner?.type === "function_type" ? "method" : "property";
}

/** Members of a class body, interface body, enum body, or object literal. */
function collectMembers(body: SyntaxNode, container: string, exported: boolean): RawSymbol[] {
  const out: RawSymbol[] = [];

  for (const member of body.namedChildren) {
    switch (member.type) {
      case "method_definition":
      case "method_signature":
      case "abstract_method_signature": {
        const name = member.childForFieldName("name");
        if (name) out.push({ name: name.text, kind: "method", exported, node: member, container });
        break;
      }
      case "public_field_definition":
      case "field_definition": {
        const name = member.childForFieldName("name");
        if (!name) break;
        const kind = isFunctionLike(member.childForFieldName("value")) ? "method" : "property";
        out.push({ name: name.text, kind, exported, node: member, container });
        break;
      }
      case "property_signature": {
        const name = member.childForFieldName("name");
        if (name) {
          out.push({
            name: name.text,
            kind: propertySignatureKind(member),
            exported,
            node: member,
            container,
          });
        }
        break;
      }
      case "pair": {
        const key = member.childForFieldName("key");
        if (!key) break;
        const kind = isFunctionLike(member.childForFieldName("value")) ? "method" : "property";
        out.push({ name: key.text, kind, exported, node: member, container });
        break;
      }
      case "shorthand_property_identifier": {
        // `{ mergeMcpConfig }` — simultaneously a property declaration and a reference to
        // the binding of the same name. Reported as a property here; `findReferences`
        // deliberately still counts it as a usage, since tree-sitter alone cannot say
        // which of the two the caller meant.
        out.push({ name: member.text, kind: "property", exported, node: member, container });
        break;
      }
      case "property_identifier": {
        // Enum members are bare `property_identifier` children of `enum_body`.
        if (body.type === "enum_body") {
          out.push({ name: member.text, kind: "property", exported, node: member, container });
        }
        break;
      }
      default:
        break;
    }
  }

  return out;
}

/** The member-bearing bodies only — a `function_declaration`'s body is a `statement_block`,
 * whose locals are not symbols anyone searches for by container. */
const MEMBER_BODY_TYPES = new Set(["class_body", "interface_body", "enum_body"]);

function memberBodyOf(node: SyntaxNode): SyntaxNode | null {
  const body = node.childForFieldName("body");
  return body && MEMBER_BODY_TYPES.has(body.type) ? body : null;
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

  const kind = TOP_LEVEL_KIND_BY_NODE_TYPE[node.type];
  if (kind) {
    const nameNode = node.childForFieldName("name");
    if (!nameNode) return;
    out.push({ name: nameNode.text, kind, exported, node });
    const body = memberBodyOf(node);
    if (body) out.push(...collectMembers(body, nameNode.text, exported));
    return;
  }

  if (node.type === "lexical_declaration" || node.type === "variable_declaration") {
    for (const declarator of node.namedChildren) {
      if (declarator.type !== "variable_declarator") continue;
      const nameNode = declarator.childForFieldName("name");
      if (!nameNode) continue;
      const valueNode = declarator.childForFieldName("value");
      out.push({
        name: nameNode.text,
        kind: isFunctionLike(valueNode) ? "function" : "variable",
        exported,
        node: declarator,
      });
      // `export const claudeCodeAdapter: HostAdapter = { detect() {...} }` — the four
      // methods hanging off this object are the symbols a founder actually asks about,
      // and before this they were invisible to the engine entirely.
      if (valueNode?.type === "object") {
        out.push(...collectMembers(valueNode, nameNode.text, exported));
      }
    }
  }
}

function isDeclarationNameNode(node: SyntaxNode): boolean {
  const parent = node.parent;
  if (!parent) return false;

  // `pair` keys and `enum_body` members are declaration sites too, but neither is reached
  // through a `name` field.
  if (parent.type === "pair") {
    const key = parent.childForFieldName("key");
    return key?.id === node.id;
  }
  if (parent.type === "enum_body") return true;

  // Compare by `.id`, not `!==` — web-tree-sitter hands back a fresh Node wrapper object
  // on every access, so two references to the same underlying tree node are never `===`.
  const nameNode = parent.childForFieldName("name");
  if (!nameNode || nameNode.id !== node.id) return false;
  return DECLARATION_PARENT_TYPES.has(parent.type);
}

function toSymbolInfo(raw: RawSymbol, file: string): SymbolInfo {
  const info: SymbolInfo = {
    name: raw.name,
    kind: raw.kind,
    exported: raw.exported,
    file,
    startLine: raw.node.startPosition.row + 1,
    endLine: raw.node.endPosition.row + 1,
  };
  if (raw.container) info.container = raw.container;
  return info;
}

export async function treeSitterOverview(filePath: string): Promise<SymbolInfo[]> {
  const parsed = await parseFile(filePath);
  if (!parsed) return [];
  const raw: RawSymbol[] = [];
  for (const child of parsed.rootNode.namedChildren) {
    collectFromStatement(child, false, raw);
  }
  return raw.map((s) => toSymbolInfo(s, filePath));
}

/** Node types whose `name` field names the enclosing declaration a usage site belongs to. */
const NAMED_ANCESTOR_TYPES = new Set([
  "function_declaration",
  "generator_function_declaration",
  "method_definition",
  "variable_declarator",
  "public_field_definition",
  "field_definition",
  "class_declaration",
]);

/**
 * The nearest named declaration enclosing the node at (`line`, `column`) in `file` —
 * tree-sitter's version of "what breaks next". Broader than function-likes for the same
 * reason as the `typescript` backend's `enclosingNamedDeclaration`: a usage inside an
 * object-literal property must walk on through the property (`pair` key) or the variable
 * holding the object, or the blast-radius walk dead-ends at "<module>". Import statements
 * have no named ancestor here, so usages on import lines stay "<module>" and seed nothing.
 */
async function enclosingNamedDeclaration(
  file: string,
  line: number,
  column: number,
): Promise<string | null> {
  const parsed = await parseFile(file);
  if (!parsed) return null;

  let node: SyntaxNode | null = parsed.rootNode.descendantForPosition({
    row: line - 1,
    column: column - 1,
  });
  const startId = node?.id;

  while (node && node.type !== "program") {
    if (node.type === "import_statement") return null;
    if (NAMED_ANCESTOR_TYPES.has(node.type)) {
      const name = node.childForFieldName("name");
      if (name && name.id !== startId) return name.text;
    }
    if (node.type === "pair") {
      const key = node.childForFieldName("key");
      if (key && key.id !== startId) return key.text;
    }
    node = node.parent;
  }
  return null;
}

/**
 * Name-matching, identifier-boundary-aware symbol search. The concrete win over plain
 * grep: matches only whole identifier tokens as tree-sitter tokenized them, never a
 * substring inside a string literal, comment, or a longer identifier. The concrete
 * limitation, unchanged by the recall work above: this is NOT scope- or type-aware, so
 * two unrelated symbols sharing a name both appear. Use the `typescript` backend when a
 * project has TypeScript available and that distinction matters.
 */
export function createTreeSitterBackend(root: string): SymbolBackend {
  async function findReferences(name: string): Promise<ReferenceInfo[]> {
    const results: ReferenceInfo[] = [];
    for (const file of walkFiles(root, CODE_EXTENSIONS)) {
      const parsed = await parseFile(file);
      if (!parsed) continue;
      for (const node of parsed.rootNode.descendantsOfType(REFERENCE_NODE_TYPES)) {
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

  return {
    kind: "tree-sitter",
    root,

    overview: treeSitterOverview,

    async findSymbol(name: string): Promise<SymbolInfo[]> {
      const results: SymbolInfo[] = [];
      for (const file of walkFiles(root, CODE_EXTENSIONS)) {
        for (const symbol of await treeSitterOverview(file)) {
          if (symbol.name === name) results.push(symbol);
        }
      }
      return results;
    },

    findReferences,

    async impact(name: string, maxDepth = 3): Promise<ImpactNode[]> {
      // BFS outward over *name* edges — each hop finds references of the caller's name,
      // not of a resolved symbol, so the whole walk inherits this backend's same-name
      // blind spot and can over-report. Callers see `backend: "tree-sitter"` on the
      // response and must treat these as candidates, not proof.
      const results: ImpactNode[] = [];
      const visitedNames = new Set([name]);
      const seenSites = new Set<string>();
      let frontier = [name];

      for (let depth = 1; depth <= maxDepth && frontier.length > 0; depth++) {
        const next: string[] = [];

        for (const currentName of frontier) {
          for (const reference of await findReferences(currentName)) {
            const siteKey = `${reference.file}:${reference.line}:${reference.column}`;
            if (seenSites.has(siteKey)) continue;
            seenSites.add(siteKey);

            const caller = await enclosingNamedDeclaration(
              reference.file,
              reference.line,
              reference.column,
            );
            results.push({
              symbol: caller ?? "<module>",
              file: reference.file,
              line: reference.line,
              depth,
            });

            if (caller && !visitedNames.has(caller)) {
              visitedNames.add(caller);
              next.push(caller);
            }
          }
        }

        frontier = next;
      }

      return results;
    },
  };
}
