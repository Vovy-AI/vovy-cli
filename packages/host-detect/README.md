# @vovy-ai/host-detect

Per-host detection and safe config writing for [Vovy](https://github.com/Vovy-AI/vovy-cli) — a free, forever, drop-in skill pack for vibe coding safely with AI coding assistants.

You normally don't install this directly — run `npx @vovy-ai/go install` instead. This package detects which AI coding tools are installed on your machine (Claude Code, Codex CLI, Cursor, Cline, Windsurf) and safely reads/writes their skill files and MCP config — idempotently, and never touching any key it doesn't own.

It's the main extension point for contributing new host support to Vovy: see [`CONTRIBUTING.md`](https://github.com/Vovy-AI/vovy-cli/blob/main/CONTRIBUTING.md) and the current [host support matrix](https://github.com/Vovy-AI/vovy-cli/blob/main/docs/host-support-matrix.md).

## License

MIT
