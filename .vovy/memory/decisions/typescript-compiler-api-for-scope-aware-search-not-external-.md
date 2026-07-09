---
type: decision
title: TypeScript compiler API for scope-aware search, not external language servers
date: 2026-07-09
tags: context-engine, lsp, backend
---
Chose driving `ts.LanguageService` in-process against the project's own resolved `typescript` for the Context Engine's scope-aware backend.

**Rejected:** spawning external language servers (`typescript-language-server`, `pyright`, `gopls`) — the literal reading of the old roadmap line. **Why they lost:** founders don't have them on PATH, and Vovy will not install binaries on a founder's machine; an engine that silently does nothing for most users is worse than a weaker one that always works. Also rejected: bundling `typescript` as a dependency (~8MB nobody asked for — resolve the project's own instead, fall back to tree-sitter).

The `SymbolBackend` interface is the seam a real external-LSP backend plugs into later without touching callers.
