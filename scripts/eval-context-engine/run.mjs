#!/usr/bin/env node
// Reproducible, zero-API-cost benchmark for @vovy-ai/context-engine. Two things are
// measured, and they are different questions:
//
//   1. SIZE      — how many estimated tokens of context an agent must read to answer a
//                  real "where is X handled" question, whole file vs. search_codebase.
//   2. CORRECTNESS — whether what comes back is actually right, scored against hand-verified
//                  ground truth in correctness.json, for each backend and for plain grep.
//
// Neither measures end-task correctness or model behavior, and no API key or network call
// is involved, deliberately: this costs nothing to run and never goes stale relative to a
// particular model's tokenizer. Regenerates RESULTS.md in this directory. Requires
// @vovy-ai/context-engine to be built first (`pnpm build` from the repo root).
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");

const contextEngineDist = join(repoRoot, "packages", "context-engine", "dist", "index.js");
let contextEngine;
try {
  contextEngine = await import(contextEngineDist);
} catch (error) {
  console.error(
    `Could not load ${contextEngineDist} — build it first:\n  pnpm --filter @vovy-ai/context-engine build\n`,
  );
  throw error;
}
const {
  CODE_EXTENSIONS,
  createTreeSitterBackend,
  createTypeScriptBackend,
  loadTypeScript,
  walkFiles,
} = contextEngine;

const sizeQueries = JSON.parse(readFileSync(join(here, "queries.json"), "utf8"));
const correctnessQueries = JSON.parse(readFileSync(join(here, "correctness.json"), "utf8"));

const typescriptModule = await loadTypeScript(repoRoot);
if (!typescriptModule) {
  throw new Error("TypeScript did not resolve from the repo root; cannot benchmark both backends.");
}

const backends = [
  ["typescript", createTypeScriptBackend(typescriptModule, repoRoot)],
  ["tree-sitter", createTreeSitterBackend(repoRoot)],
];

// ── Size ────────────────────────────────────────────────────────────────────────────────
// Same chars/4 heuristic as packages/cli/src/commands/doctor.ts's estimateTokens —
// duplicated rather than imported since this script isn't part of the pnpm workspace
// dependency graph, and it's a one-line, unlikely-to-drift function.
function tokensForCharLength(charLength) {
  return Math.ceil(charLength / 4);
}

function naiveTokensFor(query) {
  const bytes = query.naiveFiles
    .map((relPath) => statSync(join(repoRoot, relPath)).size)
    .reduce((a, b) => a + b, 0);
  // A file's on-disk byte count is a reasonable proxy for its char length (this repo's
  // source is plain UTF-8/ASCII), so this stays in the same chars/4 unit as the
  // context-engine side for an apples-to-apples comparison.
  return tokensForCharLength(bytes);
}

async function sizeResultFor(backend, query) {
  if (query.action === "overview") return backend.overview(join(repoRoot, query.filePath));
  return backend.findSymbol(query.query);
}

const defaultBackend = backends[0][1];
const sizeRows = [];
for (const query of sizeQueries) {
  const naiveTokens = naiveTokensFor(query);
  const result = await sizeResultFor(defaultBackend, query);
  const contextTokens = tokensForCharLength(JSON.stringify(result).length);
  const reductionPct = naiveTokens === 0 ? 0 : (1 - contextTokens / naiveTokens) * 100;
  sizeRows.push({ ...query, naiveTokens, contextTokens, reductionPct });
}
const avgReduction = sizeRows.reduce((sum, r) => sum + r.reductionPct, 0) / sizeRows.length;

// ── Correctness ─────────────────────────────────────────────────────────────────────────
/** The baseline every developer already has: whole-identifier grep across the same files. */
function grepFiles(name) {
  const pattern = new RegExp(`\\b${name}\\b`);
  const files = new Set();
  for (const file of walkFiles(repoRoot, CODE_EXTENSIONS)) {
    if (file.includes("/dist/")) continue;
    if (pattern.test(readFileSync(file, "utf8"))) files.add(relative(repoRoot, file));
  }
  return files;
}

function scoreFiles(returned, groundTruth) {
  const truth = new Set(groundTruth);
  const hits = [...returned].filter((f) => truth.has(f)).length;
  return {
    precision: returned.size === 0 ? 0 : hits / returned.size,
    recall: truth.size === 0 ? 1 : hits / truth.size,
    falsePositives: [...returned].filter((f) => !truth.has(f)),
    missed: [...truth].filter((f) => !returned.has(f)),
  };
}

/** Fraction of returned references whose `declaration` names the file the ground truth says
 * that usage belongs to. A backend that cannot attribute at all scores 0. */
function scoreAttribution(references, expected) {
  if (references.length === 0) return 0;
  const correct = references.filter((ref) => {
    const refFile = relative(repoRoot, ref.file);
    const wanted = expected[refFile];
    return (
      wanted !== undefined && ref.declaration && relative(repoRoot, ref.declaration.file) === wanted
    );
  }).length;
  return correct / references.length;
}

async function runCorrectness(backendName, backend) {
  const rows = [];
  for (const query of correctnessQueries) {
    const raw =
      query.action === "find_references"
        ? await backend.findReferences(query.query)
        : await backend.findSymbol(query.query);
    const returned = new Set(raw.map((r) => relative(repoRoot, r.file)));
    const score = scoreFiles(returned, query.groundTruth);
    const attribution = query.expectedAttribution
      ? scoreAttribution(raw, query.expectedAttribution)
      : null;
    rows.push({ id: query.id, backend: backendName, ...score, attribution });
  }
  return rows;
}

const correctnessRows = [];
for (const [name, backend] of backends)
  correctnessRows.push(...(await runCorrectness(name, backend)));

const grepRows = correctnessQueries
  .filter((q) => q.action === "find_references")
  .map((query) => {
    const returned = grepFiles(query.query);
    return {
      id: query.id,
      backend: "grep",
      ...scoreFiles(returned, query.groundTruth),
      attribution: 0,
    };
  });

const allRows = [...correctnessRows, ...grepRows];
const mean = (rows, key) =>
  rows.length === 0 ? 0 : rows.reduce((sum, r) => sum + r[key], 0) / rows.length;

const summary = ["typescript", "tree-sitter", "grep"].map((backend) => {
  const rows = allRows.filter((r) => r.backend === backend);
  const attributable = rows.filter((r) => r.attribution !== null);
  return {
    backend,
    precision: mean(rows, "precision"),
    recall: mean(rows, "recall"),
    attribution: mean(attributable, "attribution"),
    queries: rows.length,
  };
});

// ── Report ──────────────────────────────────────────────────────────────────────────────
const pct = (n) => `${(n * 100).toFixed(0)}%`;

const sizeTable = sizeRows
  .map(
    (r) =>
      `| ${r.question} | ~${r.naiveTokens} | ~${r.contextTokens} | ${r.reductionPct.toFixed(0)}% |`,
  )
  .join("\n");

const summaryTable = summary
  .map(
    (s) =>
      `| \`${s.backend}\` | ${pct(s.precision)} | ${pct(s.recall)} | ${s.backend === "grep" ? "n/a" : pct(s.attribution)} |`,
  )
  .join("\n");

const perQueryTable = correctnessQueries
  .map((query) => {
    const cells = ["typescript", "tree-sitter", "grep"].map((backend) => {
      const row = allRows.find((r) => r.id === query.id && r.backend === backend);
      if (!row) return "n/a";
      return `P ${pct(row.precision)} / R ${pct(row.recall)}`;
    });
    return `| \`${query.id}\` | ${query.tests} | ${cells.join(" | ")} |`;
  })
  .join("\n");

const resultsMd = `# Context Engine — reproducible benchmark

**Disclaimer, read before the numbers below:** this is a self-measured benchmark against
Vovy's own monorepo (this repo) — not an independent audit, not tested across other
codebases, and not a measure of end-task correctness or model behavior. It measures two
things: the estimated **size** of the context an agent must read, and the **correctness** of
what the engine returns, scored against ground truth that was verified by hand (see the
\`verified\` field on each entry in \`correctness.json\`) rather than generated by the engine
under test. Figures are reported with that scoping made explicit rather than as a bare
percentage claim — the same standard this project's own competitive research holds vendor
and competitor numbers to.

Reproduce with \`node scripts/eval-context-engine/run.mjs\` (no API key, no network call, no
cost — pure static measurement) after \`pnpm build\`.

## Correctness

Scored over ${correctnessQueries.length} hand-verified queries in \`correctness.json\`, at file granularity.
**Precision** = of the files returned, how many really contain a match. **Recall** = of the
files that really contain one, how many were returned. **Attribution** = of the references
returned, how many correctly name the declaration they resolve to — the question a
name-matching engine cannot answer at all, and the reason the \`typescript\` backend exists.

\`grep\` is the baseline every developer already has: a whole-word identifier search over the
same files.

| Backend | Precision | Recall | Attribution |
|---|---|---|---|
${summaryTable}

| Query | What it tests | \`typescript\` | \`tree-sitter\` | \`grep\` |
|---|---|---|---|---|
${perQueryTable}

## Size

For each of ${sizeRows.length} real questions about this repo's own source (see \`queries.json\`),
\`naive\` is the estimated-token size of the whole file a human or agent would open to answer
it by guessing a filename; \`context engine\` is the size of what \`search_codebase\` returns —
symbol signatures and line ranges, not whole files. Measured on the \`typescript\` backend,
the one a project with TypeScript installed actually gets.

| Question | Naive (whole file) | Context Engine | Reduction |
|---|---|---|---|
${sizeTable}

**Average reduction across these ${sizeRows.length} queries: ~${avgReduction.toFixed(0)}%.**

## What this does not show

This does not measure whether the model answers the underlying question correctly with
either approach, whether these figures hold on a codebase Vovy has never seen, or the fixed
cost of the \`search_codebase\` tool definition itself (see \`doctor\`'s token-footprint report
for that number). The correctness ground truth is small — ${correctnessQueries.length} queries on one repo, chosen
because each isolates a specific failure mode — and a passing score on it is evidence
against those failure modes, not proof of general correctness. Treat this as a directional,
reproducible starting point, not a settled benchmark.
`;

writeFileSync(join(here, "RESULTS.md"), resultsMd);

console.log("── correctness ──");
for (const s of summary) {
  console.log(
    `${s.backend.padEnd(12)} precision ${pct(s.precision).padStart(4)}  recall ${pct(s.recall).padStart(4)}  attribution ${s.backend === "grep" ? " n/a" : pct(s.attribution).padStart(4)}`,
  );
}
console.log("\n── per-query misses ──");
for (const row of allRows) {
  if (row.falsePositives.length || row.missed.length) {
    console.log(
      `${row.backend.padEnd(12)} ${row.id.padEnd(30)} ${row.missed.length ? `missed=${row.missed.length}` : ""} ${row.falsePositives.length ? `falsePositives=${row.falsePositives.length}` : ""}`.trimEnd(),
    );
  }
}
console.log(`\n── size ──\nAverage reduction: ~${avgReduction.toFixed(0)}%`);
console.log(`Wrote ${join(here, "RESULTS.md")}`);
