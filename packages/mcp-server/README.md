# @vovy-ai/mcp-server

The MCP server component of [Vovy](https://github.com/Vovy-AI/vovy-cli) — a drop-in skill pack for vibe coding safely with AI coding assistants. Free forever, MIT, local-only.

You normally don't install this directly. `npx @vovy-ai/go install` registers it automatically in your AI coding tool's MCP config (Claude Code, Codex CLI, Cursor, Cline, Windsurf), which then launches it itself via `npx -y @vovy-ai/mcp-server`.

## What it does

- **`analyze_project`** — a deterministic, non-LLM tool: reads `package.json` and the local file tree to report detected framework/stack, package manager, test runner, and a few concrete security footguns (like an untracked `.env`). No network access, no guessing, no AI involved.
- **`search_codebase`** — deterministic symbol search over JS/TS/JSX/TSX via [`@vovy-ai/context-engine`](https://www.npmjs.com/package/@vovy-ai/context-engine): find a symbol's declaration, its usages, a file's structure (including class methods and interface members), or its transitive blast radius (`impact`: "what breaks if I change this", depth-tagged), without reading whole files. Resolved through your project's own TypeScript when available — so two same-named symbols in different scopes stay distinct — and through tree-sitter otherwise. Every response names which backend answered. No embeddings, no network access.
- **`project_memory`** — records and recalls your project's decisions (with what was rejected and why), mistakes (with how to avoid repeating them), and constraints (with the why behind the rule) as plain markdown under `.vovy/memory/`, committed to git. Git is the backend: memory travels with clone to every machine, teammate, and AI tool — no account, no server. Recall is deterministic keyword search, and `record` refuses anything that looks like a credential.
- Serves the same skill content [`@vovy-ai/skills`](https://www.npmjs.com/package/@vovy-ai/skills) ships as MCP prompts and resources (`skill://<id>`) — a secondary, redundant discovery path alongside the skill files `vovy install` already writes directly into your tool's native skill directory.

Like the rest of Vovy, this never calls a hosted API or runs its own AI model — it's a local, offline analysis tool.

Full docs: **[github.com/Vovy-AI/vovy-cli](https://github.com/Vovy-AI/vovy-cli)**

## License

MIT
