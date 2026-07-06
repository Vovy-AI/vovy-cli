# Context Engine — early token-footprint results

**Disclaimer, read before the numbers below:** this is an early, single-repo,
self-measured benchmark against Vovy's own monorepo (this repo) — not an independent
audit, not tested across other codebases, and not a measure of end-task correctness or
model behavior. It measures one specific thing: the estimated size (chars/4, same
heuristic as `doctor`'s token-footprint report) of the context an agent would need to
read to answer a real "where is X handled" question, comparing a whole-file read against
`@vovy-ai/context-engine`'s `search_codebase` result. These figures are reported with
that scoping made explicit rather than as a bare percentage claim — the same standard
this project's own competitive research holds vendor and competitor numbers to.

Reproduce with `node scripts/eval-context-engine/run.mjs` (no API key, no network call,
no cost — pure static measurement) after building `@vovy-ai/context-engine`.

## Methodology

For each of 10 real questions about this repo's own source (see
`queries.json`), `naiveTokens` is the estimated-token size of the whole file a human or
agent would open to answer it by guessing a filename; `contextTokens` is the estimated
size of what `search_codebase` (`find_symbol`/`overview`) actually returns — a symbol
signature and line range, not the whole file.

| Question | Naive (whole file) | Context Engine | Reduction |
|---|---|---|---|
| Where does host detection decide the Claude Code skill file path? | ~281 | ~47 | 83% |
| How does the CLI decide which host adapters to target for an install? | ~118 | ~40 | 66% |
| Where is a skill file's actual write-to-disk logic? | ~508 | ~42 | 92% |
| How does merging a new MCP server entry into an existing JSON config file work, without clobbering other tools already configured there? | ~664 | ~46 | 93% |
| Where does static, non-AI project analysis (framework/package-manager/test-runner detection) actually happen? | ~1053 | ~46 | 96% |
| How does the doctor command compute its token-footprint estimate? | ~1186 | ~45 | 96% |
| Where does the CLI load a skill's raw markdown content and look up its file path within the skills package? | ~451 | ~39 | 91% |
| What's the shape of a completed vs pending vs stale doctor entry? | ~1186 | ~42 | 96% |
| Where is uninstall's core logic that removes skill files and the MCP entry? | ~476 | ~43 | 91% |
| What top-level symbols does the search_codebase tool wrapper file define? | ~533 | ~183 | 66% |

**Average reduction across these 10 queries: ~87%.**

## What this does not show

This does not measure whether the model actually answers the underlying question
correctly with either approach, whether the reduction holds on a codebase Vovy has never
seen, or the fixed cost of the `search_codebase` tool definition itself (see `doctor`'s
token-footprint report for that number). Treat this as a directional, reproducible
starting point, not a settled benchmark.
