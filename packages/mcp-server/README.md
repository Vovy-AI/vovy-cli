# @vovy-ai/mcp-server

The MCP server component of [Vovy](https://github.com/Vovy-AI/vovy-cli) — a free, forever, drop-in skill pack for vibe coding safely with AI coding assistants.

You normally don't install this directly. `npx @vovy-ai/go install` registers it automatically in your AI coding tool's MCP config (Claude Code, Codex CLI, Cursor, Cline, Windsurf), which then launches it itself via `npx -y @vovy-ai/mcp-server`.

## What it does

- **`analyze_project`** — a deterministic, non-LLM tool: reads `package.json` and the local file tree to report detected framework/stack, package manager, test runner, and a few concrete security footguns (like an untracked `.env`). No network access, no guessing, no AI involved.
- Serves the same skill content [`@vovy-ai/skills`](https://www.npmjs.com/package/@vovy-ai/skills) ships as MCP prompts and resources (`skill://<id>`) — a secondary, redundant discovery path alongside the skill files `vovy install` already writes directly into your tool's native skill directory.

Like the rest of Vovy, this never calls a hosted API or runs its own AI model — it's a local, offline analysis tool.

Full docs: **[github.com/Vovy-AI/vovy-cli](https://github.com/Vovy-AI/vovy-cli)**

## License

MIT
