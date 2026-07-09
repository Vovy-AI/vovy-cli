---
"@vovy-ai/go": patch
"@vovy-ai/skills": patch
"@vovy-ai/mcp-server": patch
"@vovy-ai/context-engine": patch
"@vovy-ai/host-detect": patch
---

Refresh every package README for what 0.3 actually ships — five skills including Memory Keeper, scope-aware search with `impact`, and the `statusline` subcommand — and lead each intro with what the package does rather than the pricing ("free forever" moves to a supporting sentence, including in the CLI help text and package descriptions). npm only refreshes a package's page on publish, so these need a release to become visible; the 0.3.0/0.4.0 release shipped hours before the README sync landed.
