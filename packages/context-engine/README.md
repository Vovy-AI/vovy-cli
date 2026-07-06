# @vovy-ai/context-engine

Deterministic, non-LLM symbol search for [Vovy](https://github.com/Vovy-AI/vovy-cli) — a free, forever, drop-in skill pack for vibe coding safely with AI coding assistants.

You normally don't install this directly — it's what powers the `search_codebase` tool served by `@vovy-ai/mcp-server` once you run `npx @vovy-ai/go install`. It parses JS/TS/JSX/TSX source with [tree-sitter](https://tree-sitter.github.io/tree-sitter/) (via `web-tree-sitter`'s WASM runtime — no native build step, no embeddings, no network calls) to answer "where is X declared" / "what references X" questions directly, instead of an agent guessing a filename or grepping blind.

## What it exposes

- `getSymbolsOverview(filePath)` — top-level functions/classes/interfaces/exports in one file, with line ranges.
- `findSymbol(name, root)` — every declaration site matching `name` across a project.
- `findReferencingSymbols(name, root)` — identifier-boundary-aware usage sites (matches real tree-sitter tokens, never a substring inside a string or comment — unlike grep).
- `searchPattern(query, root)` — plain regex/text fallback for non-code content.

See [`docs/architecture.md`](https://github.com/Vovy-AI/vovy-cli/blob/main/docs/architecture.md)'s Context Engine section for the full design, its current honest limitations (not scope/type-aware like a real language server yet), and the roadmap toward real per-language LSP backends.

## License

MIT
