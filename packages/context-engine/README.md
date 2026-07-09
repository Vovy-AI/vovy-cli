# @vovy-ai/context-engine

Deterministic, non-LLM symbol search for [Vovy](https://github.com/Vovy-AI/vovy-cli) — a drop-in skill pack for vibe coding safely with AI coding assistants. Free forever, MIT, local-only.

You normally don't install this directly — it's what powers the `search_codebase` tool served by `@vovy-ai/mcp-server` once you run `npx @vovy-ai/go install`. It answers "where is X declared" / "what references X" / "is it safe to change X" questions directly, instead of an agent guessing a filename or grepping blind. No embeddings, no network calls, no LLM.

## Two backends, chosen per project

- **`typescript`** — used when TypeScript resolves from the project root, which is nearly always. Drives `ts.LanguageService` in-process against the project's *own* `typescript`, so symbols are scope- and type-aware and each reference names the declaration it resolves to. `typescript` is never a runtime dependency of this package; a project that has it pays nothing extra, and a project that doesn't gets the fallback.
- **`tree-sitter`** — the fallback. Parses JS/TS/JSX/TSX with [tree-sitter](https://tree-sitter.github.io/tree-sitter/) via `web-tree-sitter`'s WASM runtime (no native build step). Matches whole identifier tokens, so never a substring inside a string or comment — unlike grep — but cannot tell two same-named symbols in different scopes apart.

Call `backendKind(root)` to find out which will answer. Every `search_codebase` response reports it too, so a name match is never mistaken for a resolved one.

## What it exposes

- `getSymbolsOverview(filePath, root?)` — declarations in one file *and their members* (class methods, interface members, object-literal methods), with line ranges and containing symbol.
- `findSymbol(name, root)` — every declaration site matching `name` across a project.
- `findReferencingSymbols(name, root)` — usage sites, excluding declarations. On the `typescript` backend each result carries the `declaration` it resolves to.
- `impactOf(name, root, maxDepth?)` — transitive blast radius: usage sites of `name`, then usage sites of the declarations enclosing those, out to `maxDepth` hops (default 3), each tagged with its depth and caller. "What breaks if I change this."
- `searchPattern(query, root)` — plain regex/text fallback for non-code content.
- `backendKind(root)` / `selectBackend(root)` — which engine answers for this project.

Set `VOVY_CONTEXT_BACKEND=tree-sitter` to force the fallback (used by the benchmarks to A/B the two).

See [`docs/architecture.md`](https://github.com/Vovy-AI/vovy-cli/blob/main/docs/architecture.md)'s Context Engine section for the full design, the remaining honest limitations (JS/TS only, nothing persists across processes, no call graph), and [`scripts/eval-context-engine/RESULTS.md`](https://github.com/Vovy-AI/vovy-cli/blob/main/scripts/eval-context-engine/RESULTS.md) for a reproducible correctness benchmark scored against hand-verified ground truth.

## License

MIT
