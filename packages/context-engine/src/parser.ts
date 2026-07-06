import { readFileSync, statSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Parser from "web-tree-sitter";

// dist/parser.js -> ../wasm (and src/parser.ts -> ../wasm, same relative shape in dev),
// same convention as @vovy-ai/skills' load.ts.
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * `web-tree-sitter` is pinned to 0.20.8 in package.json deliberately, not by oversight:
 * newer web-tree-sitter releases (0.22+) throw inside `Language.load()` on the prebuilt
 * grammar binaries this package ships (an emscripten dylink-metadata mismatch — verified
 * empirically against 0.26.10 while building this, not assumed from a changelog). 0.20.8
 * is the version contemporaneous with the `tree-sitter-cli@^0.20.x` toolchain that built
 * `tree-sitter-wasms`' grammars, and loads them cleanly. Revisit this pin only after
 * confirming a newer web-tree-sitter loads these same .wasm files without error.
 */
const GRAMMAR_BY_EXTENSION: Record<string, string> = {
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".ts": "typescript",
  ".mts": "typescript",
  ".cts": "typescript",
  ".tsx": "tsx",
};

let initPromise: Promise<void> | null = null;
function ensureInitialized(): Promise<void> {
  if (!initPromise) initPromise = Parser.init();
  return initPromise;
}

const languageCache = new Map<string, Parser.Language>();
async function loadLanguage(grammar: string): Promise<Parser.Language> {
  const cached = languageCache.get(grammar);
  if (cached) return cached;
  await ensureInitialized();
  const wasmPath = join(packageRoot, "wasm", `tree-sitter-${grammar}.wasm`);
  const language = await Parser.Language.load(wasmPath);
  languageCache.set(grammar, language);
  return language;
}

export interface ParsedFile {
  rootNode: Parser.SyntaxNode;
  sourceLines: string[];
}

interface CacheEntry extends ParsedFile {
  mtimeMs: number;
}

// In-process only (Phase 1 — see docs/architecture.md's roadmap): re-parses on mtime
// change, but nothing persists across separate CLI/MCP-server invocations yet. Parsed
// trees are never explicitly `.delete()`-d, so long-lived processes touching very many
// distinct files will grow this cache unboundedly — acceptable for a single project-sized
// working set, a known limitation rather than a silent one.
const fileCache = new Map<string, CacheEntry>();

export function isSupportedFile(filePath: string): boolean {
  return extname(filePath) in GRAMMAR_BY_EXTENSION;
}

/** Parses `filePath` with the grammar matching its extension, or returns `null` for an
 * unsupported extension or an unreadable file — never throws. */
export async function parseFile(filePath: string): Promise<ParsedFile | null> {
  const grammar = GRAMMAR_BY_EXTENSION[extname(filePath)];
  if (!grammar) return null;

  let mtimeMs: number;
  try {
    mtimeMs = statSync(filePath).mtimeMs;
  } catch {
    return null;
  }

  const cached = fileCache.get(filePath);
  if (cached && cached.mtimeMs === mtimeMs) return cached;

  const language = await loadLanguage(grammar);
  const parser = new Parser();
  parser.setLanguage(language);

  let source: string;
  try {
    source = readFileSync(filePath, "utf8");
  } catch {
    return null;
  }

  const tree = parser.parse(source);
  const entry: CacheEntry = {
    mtimeMs,
    rootNode: tree.rootNode,
    sourceLines: source.split(/\r?\n/),
  };
  fileCache.set(filePath, entry);
  return entry;
}
