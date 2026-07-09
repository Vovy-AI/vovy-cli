export {
  backendKind,
  createTreeSitterBackend,
  createTypeScriptBackend,
  findProjectRoot,
  selectBackend,
} from "./backends/index.js";
export { loadTypeScript } from "./backends/load-typescript.js";
export type { TypeScriptModule } from "./backends/load-typescript.js";
export type { BackendKind, SymbolBackend } from "./backends/types.js";
export { isSupportedFile } from "./parser.js";
export { searchPattern } from "./search-pattern.js";
export { findReferencingSymbols, findSymbol, getSymbolsOverview, impactOf } from "./symbols.js";
export type { ImpactNode, PatternMatch, ReferenceInfo, SymbolInfo, SymbolKind } from "./types.js";
export { CODE_EXTENSIONS, walkFiles } from "./walk.js";
