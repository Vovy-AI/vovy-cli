import { readFileSync, statSync } from "node:fs";
import { existsSync } from "node:fs";
import { join, sep } from "node:path";
import type * as TS from "typescript";
import type { ImpactNode, ReferenceInfo, SymbolInfo, SymbolKind } from "../types.js";
import { CODE_EXTENSIONS, walkFiles } from "../walk.js";
import type { TypeScriptModule } from "./load-typescript.js";
import { treeSitterOverview } from "./tree-sitter.js";
import type { SymbolBackend } from "./types.js";
import { workspaceSourcePaths } from "./workspace-paths.js";

/**
 * `ts.ScriptElementKind` values mapped onto Vovy's own vocabulary. The values are string
 * literals in the TypeScript public API (`ScriptElementKind.functionElement === "function"`),
 * so this is a stable contract, not an internal detail. A `Map` rather than an object
 * literal because one of the keys is `constructor`, which an object literal would resolve
 * against `Object.prototype` instead of the index signature.
 */
const KIND_BY_SCRIPT_ELEMENT_KIND = new Map<string, SymbolKind>([
  ["function", "function"],
  ["local function", "function"],
  ["class", "class"],
  ["local class", "class"],
  ["interface", "interface"],
  ["type", "type"],
  ["enum", "enum"],
  ["enum member", "property"],
  ["var", "variable"],
  ["let", "variable"],
  ["const", "variable"],
  ["local var", "variable"],
  ["alias", "variable"],
  ["method", "method"],
  ["local method", "method"],
  ["property", "property"],
  ["getter", "property"],
  ["setter", "property"],
  ["constructor", "method"],
]);

function symbolKindFor(scriptElementKind: string): SymbolKind {
  return KIND_BY_SCRIPT_ELEMENT_KIND.get(scriptElementKind) ?? "variable";
}

function compilerOptionsFor(ts: TypeScriptModule, root: string): TS.CompilerOptions {
  const workspacePaths = workspaceSourcePaths(root);
  const configPath = join(root, "tsconfig.json");

  if (existsSync(configPath)) {
    const { config, error } = ts.readConfigFile(configPath, ts.sys.readFile);
    if (!error && config) {
      const parsed = ts.parseJsonConfigFileContent(config, ts.sys, root);
      // `allowNonTsExtensions` lets the program hold `.mjs`/`.cjs` files a project's own
      // tsconfig would otherwise exclude — a founder asking "where is X" doesn't care that
      // X lives in a build script rather than in `include`.
      return {
        ...parsed.options,
        allowJs: true,
        allowNonTsExtensions: true,
        noEmit: true,
        baseUrl: parsed.options.baseUrl ?? root,
        paths: { ...workspacePaths, ...parsed.options.paths },
      };
    }
  }

  return {
    allowJs: true,
    allowNonTsExtensions: true,
    noEmit: true,
    esModuleInterop: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    baseUrl: root,
    paths: workspacePaths,
  };
}

function createLanguageService(ts: TypeScriptModule, root: string): TS.LanguageService {
  // The file set is taken from Vovy's own walker rather than from `tsconfig.include`, so
  // that scripts, config files, and untracked corners of a project are all searchable —
  // the walker already skips node_modules/dist/.next and friends.
  const fileNames = walkFiles(root, CODE_EXTENSIONS);
  const options = compilerOptionsFor(ts, root);

  const host: TS.LanguageServiceHost = {
    getScriptFileNames: () => fileNames,
    getScriptVersion: (fileName) => {
      try {
        return String(statSync(fileName).mtimeMs);
      } catch {
        return "0";
      }
    },
    getScriptSnapshot: (fileName) => {
      try {
        return ts.ScriptSnapshot.fromString(readFileSync(fileName, "utf8"));
      } catch {
        return undefined;
      }
    },
    getCurrentDirectory: () => root,
    getCompilationSettings: () => options,
    getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
  };

  return ts.createLanguageService(host, ts.createDocumentRegistry());
}

/**
 * TypeScript normalizes every file name to forward slashes internally, on all platforms.
 * On Windows that made `isProjectFile` (comparing against a backslash `root + sep`) reject
 * every declaration, so `find_symbol` returned `[]` — caught by the Windows CI matrix, not
 * locally. Comparisons happen in TypeScript's format; anything *returned* to callers goes
 * back through `toNativePath` so both backends emit paths in the platform's own format.
 */
function toForwardSlashes(path: string): string {
  return path.replace(/\\/g, "/");
}

function toNativePath(path: string): string {
  return sep === "/" ? path : path.replace(/\//g, sep);
}

/** `.d.ts` and anything under node_modules is machinery, not the founder's own code. */
function isProjectFile(root: string, fileName: string): boolean {
  const normalized = toForwardSlashes(fileName);
  return (
    normalized.startsWith(`${toForwardSlashes(root)}/`) &&
    !normalized.includes("/node_modules/") &&
    !normalized.endsWith(".d.ts")
  );
}

function lineOf(ts: TypeScriptModule, sourceFile: TS.SourceFile, position: number): number {
  return ts.getLineAndCharacterOfPosition(sourceFile, position).line + 1;
}

function columnOf(ts: TypeScriptModule, sourceFile: TS.SourceFile, position: number): number {
  return ts.getLineAndCharacterOfPosition(sourceFile, position).character + 1;
}

/** The innermost node whose span contains `position`. */
function nodeAtPosition(sourceFile: TS.SourceFile, position: number): TS.Node {
  let current: TS.Node = sourceFile;
  outer: while (true) {
    for (const child of current.getChildren(sourceFile)) {
      if (child.getStart(sourceFile) <= position && position < child.getEnd()) {
        current = child;
        continue outer;
      }
    }
    return current;
  }
}

/**
 * Node kinds that declare a name, enumerated explicitly rather than left to
 * `getNameOfDeclaration`, which also answers for a `PropertyAccessExpression` (TypeScript
 * models `exports.foo = ...` as a declaration). Trusting it unguarded classifies every
 * `adapter.detect(...)` call site as a declaration and silently returns zero references.
 *
 * `ImportSpecifier`/`ExportSpecifier` are deliberately absent: `import { writeSkillFile }`
 * is a site that breaks if the symbol is renamed, which is exactly what a caller asking for
 * references wants to know about.
 */
function isDeclarationNode(ts: TypeScriptModule, node: TS.Node): boolean {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isClassDeclaration(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isEnumDeclaration(node) ||
    ts.isEnumMember(node) ||
    ts.isVariableDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isMethodSignature(node) ||
    ts.isPropertyDeclaration(node) ||
    ts.isPropertySignature(node) ||
    ts.isPropertyAssignment(node) ||
    ts.isShorthandPropertyAssignment(node) ||
    ts.isGetAccessor(node) ||
    ts.isSetAccessor(node) ||
    ts.isParameter(node) ||
    ts.isTypeParameterDeclaration(node) ||
    ts.isBindingElement(node) ||
    ts.isModuleDeclaration(node)
  );
}

/**
 * The nearest *named declaration* enclosing `position` — the thing that breaks next if the
 * symbol used at `position` changes, for the purposes of walking the reverse call graph.
 *
 * Deliberately broader than function-likes: a usage inside `mergeMcpConfig:
 * mergeJsonMcpConfig` (a property assignment in an adapter object literal) must walk on
 * through the *property*, or the blast-radius walk dead-ends at "<module>" and never
 * reaches the code that calls `adapter.mergeMcpConfig(...)` — found by dogfooding against
 * this very repo. Parameters, binding elements, and type parameters are climbed *past*:
 * they name a slot, not a thing anyone references. Import specifiers never match (they are
 * excluded from `isDeclarationNode`), so a usage on an import line stays "<module>" and
 * seeds nothing.
 */
function enclosingNamedDeclaration(
  ts: TypeScriptModule,
  sourceFile: TS.SourceFile,
  position: number,
): { name: string; nameStart: number } | null {
  let node: TS.Node | undefined = nodeAtPosition(sourceFile, position);
  while (node && !ts.isSourceFile(node)) {
    const passThrough =
      ts.isParameter(node) || ts.isTypeParameterDeclaration(node) || ts.isBindingElement(node);
    if (!passThrough && isDeclarationNode(ts, node)) {
      const nameNode = ts.getNameOfDeclaration(node as TS.Declaration);
      // A named ancestor whose *name* is the position we started from is the declaration
      // itself, not an enclosing one — keep climbing (defensive; callers already filter
      // declaration sites).
      if (nameNode && nameNode.getStart(sourceFile) !== position) {
        return { name: nameNode.getText(sourceFile), nameStart: nameNode.getStart(sourceFile) };
      }
    }
    node = node.parent;
  }
  return null;
}

/**
 * Whether `position` sits on the identifier that names a declaration, in any of the forms
 * TypeScript accepts — `function f()`, `f() {}` inside a class or object literal,
 * `f: () => {}`, `f: importedFn`, `get f()`. `getNavigateToItems` indexes only some of
 * these, so excluding declarations by comparing against its offsets misses the rest and
 * reports them as usages of themselves (verified: `mergeMcpConfig: mergeJsonMcpConfig`).
 */
function isDeclarationName(ts: TypeScriptModule, sourceFile: TS.SourceFile, position: number) {
  const node = nodeAtPosition(sourceFile, position);
  const parent = node.parent;
  if (!parent || !isDeclarationNode(ts, parent)) return false;
  const name = ts.getNameOfDeclaration(parent as TS.Declaration);
  return (
    !!name &&
    name.getStart(sourceFile) === node.getStart(sourceFile) &&
    name.getEnd() === node.getEnd()
  );
}

/**
 * Offset of the identifier that *names* the declaration `item` points at.
 *
 * `NavigateToItem.textSpan` covers the whole declaration (`export function foo() {...}`),
 * not the name token. That span is exactly what we want for `startLine`/`endLine`, but
 * `getReferencesAtPosition` wants a position on the name, and reports the name's own
 * offset back when it lists the declaration among the references. Both needs are met by
 * finding the outermost named declaration inside the span.
 */
function declarationNameStart(
  ts: TypeScriptModule,
  sourceFile: TS.SourceFile,
  item: TS.NavigateToItem,
): number | undefined {
  const spanStart = item.textSpan.start;
  const spanEnd = spanStart + item.textSpan.length;
  let found: number | undefined;

  const visit = (node: TS.Node): void => {
    if (found !== undefined) return;
    if (node.getEnd() <= spanStart || node.getStart(sourceFile) >= spanEnd) return;
    const nameNode = ts.getNameOfDeclaration(node as TS.Declaration);
    if (nameNode && nameNode.getText(sourceFile) === item.name) {
      found = nameNode.getStart(sourceFile);
      return;
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);

  return found;
}

/**
 * Declarations whose children are *members* worth listing in an overview. A function's
 * children are its body's locals, which nobody means by "what does this file define" — and
 * listing them made `overview` of one file cost more estimated tokens than reading the whole
 * file, the exact cost the Context Engine exists to remove (caught by
 * `scripts/eval-context-engine`, which scored that query at -14%).
 */
function containerKinds(ts: TypeScriptModule): Set<string> {
  return new Set<string>([
    ts.ScriptElementKind.classElement,
    ts.ScriptElementKind.interfaceElement,
    ts.ScriptElementKind.enumElement,
    ts.ScriptElementKind.variableElement,
    ts.ScriptElementKind.constElement,
    ts.ScriptElementKind.letElement,
  ]);
}

/** Kinds a child may have to count as a member rather than a local. Guards the case of a
 * `const` bound to an arrow function, whose children are body locals, not properties. */
function memberKinds(ts: TypeScriptModule): Set<string> {
  return new Set<string>([
    ts.ScriptElementKind.memberFunctionElement,
    ts.ScriptElementKind.memberVariableElement,
    ts.ScriptElementKind.memberGetAccessorElement,
    ts.ScriptElementKind.memberSetAccessorElement,
    ts.ScriptElementKind.enumMemberElement,
    ts.ScriptElementKind.constructorImplementationElement,
  ]);
}

function toSymbolInfo(
  ts: TypeScriptModule,
  item: TS.NavigateToItem,
  sourceFile: TS.SourceFile,
): SymbolInfo {
  const info: SymbolInfo = {
    name: item.name,
    kind: symbolKindFor(item.kind),
    exported: item.kindModifiers.split(",").includes("export"),
    file: toNativePath(sourceFile.fileName),
    startLine: lineOf(ts, sourceFile, item.textSpan.start),
    endLine: lineOf(ts, sourceFile, item.textSpan.start + item.textSpan.length),
  };
  if (item.containerName) info.container = item.containerName;
  return info;
}

export function createTypeScriptBackend(ts: TypeScriptModule, root: string): SymbolBackend {
  let service: TS.LanguageService | null = null;
  function languageService(): TS.LanguageService {
    if (!service) service = createLanguageService(ts, root);
    return service;
  }

  /**
   * Exact-name declaration sites, as `getNavigateToItems` reports them. Import aliases are
   * dropped: `import { join } from "node:path"` is a declaration of `join` as far as
   * TypeScript is concerned, but nobody asking "where is `join` defined" means that line.
   */
  function declarationItems(name: string): Array<{ item: TS.NavigateToItem; sf: TS.SourceFile }> {
    const program = languageService().getProgram();
    if (!program) return [];
    return languageService()
      .getNavigateToItems(name, undefined, undefined, true)
      .filter((item) => item.name === name && item.matchKind === "exact")
      .filter((item) => item.kind !== ts.ScriptElementKind.alias)
      .filter((item) => isProjectFile(root, item.fileName))
      .flatMap((item) => {
        const sf = program.getSourceFile(item.fileName);
        return sf ? [{ item, sf }] : [];
      });
  }

  const CONTAINER_KINDS = containerKinds(ts);
  const MEMBER_KINDS = memberKinds(ts);

  return {
    kind: "typescript",
    root,

    async overview(filePath: string): Promise<SymbolInfo[]> {
      const program = languageService().getProgram();
      const sourceFile = program?.getSourceFile(filePath);
      // A file outside the program (an unsupported extension, or one the walker never saw)
      // still deserves an answer rather than a silent `[]`.
      if (!sourceFile) return treeSitterOverview(filePath);

      // `getNavigationTree` is the same file outline TypeScript powers editor breadcrumbs
      // with: declarations plus their members, already nested, already named.
      const tree = languageService().getNavigationTree(filePath);
      if (!tree) return treeSitterOverview(filePath);

      const symbols: SymbolInfo[] = [];

      // Top-level declarations, plus the members of the ones that *have* members.
      // `getNavigationTree` descends all the way into a function body's locals; a depth cap
      // alone is not enough, because a top-level function's locals sit at the same depth as
      // a class's methods. Both the parent's kind and the child's kind have to agree that
      // what we're looking at is a member.
      const collect = (node: TS.NavigationTree, container?: string): void => {
        const span = node.spans[0];
        const isMember = container !== undefined;
        // Aliases are the file's `import` statements; a module element is the file itself.
        const skip =
          !span ||
          node.kind === ts.ScriptElementKind.alias ||
          node.kind === ts.ScriptElementKind.moduleElement ||
          (isMember && !MEMBER_KINDS.has(node.kind));

        if (!skip) {
          const info: SymbolInfo = {
            name: node.text,
            kind: symbolKindFor(node.kind),
            exported: (node.kindModifiers ?? "").split(",").includes("export"),
            file: filePath,
            startLine: lineOf(ts, sourceFile, span.start),
            endLine: lineOf(ts, sourceFile, span.start + span.length),
          };
          if (container) info.container = container;
          symbols.push(info);
        }

        if (isMember || !CONTAINER_KINDS.has(node.kind)) return;
        for (const child of node.childItems ?? []) collect(child, node.text);
      };

      // The root node is the source file itself; only its children are real symbols.
      for (const child of tree.childItems ?? []) collect(child);
      return symbols;
    },

    async findSymbol(name: string): Promise<SymbolInfo[]> {
      return declarationItems(name).map(({ item, sf }) => toSymbolInfo(ts, item, sf));
    },

    async findReferences(name: string): Promise<ReferenceInfo[]> {
      const program = languageService().getProgram();
      if (!program) return [];

      const declarations = declarationItems(name).flatMap(({ item, sf }) => {
        const nameStart = declarationNameStart(ts, sf, item);
        return nameStart === undefined ? [] : [{ item, sf, nameStart }];
      });

      const seen = new Set<string>();
      const results: ReferenceInfo[] = [];

      // One `getReferencesAtPosition` per declaration, so each usage is attributed to the
      // declaration the checker says it resolves to. This is the entire point of the
      // TypeScript backend: two same-named symbols in different scopes no longer collapse
      // into one undifferentiated list of hits.
      for (const { item, sf: declFile, nameStart } of declarations) {
        const declarationStartLine = lineOf(ts, declFile, item.textSpan.start);
        const references =
          languageService().getReferencesAtPosition(item.fileName, nameStart) ?? [];

        for (const reference of references) {
          if (!isProjectFile(root, reference.fileName)) continue;
          const sourceFile = program.getSourceFile(reference.fileName);
          if (!sourceFile) continue;
          // `ReferenceEntry` carries no `isDefinition` flag; `getReferencesAtPosition`
          // lists every declaration of a symbol among its own references.
          if (isDeclarationName(ts, sourceFile, reference.textSpan.start)) continue;

          const line = lineOf(ts, sourceFile, reference.textSpan.start);
          const column = columnOf(ts, sourceFile, reference.textSpan.start);
          // Deduplicated by usage site, not by (site, declaration) pair. When several
          // declarations share one symbol — an interface property and the object literals
          // implementing it — TypeScript returns the same usage list for each, and emitting
          // that list once per declaration would report one call site half a dozen times.
          // Distinct symbols that merely share a name return disjoint lists, so their
          // attributions survive this intact, which is the case that actually matters.
          const key = `${reference.fileName}:${line}:${column}`;
          if (seen.has(key)) continue;
          seen.add(key);

          results.push({
            file: toNativePath(reference.fileName),
            line,
            column,
            declaration: { file: toNativePath(item.fileName), startLine: declarationStartLine },
          });
        }
      }

      return results;
    },

    async impact(name: string, maxDepth = 3): Promise<ImpactNode[]> {
      const program = languageService().getProgram();
      if (!program) return [];

      const results: ImpactNode[] = [];
      // BFS outward over checker-resolved reference edges. Frontier entries are (file,
      // name-position) pairs, so each hop resolves through the checker rather than by name
      // — the same precision guarantee findReferences gives, extended transitively.
      const visitedDeclarations = new Set<string>();
      const seenSites = new Set<string>();

      let frontier = declarationItems(name).flatMap(({ item, sf }) => {
        const nameStart = declarationNameStart(ts, sf, item);
        return nameStart === undefined ? [] : [{ fileName: item.fileName, nameStart }];
      });
      for (const decl of frontier) visitedDeclarations.add(`${decl.fileName}:${decl.nameStart}`);

      for (let depth = 1; depth <= maxDepth && frontier.length > 0; depth++) {
        const next: typeof frontier = [];

        for (const decl of frontier) {
          const references =
            languageService().getReferencesAtPosition(decl.fileName, decl.nameStart) ?? [];

          for (const reference of references) {
            if (!isProjectFile(root, reference.fileName)) continue;
            const sourceFile = program.getSourceFile(reference.fileName);
            if (!sourceFile) continue;
            if (isDeclarationName(ts, sourceFile, reference.textSpan.start)) continue;

            const siteKey = `${reference.fileName}:${reference.textSpan.start}`;
            if (seenSites.has(siteKey)) continue;
            seenSites.add(siteKey);

            const caller = enclosingNamedDeclaration(ts, sourceFile, reference.textSpan.start);
            results.push({
              symbol: caller?.name ?? "<module>",
              file: toNativePath(reference.fileName),
              line: lineOf(ts, sourceFile, reference.textSpan.start),
              depth,
            });

            // A top-level usage has no caller to walk further from; a named caller joins
            // the next frontier once, however many of its lines reference this symbol.
            if (caller) {
              const declKey = `${reference.fileName}:${caller.nameStart}`;
              if (!visitedDeclarations.has(declKey)) {
                visitedDeclarations.add(declKey);
                next.push({ fileName: reference.fileName, nameStart: caller.nameStart });
              }
            }
          }
        }

        frontier = next;
      }

      return results;
    },
  };
}
