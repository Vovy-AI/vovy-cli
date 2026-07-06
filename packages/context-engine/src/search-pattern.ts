import { readFileSync, statSync } from "node:fs";
import type { PatternMatch } from "./types.js";
import { walkFiles } from "./walk.js";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const DEFAULT_LIMIT = 200;
const REPLACEMENT_CHARACTER = String.fromCharCode(0xfffd);

function toMatcher(query: string): (line: string) => boolean {
  try {
    const regex = new RegExp(query);
    return (line) => regex.test(line);
  } catch {
    // Not a valid regex (e.g. an unescaped founder-typed string like "handle(request)") —
    // fall back to a plain, always-valid substring search rather than erroring.
    return (line) => line.includes(query);
  }
}

/**
 * Plain recursive text search across `root` — the non-code/prose fallback for anything
 * `findSymbol`/`findReferencingSymbols` can't answer (they only understand JS/TS/TSX).
 * `query` is tried as a regex first, falling back to a literal substring match if it isn't
 * valid regex syntax. Never throws; skips unreadable files and anything over 5MB.
 */
export function searchPattern(query: string, root: string, limit = DEFAULT_LIMIT): PatternMatch[] {
  const matches: PatternMatch[] = [];
  const isMatch = toMatcher(query);

  for (const file of walkFiles(root)) {
    if (matches.length >= limit) break;

    let size: number;
    try {
      size = statSync(file).size;
    } catch {
      continue;
    }
    if (size > MAX_FILE_BYTES) continue;

    let content: string;
    try {
      content = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    // Skip files that don't decode as plausible text: readFileSync as utf8 replaces
    // invalid byte sequences with U+FFFD, so its presence is a crude binary-file signal.
    if (content.includes(REPLACEMENT_CHARACTER)) continue;

    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (matches.length >= limit) break;
      const line = lines[i];
      if (line !== undefined && isMatch(line)) {
        matches.push({ file, line: i + 1, text: line.trim() });
      }
    }
  }

  return matches;
}
