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

`@vovy-ai/mcp-server` additionally exposes one deterministic MCP **tool**, `analyze_project`: plain static analysis (read `package.json`, walk the file tree, detect framework/package-manager/test-runner signals, flag a few concrete footguns like an untracked `.env`). No network calls, no LLM, no guessing. The `project-skill-drafter` skill instructs the host's own model to turn that tool's output into a tailored project skill file — this is how "auto-generate a project-specific skill from codebase analysis" works without Vovy running any inference: Vovy supplies facts, the founder's own paid model supplies judgment.

## Package layout

```
packages/
├── skills/          @vovy-ai/skills       — SKILL.md content + typed manifest (single source of truth)
├── host-detect/     @vovy-ai/host-detect  — HostAdapter interface + per-host detect/write logic
├── mcp-server/       @vovy-ai/mcp-server   — MCP server (stdio); serves analyze_project + prompts/resources
└── cli/               @vovy-ai/go        — `npx @vovy-ai/go install|doctor|uninstall`
```

`@vovy-ai/skills` has zero runtime dependencies and is the actual product content; both `cli` and `mcp-server` import it so the two delivery paths can never drift apart. `@vovy-ai/host-detect` isolates the highest-blast-radius code — writing into other tools' config directories inside `$HOME` — behind a small `HostAdapter` interface, and is the main extension point for adding new hosts (see [`host-support-matrix.md`](host-support-matrix.md) and [`../CONTRIBUTING.md`](../CONTRIBUTING.md)).

## What v0.1 explicitly does not do

- No semantic-embedding model-tier routing yet (planned for v0.2+, as an in-process/local-only embedding step — still zero-cost, no hosted endpoint).
- No context engine beyond `analyze_project` (v0.2+ direction: LSP-based retrieval in the spirit of Serena, all MIT-licensed prior art).
- No telemetry of any kind — a telemetry backend implies infrastructure cost, which contradicts the free-forever constraint.
