#!/usr/bin/env node
import { writeFileSync } from "node:fs";
// Latency benchmark for @vovy-ai/context-engine, complementing run.mjs (which measures
// size and correctness but says nothing about speed). Two numbers matter and they are very
// different:
//
//   COLD — the first query against a root: for the `typescript` backend this pays module
//          load + program construction over every file the walker finds; for `tree-sitter`
//          it pays WASM init + first-file parses. This is what an MCP server restart costs.
//   WARM — every query after that, against the same backend instance. This is what a
//          session actually feels, and what any future call-graph layer would be built on.
//
// Numbers are machine- and repo-dependent, so LATENCY.md records the environment alongside
// them and they must not be quoted as general claims. Reproduce with
// `node scripts/eval-context-engine/latency.mjs` after `pnpm build`.
import { arch, cpus, platform } from "node:os";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");

const ce = await import(join(repoRoot, "packages", "context-engine", "dist", "index.js"));
const {
  CODE_EXTENSIONS,
  createTreeSitterBackend,
  createTypeScriptBackend,
  loadTypeScript,
  walkFiles,
} = ce;

const fileCount = walkFiles(repoRoot, CODE_EXTENSIONS).filter((f) => !f.includes("/dist/")).length;

// Real queries, not synthetic ones — same names the correctness benchmark uses.
const WARM_QUERIES = [
  ["findSymbol", "writeSkillFile"],
  ["findSymbol", "detect"],
  ["findReferences", "mergeMcpConfig"],
  ["findReferences", "estimateTokens"],
  ["overview", join(repoRoot, "packages/host-detect/src/adapters/claude-code.ts")],
];

async function timeOnce(fn) {
  const start = performance.now();
  await fn();
  return performance.now() - start;
}

function stats(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    median: sorted[Math.floor(sorted.length / 2)],
    p95: sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)],
  };
}

async function runQuery(backend, [action, arg]) {
  if (action === "findSymbol") return backend.findSymbol(arg);
  if (action === "findReferences") return backend.findReferences(arg);
  return backend.overview(arg);
}

async function measureBackend(name, makeBackend) {
  // COLD: fresh backend, one findSymbol. The lazy program/WASM init lands here.
  const coldBackend = await makeBackend();
  const cold = await timeOnce(() => coldBackend.findSymbol("writeSkillFile"));

  // WARM: same instance, every query type, several rounds. First warm round is discarded
  // so stragglers of lazy init don't leak into the warm figure.
  await Promise.all(WARM_QUERIES.map((q) => runQuery(coldBackend, q)));
  const perQuery = {};
  for (const query of WARM_QUERIES) {
    const samples = [];
    for (let i = 0; i < 5; i++) samples.push(await timeOnce(() => runQuery(coldBackend, query)));
    perQuery[`${query[0]}(${query[1].split("/").pop()})`] = stats(samples);
  }
  return { name, cold, perQuery };
}

const tsModule = await loadTypeScript(repoRoot);
if (!tsModule) throw new Error("typescript must resolve from the repo root for this benchmark.");

const results = [
  await measureBackend("typescript", async () => createTypeScriptBackend(tsModule, repoRoot)),
  await measureBackend("tree-sitter", async () => createTreeSitterBackend(repoRoot)),
];

const ms = (n) => `${n.toFixed(0)}ms`;

const rows = results
  .flatMap((r) =>
    Object.entries(r.perQuery).map(
      ([q, s], i) =>
        `| ${i === 0 ? `\`${r.name}\`` : ""} | \`${q}\` | ${ms(s.median)} | ${ms(s.p95)} |`,
    ),
  )
  .join("\n");

const md = `# Context Engine — latency

**Machine-dependent numbers — read the environment line before quoting any of them.**
Measured on: ${platform()}/${arch()}, ${cpus().length} cores (${cpus()[0]?.model ?? "unknown"}),
Node ${process.version}, against this repo (${fileCount} source files the walker sees).
Self-measured on one machine, one repo. Reproduce with
\`node scripts/eval-context-engine/latency.mjs\` after \`pnpm build\`.

## Cold start (first query on a fresh backend)

What an MCP server restart pays before its first answer.

| Backend | Cold first query |
|---|---|
${results.map((r) => `| \`${r.name}\` | ${ms(r.cold)} |`).join("\n")}

## Warm queries (median / p95 of 5 runs each)

What a session actually feels once the backend is up.

| Backend | Query | Median | p95 |
|---|---|---|---|
${rows}

## What this does not show

How either backend scales to a repo 10× or 100× this size — program construction and the
walk both grow with file count, and nothing here extrapolates. No persistent index exists
yet (see docs/architecture.md's Phase 3), so the cold cost recurs on every process start.
`;

writeFileSync(join(here, "LATENCY.md"), md);

for (const r of results) {
  console.log(`\n${r.name} — cold first query: ${ms(r.cold)}`);
  for (const [q, s] of Object.entries(r.perQuery)) {
    console.log(
      `   ${q.padEnd(42)} median ${ms(s.median).padStart(7)}   p95 ${ms(s.p95).padStart(7)}`,
    );
  }
}
console.log(`\n${fileCount} source files. Wrote ${join(here, "LATENCY.md")}`);
