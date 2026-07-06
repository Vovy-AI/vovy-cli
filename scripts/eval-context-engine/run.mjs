#!/usr/bin/env node
// Reproducible, zero-API-cost benchmark: for each query in queries.json, compares the
// estimated tokens of (a) the whole file a human/agent would open to answer it by guessing
// a filename, vs (b) what @vovy-ai/context-engine's search_codebase actually returns.
// Measures retrieved-context SIZE only — not end-task correctness or model behavior, and
// not a live-API measurement, deliberately: no API key or network call needed to run this,
// so it costs nothing and never goes stale relative to a particular model's tokenizer.
// Regenerates RESULTS.md in this directory. Requires @vovy-ai/context-engine to be built
// first (`pnpm --filter @vovy-ai/context-engine build`, or `pnpm build` from the repo root).
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const queries = JSON.parse(readFileSync(join(here, "queries.json"), "utf8"));

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
const { getSymbolsOverview, findSymbol } = contextEngine;

// Same chars/4 heuristic as packages/cli/src/commands/doctor.ts's estimateTokens —
// duplicated rather than imported since this script isn't part of the pnpm workspace
// dependency graph, and it's a one-line, unlikely-to-drift function.
function tokensForCharLength(charLength) {
  return Math.ceil(charLength / 4);
}

function estimateTokens(text) {
  return tokensForCharLength(text.length);
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

async function contextEngineResultFor(query) {
  if (query.action === "overview") {
    return getSymbolsOverview(join(repoRoot, query.filePath));
  }
  return findSymbol(query.query, repoRoot);
}

const rows = [];
for (const query of queries) {
  const naiveTokens = naiveTokensFor(query);
  const result = await contextEngineResultFor(query);
  const contextTokens = estimateTokens(JSON.stringify(result));
  const reductionPct = naiveTokens === 0 ? 0 : (1 - contextTokens / naiveTokens) * 100;
  rows.push({ ...query, naiveTokens, contextTokens, reductionPct });
}

const avgReduction = rows.reduce((sum, r) => sum + r.reductionPct, 0) / rows.length;

const tableRows = rows
  .map(
    (r) =>
      `| ${r.question} | ~${r.naiveTokens} | ~${r.contextTokens} | ${r.reductionPct.toFixed(0)}% |`,
  )
  .join("\n");

const resultsMd = `# Context Engine — early token-footprint results

**Disclaimer, read before the numbers below:** this is an early, single-repo,
self-measured benchmark against Vovy's own monorepo (this repo) — not an independent
audit, not tested across other codebases, and not a measure of end-task correctness or
model behavior. It measures one specific thing: the estimated size (chars/4, same
heuristic as \`doctor\`'s token-footprint report) of the context an agent would need to
read to answer a real "where is X handled" question, comparing a whole-file read against
\`@vovy-ai/context-engine\`'s \`search_codebase\` result. These figures are reported with
that scoping made explicit rather than as a bare percentage claim — the same standard
this project's own competitive research holds vendor and competitor numbers to.

Reproduce with \`node scripts/eval-context-engine/run.mjs\` (no API key, no network call,
no cost — pure static measurement) after building \`@vovy-ai/context-engine\`.

## Methodology

For each of ${rows.length} real questions about this repo's own source (see
\`queries.json\`), \`naiveTokens\` is the estimated-token size of the whole file a human or
agent would open to answer it by guessing a filename; \`contextTokens\` is the estimated
size of what \`search_codebase\` (\`find_symbol\`/\`overview\`) actually returns — a symbol
signature and line range, not the whole file.

| Question | Naive (whole file) | Context Engine | Reduction |
|---|---|---|---|
${tableRows}

**Average reduction across these ${rows.length} queries: ~${avgReduction.toFixed(0)}%.**

## What this does not show

This does not measure whether the model actually answers the underlying question
correctly with either approach, whether the reduction holds on a codebase Vovy has never
seen, or the fixed cost of the \`search_codebase\` tool definition itself (see \`doctor\`'s
token-footprint report for that number). Treat this as a directional, reproducible
starting point, not a settled benchmark.
`;

writeFileSync(join(here, "RESULTS.md"), resultsMd);

for (const r of rows) {
  console.log(
    `${r.id}: naive ~${r.naiveTokens} tokens, context-engine ~${r.contextTokens} tokens (${r.reductionPct.toFixed(0)}% reduction)`,
  );
}
console.log(`\nAverage reduction: ~${avgReduction.toFixed(0)}%`);
console.log(`Wrote ${join(here, "RESULTS.md")}`);
