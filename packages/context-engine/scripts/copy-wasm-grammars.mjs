#!/usr/bin/env node
// Copies only the grammar .wasm files this package actually uses out of the much larger
// `tree-sitter-wasms` bundle (it ships ~30 languages; Phase 1 only needs 3 — see
// docs/architecture.md for the tree-sitter-first, LSP-later roadmap). This keeps the
// published package small while still reusing pre-built, correctly-compiled grammars
// instead of shelling out to emscripten ourselves.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..");
const outDir = join(packageRoot, "wasm");

// pnpm symlinks a package's own devDependencies into its local node_modules regardless of
// hoisting, but fall back to the workspace root in case that ever changes.
const candidateSourceDirs = [
  join(packageRoot, "node_modules", "tree-sitter-wasms", "out"),
  join(packageRoot, "..", "..", "node_modules", "tree-sitter-wasms", "out"),
];
const sourceDir = candidateSourceDirs.find((dir) => existsSync(dir));
if (!sourceDir) {
  console.error(
    `[context-engine] Could not find tree-sitter-wasms in any of:\n${candidateSourceDirs.join("\n")}\nRun \`pnpm install\` first.`,
  );
  process.exit(1);
}

const GRAMMARS = ["javascript", "typescript", "tsx"];

mkdirSync(outDir, { recursive: true });

for (const grammar of GRAMMARS) {
  const filename = `tree-sitter-${grammar}.wasm`;
  const src = join(sourceDir, filename);
  const dest = join(outDir, filename);
  if (!existsSync(src)) {
    console.error(`[context-engine] Missing ${filename} at ${src}.`);
    process.exit(1);
  }
  copyFileSync(src, dest);
}
