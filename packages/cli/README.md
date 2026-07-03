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

## Why this is free, forever

Vovy never runs its own AI model and never calls a Vovy-hosted server. It only writes markdown skill files that your existing AI coding tool reads for free, using the model you already pay for. No account, no API key, no cost, ever.

## What it installs

Three skills that make AI coding assistants safer and better-scoped for non-technical founders:

| Skill | What it does |
|---|---|
| **Prompt Rescoper** | Rewrites vague, oversized requests into a small, reviewable spec before any code is written. |
| **Project Skill Drafter** | Analyzes your actual project and drafts a project-specific skill so future requests already know your stack. |
| **Founder Explainer** | Explains destructive/high-stakes actions in plain English before they happen, and flags common vibe-coding security mistakes. |

Full docs, architecture, and source: **[github.com/Vovy-AI/vovy-cli](https://github.com/Vovy-AI/vovy-cli)**

## License

MIT
