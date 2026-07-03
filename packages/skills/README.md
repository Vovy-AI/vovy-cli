# @vovy-ai/skills

The skill content for [Vovy](https://github.com/Vovy-AI/vovy-cli) — a free, forever, drop-in skill pack for vibe coding safely with AI coding assistants.

You normally don't install this directly — run `npx @vovy-ai/go install` instead. This package is the single source of truth for Vovy's skill content: `SKILL.md` files plus a typed manifest, consumed by both the CLI installer ([`vovy`](https://www.npmjs.com/package/@vovy-ai/go)) and the MCP server ([`@vovy-ai/mcp-server`](https://www.npmjs.com/package/@vovy-ai/mcp-server)), so the content never drifts between the two delivery paths.

## What's inside

| Skill | What it does |
|---|---|
| **Prompt Rescoper** | Rewrites vague, oversized requests into a small, reviewable spec before any code is written. |
| **Project Skill Drafter** | Analyzes your actual project and drafts a project-specific skill so future requests already know your stack. |
| **Founder Explainer** | Explains destructive/high-stakes actions in plain English before they happen, and flags common vibe-coding security mistakes. |

Full docs: **[github.com/Vovy-AI/vovy-cli](https://github.com/Vovy-AI/vovy-cli)**

## License

MIT
