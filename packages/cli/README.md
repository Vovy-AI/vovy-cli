# @vovy-ai/go

The `vovy` CLI — one command drops project-aware skills, scope-aware code search, and git-committed project memory into the AI coding tool you already use. Free forever.

```
npx @vovy-ai/go install
```

That's it. It detects which AI coding tool you have installed — [Claude Code](https://claude.com/claude-code), [Codex CLI](https://developers.openai.com/codex), [Cursor](https://cursor.com), [Cline](https://cline.bot), or [Windsurf](https://windsurf.com) — and writes Vovy's skills there. Your very next prompt gets the benefit.

```
npx @vovy-ai/go doctor       # check everything is installed correctly
npx @vovy-ai/go uninstall    # remove everything Vovy wrote, cleanly
npx @vovy-ai/go statusline   # one-line badge for your tool's status bar
```

Installed globally (`npm i -g @vovy-ai/go`), the command is just `vovy`.

`npx @vovy-ai/go doctor` also reports a deterministic "always-on token footprint" — every installed skill file plus every registered MCP tool definition, the tokens a session pays whether or not any of it ever fires — and tells you which Context Engine backend your project gets: `typescript` (scope-aware, resolved through your project's own TypeScript) or `tree-sitter` (name-matching fallback), with the one-line upgrade if you're on the fallback.

It's MIT-licensed and runs entirely on your machine — no account, no API key, no background telemetry. The only network call in the CLI is a one-time, two-question install survey that sends answers **only if you type them**; skip it (or set `VOVY_NO_SURVEY=1`) and nothing is ever sent.

## What it installs

Five skills plus a local MCP server that give AI coding assistants deterministic project context, durable memory, and safety rails:

| Skill | What it does |
|---|---|
| **Prompt Rescoper** | Rewrites vague, oversized requests into a small, reviewable spec — including how the change will be verified and what imperfections are acceptable — before any code is written. |
| **Project Skill Drafter** | Analyzes your actual project and drafts a project-specific skill so future requests already know your stack. |
| **Founder Explainer** | Explains destructive/high-stakes actions in plain English before they happen, and flags common vibe-coding security mistakes. |
| **Context Scoper** | Finds the exact symbol, method, or file before reading whole files — via your project's own TypeScript when available (scope-aware, so two same-named functions don't get confused), tree-sitter otherwise. Includes `impact`: "what breaks if I change this", walked transitively. |
| **Memory Keeper** | Records decisions (with what was rejected and why), mistakes (with how to avoid repeating them), and constraints (with the why) into `.vovy/memory/` — plain markdown, committed to git, so rationale survives across sessions, machines, teammates, and AI tools. |

With `--scope project`, skill descriptions are tailored to your detected stack (a Next.js + TypeScript project gets descriptions that say so), which helps them trigger at the right moments at zero extra token cost.

Full docs, architecture, and source: **[github.com/Vovy-AI/vovy-cli](https://github.com/Vovy-AI/vovy-cli)**

## License

MIT
