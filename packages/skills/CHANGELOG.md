# @vovy-ai/skills

## 0.3.1

### Patch Changes

- b27540d: Sync package-level READMEs with the Context Engine / `context-scoper` / `search_codebase` features added in 0.2.0 — they still listed only the original 3 skills and `analyze_project`. npm only reads a package's own README.md, so this needs a new version to actually update what shows on npmjs.com.

## 0.3.0

### Minor Changes

- 34792db: Add the Context Engine (v0.2 Phase 1): a new `@vovy-ai/context-engine` package does deterministic, tree-sitter-backed symbol search (no embeddings, no LLM, no network calls) over JS/TS/JSX/TSX projects. Exposed as one consolidated MCP tool, `search_codebase` (`overview`/`find_symbol`/`find_references`/`pattern`), and a new `context-scoper` skill that instructs the host model to call it before reading whole files — the "better tool-calling via semantic search" half of this release.

  Also adds a real cost-transparency number: `npx @vovy-ai/go doctor` now reports a deterministic "always-on token footprint" estimate (every installed skill file plus every registered MCP tool definition), rather than an unverifiable savings-percentage claim.

  See `docs/architecture.md`'s Context Engine/Roadmap sections and `scripts/eval-context-engine/RESULTS.md` for an early, honestly-scoped, reproducible benchmark of the token difference `search_codebase` makes on this repo's own source.

## 0.2.1

### Patch Changes

- Add a package-level README.md to each published package. npm only reads the README physically inside a package's own directory, not the monorepo root one, so all four packages were showing "This package does not have a README" on npmjs.com despite the root README being thorough.

## 0.2.0

### Minor Changes

- Sharpen `prompt-rescoper` with battle-tested prompt-engineering rules adapted from Vovy Go's own live prompt-enhancer (rules only — no live LLM call, consistent with Vovy CLI never running its own inference): silent CREATE-vs-ITERATE mode classification that changes what the spec is allowed to assume, numbered steps for requests with more than two distinct pieces, an anti-prompt-injection guard for pasted errors/files/output, and explicit guidance not to assert unverified project state. Also documents why the skill intentionally still asks blocking questions rather than adopting the "never ask the user" rule some one-shot tools use — this skill runs inside a live conversation, so asking is cheap and guessing is the actual failure mode.
