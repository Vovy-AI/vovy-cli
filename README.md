# Vovy

Vovy teaches non-technical founders to vibe code safely, using tools you already have. It's free, forever — for you and for us — because Vovy never runs its own AI model. It just writes a few skill files into your existing coding tool, which reads them for free using the model you already pay for.

No account. No API key. No new subscription. No servers to trust with your code.

## 60-second install

```
npx @vovy-ai/go install
```

That's it. Vovy detects which AI coding tool you have installed — [Claude Code](https://claude.com/claude-code), [Codex CLI](https://developers.openai.com/codex), [Cursor](https://cursor.com), [Cline](https://cline.bot), or [Windsurf](https://windsurf.com) — and writes its skills there. Your very next prompt gets the benefit.

```
npx @vovy-ai/go doctor       # check everything is installed correctly
npx @vovy-ai/go uninstall    # remove everything Vovy wrote, cleanly
```

## What it actually does

**Before:** *"add user accounts to my app"* → the AI guesses at scope, builds five things at once, and you have no idea what changed or whether it's safe.

**After Vovy:** the AI stops and rescopes first —

> **Goal:** let people sign up and log in.
> **Building now:** email/password signup + login, nothing else yet.
> **Not doing yet:** password reset, social login, email verification.
> **Assuming:** accounts are private by default — say if that's wrong.

Then it builds *that*, and before anything destructive or high-stakes happens (deleting data, touching auth, installing dependencies, deploying), it explains what's about to happen in plain English before doing it — and checks for the specific security mistakes that showed up in [about 1 in 3 vibe-coded apps deployed publicly](https://www.forbes.com/sites/jodiecook/2026/03/20/vibe-coding-has-a-massive-security-problem/): hardcoded secrets, missing auth checks, overly permissive access.

Vovy ships three skills in v0.1:

| Skill | What it does |
|---|---|
| **Prompt Rescoper** | Rewrites vague, oversized requests into a small, reviewable spec before any code is written. |
| **Project Skill Drafter** | Analyzes your actual project (via a deterministic, non-AI tool call — no guessing) and drafts a project-specific skill so future requests already know your stack. |
| **Founder Explainer** | Explains destructive/high-stakes actions in plain English before they happen, and flags common vibe-coding security mistakes. |

## FAQ

**Does this cost anything, ever?** No. Vovy holds no API keys and runs no servers — it writes markdown files your existing tool reads with the model you already pay for. There is nothing to meter or paywall, by design.

**Which tools does this work with?** Claude Code and Codex CLI are fully supported today. Cursor, Cline, and Windsurf support is included but best-effort — see [`docs/host-support-matrix.md`](docs/host-support-matrix.md) for exact status, and please open a PR if you can confirm or fix a path.

**Is my code sent to Vovy's servers?** There are no Vovy servers. `npx @vovy-ai/go install` only writes local files on your own machine.

**What does this actually change on my machine?** A few markdown skill files inside your coding tool's own config directory (e.g. `~/.claude/skills/`), plus one line registering `@vovy-ai/mcp-server` in that tool's MCP config. Run `npx @vovy-ai/go install --dry-run` first to see exactly what would be written before anything happens, and `npx @vovy-ai/go uninstall` any time to remove it all.

## How it works (for the curious)

MCP has a feature (`sampling`) that would let a server ask the connected client to run a completion on its own model — in theory, exactly what Vovy would need. In practice, no major host tool implements it today, and the next MCP spec revision deprecates it. So Vovy doesn't depend on it. Instead, `npx @vovy-ai/go install` writes skill files directly into each tool's own native skill/rules directory — the same mechanism your tool already uses for its own instructions — so the "thinking" happens for free inside your normal, already-paid-for agent session. The one piece of real computation Vovy does — reading your `package.json` and file tree to detect your stack — is a plain, deterministic, non-AI function call, not a hosted service. See [`docs/architecture.md`](docs/architecture.md) for the full picture.

## Contributing

Vovy is MIT-licensed and welcomes contributions — new host adapters especially. See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

[MIT](LICENSE)
