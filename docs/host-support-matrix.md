# Host support matrix

| Host | Skill file path | Status | MCP config | Status |
|---|---|---|---|---|
| **Claude Code** | `~/.claude/skills/<id>/SKILL.md` (user) or `.claude/skills/<id>/SKILL.md` (project) | ✅ Verified against [official docs](https://code.claude.com/docs/en/skills) | `.mcp.json` / `~/.claude/mcp.json` | ✅ Verified |
| **Codex CLI** | `.agents/skills/<id>/SKILL.md` (project) | ✅ Verified against [official docs](https://developers.openai.com/codex/skills) | `~/.codex/config.toml` (`[mcp_servers.<id>]`) | ✅ Verified path; ⚠️ user-scope skill path (`~/.codex/skills/`) not independently confirmed |
| **Cursor** | `.cursor/rules/<id>.mdc` | ⚠️ Best effort — targets the established Rules mechanism, not Cursor's newer Skills feature (exact path unconfirmed) | `.cursor/mcp.json` / `~/.cursor/mcp.json` | ⚠️ Best effort |
| **Cline** | `.clinerules/<id>.md` | ⚠️ Best effort | — | ❌ Not implemented — MCP config location varies by VS Code install and wasn't confirmed. Skill file alone is enough for Cline's agent loop. |
| **Windsurf** | `.windsurf/rules/<id>.md` | ⚠️ Best effort | `~/.codeium/windsurf/mcp_config.json` | ⚠️ Best effort |

`detect()` for Cline always returns `false` — there's no reliable filesystem signal that Cline (a VS Code extension) is installed, so it's only ever targeted via `npx @vovy-ai/go install --host cline`, never silently.

## Confirming or fixing a path

If you can verify or correct any `⚠️ Best effort` row above against a real install:

1. Look at the corresponding adapter in `packages/host-detect/src/adapters/`.
2. Update the path and the doc comment at the top of the file.
3. Add a test in the adjacent `*.test.ts` file asserting the corrected path.
4. Update this table.
5. Open a PR — this is one of the best first contributions to Vovy. See [`../CONTRIBUTING.md`](../CONTRIBUTING.md).
