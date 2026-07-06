# Architecture

## The hard constraint

Vovy is free forever for both users and the maintainer. That means Vovy must never run its own LLM inference or hold its own API keys/billing. Every piece of "intelligence" has to happen inside the user's own already-paid host-tool session (Claude Code, Codex CLI, Cursor, Cline, Windsurf), not via a Vovy-hosted call.

## Why this isn't built on MCP sampling

MCP has a `sampling/createMessage` primitive that, on paper, does exactly what we need: a server asks the connected client to run a completion on the client's own configured model, no server-side API key required. Two things rule it out as a foundation:

1. **No target host implements it.** As of this writing there are open, unresolved feature requests for it in Claude Code, Codex CLI, and Cursor, and no confirmed support in Cline or Windsurf.
2. **The MCP spec itself is deprecating it** (SEP-2577), explicitly because real-world adoption never happened, and its suggested replacement — "integrate directly with an LLM provider API" — is exactly the thing our free-forever constraint forbids.

## What Vovy actually does instead

Every target host independently converged on a markdown-file convention its own agent loop reads for free: `SKILL.md` for Claude Code and Codex CLI (the shared open "Agent Skills" format), `.mdc` rules for Cursor, flat rule files for Cline and Windsurf. `npx @vovy-ai/go install` writes Vovy's skills directly into whichever of these directories the detected host uses. This is the **primary** delivery mechanism — zero protocol dependency, works today, on every host, using a feature each vendor already built and maintains for their own reasons.

The same content is *also* served by `@vovy-ai/mcp-server` as MCP `prompts` and `resources` (`skill://<id>`) — both still-stable, non-deprecated MCP primitives — as a **secondary**, redundant path for any host with good MCP-prompt discovery UX. Nothing depends on this path working.

`@vovy-ai/mcp-server` additionally exposes deterministic MCP **tools**: `analyze_project` (plain static analysis — read `package.json`, walk the file tree, detect framework/package-manager/test-runner signals, flag a few concrete footguns like an untracked `.env`) and `search_codebase` (deterministic tree-sitter symbol search, see "Context Engine" below). No network calls, no LLM, no guessing, either one. The `project-skill-drafter` skill instructs the host's own model to turn `analyze_project`'s output into a tailored project skill file — this is how "auto-generate a project-specific skill from codebase analysis" works without Vovy running any inference: Vovy supplies facts, the founder's own paid model supplies judgment.

## Package layout

```
packages/
├── skills/          @vovy-ai/skills          — SKILL.md content + typed manifest (single source of truth)
├── host-detect/     @vovy-ai/host-detect     — HostAdapter interface + per-host detect/write logic
├── context-engine/  @vovy-ai/context-engine  — deterministic tree-sitter symbol search, no embeddings
├── mcp-server/      @vovy-ai/mcp-server      — MCP server (stdio); serves analyze_project + search_codebase + prompts/resources
└── cli/             @vovy-ai/go              — `npx @vovy-ai/go install|doctor|uninstall`
```

`@vovy-ai/skills` has zero runtime dependencies and is the actual product content; both `cli` and `mcp-server` import it so the two delivery paths can never drift apart. `@vovy-ai/host-detect` isolates the highest-blast-radius code — writing into other tools' config directories inside `$HOME` — behind a small `HostAdapter` interface, and is the main extension point for adding new hosts (see [`host-support-matrix.md`](host-support-matrix.md) and [`../CONTRIBUTING.md`](../CONTRIBUTING.md)).

## Context Engine (v0.2 Phase 1)

`@vovy-ai/context-engine` is the first real substance behind what used to be a one-line "v0.2+: LSP-based retrieval in the spirit of Serena" aspiration. It answers "where is X handled" / "what calls this function" style questions via [tree-sitter](https://tree-sitter.github.io/tree-sitter/), not embeddings and not a real language server (yet — see Roadmap below), which keeps it deterministic, dependency-light, and consistent with `analyze_project`'s no-LLM/no-network ethos:

- **Runtime**: [`web-tree-sitter`](https://www.npmjs.com/package/web-tree-sitter) (WASM, no native build/node-gyp step — a founder's machine never compiles anything to install Vovy) parsing JS/TS/JSX/TSX only for now. Grammar `.wasm` files are sourced once at build time from the (Unlicense) `tree-sitter-wasms` bundle and shipped inside the package — see `packages/context-engine/scripts/copy-wasm-grammars.mjs`.
- **`web-tree-sitter` is deliberately pinned to an older release** (0.20.8, not the current 0.26.x) — verified empirically while building this that newer releases reject these same prebuilt grammar binaries during `Language.load()`. See the comment in `packages/context-engine/src/parser.ts` before bumping this dependency.
- **API**: `getSymbolsOverview`, `findSymbol`, `findReferencingSymbols`, `searchPattern` — naming borrowed from Serena's own symbol-tool taxonomy. Exposed to hosts as one consolidated MCP tool, `search_codebase` (an `action` enum, not four separate tools — every registered tool definition is token overhead paid every session whether or not it's called, so fewer/richer tool definitions is a cost-saving choice in itself, not just a style preference).
- **Honest limitation**: identifier-boundary-aware (matches real tree-sitter tokens, never a substring inside a string/comment — a real improvement over grep), but **not** scope/type-aware like a real language server. Two unrelated symbols sharing a name in different scopes both surface in `find_symbol`/`find_references` results. Closing that gap is exactly what Phase 2's real LSP backends are for.
- **`context-scoper`** (`packages/skills/skills/context-scoper/`) is the skill that instructs the host model to call `search_codebase` before reading whole files — the actual "better tool-calling via semantic search" behavior, not just a tool sitting unused. See `scripts/eval-context-engine/RESULTS.md` for an early, honestly-scoped, reproducible measurement of the token difference this makes.

## Cost transparency

`npx @vovy-ai/go doctor` reports a deterministic "always-on token footprint" estimate — the chars/4-estimated size of every installed skill file plus every registered MCP tool's name/title/description, the tokens a session pays whether or not a skill ever fires or a tool ever gets called. This is the honest, buildable version of "cost savings": show the real number rather than an unverifiable savings-percentage marketing claim (see `packages/cli/src/commands/doctor.ts`'s `estimateTokens`/`computeTokenFootprint`).

## Roadmap

**Built (v0.2 Phase 1):** tree-sitter-based Context Engine, `search_codebase`, `context-scoper`, `doctor`'s token-footprint report — all described above.

**Phase 2, deliberately not built yet:**

- **Real per-language LSP backends** (`gopls`, `pyright`, `rust-analyzer`, `typescript-language-server`) for Serena-grade scope/type-aware symbol resolution, closing the "same name, different scope" gap noted above. Bigger lift: per-language external tool install burden that cuts against zero-friction install unless Vovy auto-installs them, so this is being done as its own phase rather than blocking Phase 1.
- **Model-tier routing / response caching / tool-output compression** (RouteLLM/GPTCache/LLMLingua-style techniques) — still no hosted endpoint, still local-only if built, just not started yet.
- **Persistent/vector-based fuzzy search index** — Phase 1's in-process cache only survives one process lifetime; nothing persists across separate CLI/MCP-server invocations yet.
- **Curated skill registry / distribution trust layer.**

**Explicitly a different, separate tier — not part of the free-forever core, and not scoped into any current work:** team/org skill sync (a shared "vovy account" letting a company publish one brand skill every employee's install references, plus visibility into who's prompting how much). This needs a real backend, auth, and usage telemetry — all three things the free-forever core deliberately rules out (see "The hard constraint" above). If built, it would be an explicit opt-in layer on top of the always-free local core, not a bend of this document's constraint.

**Still true, and still a deliberate choice, not an oversight:** no telemetry of any kind in the free-forever core — a telemetry backend implies infrastructure cost, which contradicts the free-forever constraint.
