# Security

## What Vovy touches on your machine

`vovy install` writes files in exactly two places, and only inside your detected AI coding tool's own config directories:

1. **Skill files** — plain markdown, no executable code — into your tool's native skill/rules directory (e.g. `~/.claude/skills/`, `.agents/skills/`, `.cursor/rules/`).
2. **One MCP server registration entry** (`vovy`, running `npx -y @vovy/mcp-server`) into your tool's MCP config file (e.g. `.mcp.json`, `~/.codex/config.toml`).

Every other key already in those files is left untouched — `vovy install` and `vovy uninstall` only ever create, update, or remove the specific entries they own. Run `vovy install --dry-run` at any time to see exactly what would change before anything is written, and `vovy doctor` to check current status without changing anything.

## What Vovy never does

- Vovy holds no API keys and makes no calls to any Vovy-operated server — there isn't one. All "intelligence" (prompt rewriting, skill drafting) runs inside your own AI coding tool's session, using the model you already have access to.
- `@vovy/mcp-server`'s one tool, `analyze_project`, does local, offline static analysis only (reads `package.json` and the local file tree) — no network requests, no telemetry, no code or file contents leave your machine through it.

## Reporting a vulnerability

If you find a security issue in Vovy itself (e.g. a way `vovy install`/`uninstall` could write outside its intended scope, or corrupt a config file it doesn't own), please open a GitHub issue. For anything you'd rather not disclose publicly before a fix ships, contact a maintainer directly rather than filing a public issue.

## A note on what Vovy is *for*

Vovy's `founder-explainer` skill exists specifically to catch common AI-coding security mistakes (hardcoded secrets, missing auth checks, overly permissive access) in the *projects Vovy helps you build* — that's a product feature, documented in the [README](README.md), not a guarantee about Vovy's own codebase. Please still review what any tool writes to your machine, including this one.
