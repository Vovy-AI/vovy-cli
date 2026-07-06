# @vovy-ai/go

Free, forever, drop-in skills for vibe coding safely — the `vovy` CLI installer.

```
npx @vovy-ai/go install
```

That's it. It detects which AI coding tool you have installed — [Claude Code](https://claude.com/claude-code), [Codex CLI](https://developers.openai.com/codex), [Cursor](https://cursor.com), [Cline](https://cline.bot), or [Windsurf](https://windsurf.com) — and writes Vovy's skills there. Your very next prompt gets the benefit.

```
npx @vovy-ai/go doctor       # check everything is installed correctly
npx @vovy-ai/go uninstall    # remove everything Vovy wrote, cleanly
```

Installed globally (`npm i -g @vovy-ai/go`), the command is just `vovy`.

`npx @vovy-ai/go doctor` also reports a deterministic "always-on token footprint" — every installed skill file plus every registered MCP tool definition, the tokens a session pays whether or not any of it ever fires.

It's MIT-licensed and runs entirely on your machine — no account, no API key, nothing phoning home.

## What it installs

Four skills plus a local MCP server that give AI coding assistants deterministic project context and safety rails:

| Skill | What it does |
|---|---|
| **Prompt Rescoper** | Rewrites vague, oversized requests into a small, reviewable spec before any code is written. |
| **Project Skill Drafter** | Analyzes your actual project and drafts a project-specific skill so future requests already know your stack. |
| **Founder Explainer** | Explains destructive/high-stakes actions in plain English before they happen, and flags common vibe-coding security mistakes. |
| **Context Scoper** | Calls a tree-sitter-backed Context Engine to find the exact symbol or file before reading whole files — fewer tokens spent, fewer same-named false matches. |

Full docs, architecture, and source: **[github.com/Vovy-AI/vovy-cli](https://github.com/Vovy-AI/vovy-cli)**

## License

MIT
