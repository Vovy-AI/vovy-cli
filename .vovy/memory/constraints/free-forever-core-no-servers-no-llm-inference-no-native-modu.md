---
type: constraint
title: Free-forever core: no servers, no LLM inference, no native modules
date: 2026-07-09
tags: architecture, free-forever, constraints
---
Vovy's core must never run its own inference, hold API keys, operate a server/backend, collect telemetry, or require native modules to install.

**Why:** the product promise is free forever — anything metered (inference, hosting, telemetry infra) breaks it, and anything that needs a compiler (node-gyp) breaks install on exactly the machines Vovy's non-technical founders own. This is why: skills are plain markdown the host reads for free; `search_codebase` resolves through the project's own TypeScript or WASM tree-sitter; recall in `project_memory` is keyword scoring, not embeddings (computing embeddings IS inference, and onnxruntime is native — a trap that looks constraint-safe and isn't); memory's backend is git itself.

Applies to the core packages. Anything needing a real backend gets planned elsewhere, not bent into this repo.
