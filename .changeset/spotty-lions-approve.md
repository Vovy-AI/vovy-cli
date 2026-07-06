---
"@vovy-ai/skills": minor
"@vovy-ai/mcp-server": minor
"@vovy-ai/go": minor
---

Add the Context Engine (v0.2 Phase 1): a new `@vovy-ai/context-engine` package does deterministic, tree-sitter-backed symbol search (no embeddings, no LLM, no network calls) over JS/TS/JSX/TSX projects. Exposed as one consolidated MCP tool, `search_codebase` (`overview`/`find_symbol`/`find_references`/`pattern`), and a new `context-scoper` skill that instructs the host model to call it before reading whole files — the "better tool-calling via semantic search" half of this release.

Also adds a real cost-transparency number: `npx @vovy-ai/go doctor` now reports a deterministic "always-on token footprint" estimate (every installed skill file plus every registered MCP tool definition), rather than an unverifiable savings-percentage claim.

See `docs/architecture.md`'s Context Engine/Roadmap sections and `scripts/eval-context-engine/RESULTS.md` for an early, honestly-scoped, reproducible benchmark of the token difference `search_codebase` makes on this repo's own source.
