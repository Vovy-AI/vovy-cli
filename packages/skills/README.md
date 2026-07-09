# @vovy-ai/skills

The skill content for [Vovy](https://github.com/Vovy-AI/vovy-cli) — a drop-in skill pack for vibe coding safely with AI coding assistants. Free forever, MIT, local-only.

You normally don't install this directly — run `npx @vovy-ai/go install` instead. This package is the single source of truth for Vovy's skill content: `SKILL.md` files plus a typed manifest, consumed by both the CLI installer ([`vovy`](https://www.npmjs.com/package/@vovy-ai/go)) and the MCP server ([`@vovy-ai/mcp-server`](https://www.npmjs.com/package/@vovy-ai/mcp-server)), so the content never drifts between the two delivery paths.

## What's inside

| Skill | What it does |
|---|---|
| **Prompt Rescoper** | Rewrites vague, oversized requests into a small, reviewable spec — with a "how we'll verify" line and explicit acceptable imperfections — before any code is written. |
| **Project Skill Drafter** | Analyzes your actual project and drafts a project-specific skill so future requests already know your stack. |
| **Founder Explainer** | Explains destructive/high-stakes actions in plain English before they happen, and flags common vibe-coding security mistakes. |
| **Context Scoper** | Calls the `search_codebase` MCP tool ([`@vovy-ai/context-engine`](https://www.npmjs.com/package/@vovy-ai/context-engine)) to find the exact symbol, method, or usage site before reading whole files — including transitive "what breaks if I change this" impact analysis. |
| **Memory Keeper** | Calls the `project_memory` MCP tool to record decisions, mistakes, and constraints — each with its rationale — into git-committed `.vovy/memory/`, and to recall them before new work repeats an old failure. |

## Beyond the markdown

Each skill also carries structured trigger metadata (`phrases` / `keywords` / `anti-phrases`) that is test-enforced against its own description, so trigger conditions are regression-testable data rather than prose. A `{{PROJECT}}` placeholder in descriptions is substituted with the detected stack at install time (project scope) — `detectProjectContext`, `contextualize`, and a deterministic `matchSkills` scorer are exported for anyone building on this.

Full docs: **[github.com/Vovy-AI/vovy-cli](https://github.com/Vovy-AI/vovy-cli)**

## License

MIT
