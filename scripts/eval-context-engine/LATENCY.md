# Context Engine — latency

**Machine-dependent numbers — read the environment line before quoting any of them.**
Measured on: darwin/arm64, 10 cores (Apple M5),
Node v24.11.0, against this repo (68 source files the walker sees).
Self-measured on one machine, one repo. Reproduce with
`node scripts/eval-context-engine/latency.mjs` after `pnpm build`.

## Cold start (first query on a fresh backend)

What an MCP server restart pays before its first answer.

| Backend | Cold first query |
|---|---|
| `typescript` | 711ms |
| `tree-sitter` | 171ms |

## Warm queries (median / p95 of 5 runs each)

What a session actually feels once the backend is up.

| Backend | Query | Median | p95 |
|---|---|---|---|
| `typescript` | `findSymbol(writeSkillFile)` | 3ms | 18ms |
|  | `findSymbol(detect)` | 3ms | 4ms |
|  | `findReferences(mergeMcpConfig)` | 13ms | 14ms |
|  | `findReferences(estimateTokens)` | 8ms | 9ms |
|  | `overview(claude-code.ts)` | 1ms | 1ms |
| `tree-sitter` | `findSymbol(writeSkillFile)` | 4ms | 6ms |
|  | `findSymbol(detect)` | 3ms | 6ms |
|  | `findReferences(mergeMcpConfig)` | 14ms | 17ms |
|  | `findReferences(estimateTokens)` | 14ms | 124ms |
|  | `overview(claude-code.ts)` | 0ms | 0ms |

## What this does not show

How either backend scales to a repo 10× or 100× this size — program construction and the
walk both grow with file count, and nothing here extrapolates. No persistent index exists
yet (see docs/architecture.md's Phase 3), so the cold cost recurs on every process start.
