import { existsSync } from "node:fs";
import { join } from "node:path";
import type { DetectEnv, HostAdapter, McpServerEntry, SkillScope } from "../types.js";

/**
 * Codex CLI — Agent Skills at `.agents/skills/<id>/SKILL.md`, scanned from the current
 * directory up to the repo root for project scope, plus a user-level location for
 * personal skills. MCP servers register as `[mcp_servers.<id>]` tables in `config.toml`.
 * https://developers.openai.com/codex/skills
 *
 * The project-scope skill path is directly confirmed by Codex's own docs. The user-scope
 * skill path below (`~/.codex/skills/`) mirrors the confirmed location of `config.toml`
 * but has not been independently verified against a live install — flagged in
 * docs/host-support-matrix.md as a good first contribution to confirm/fix.
 */
export const codexAdapter: HostAdapter = {
  id: "codex",
  label: "Codex CLI",

  detect(env: DetectEnv): boolean {
    return existsSync(join(env.home, ".codex"));
  },

  skillFilePath(env: DetectEnv, scope: SkillScope, skillId: string): string {
    const base =
      scope === "user" ? join(env.home, ".codex", "skills") : join(env.cwd, ".agents", "skills");
    return join(base, skillId, "SKILL.md");
  },

  mcpConfigPath(env: DetectEnv): string {
    return join(env.home, ".codex", "config.toml");
  },

  mergeMcpConfig(existing: string | undefined, entry: McpServerEntry): string {
    const tableHeader = `[mcp_servers.${entry.id}]`;
    const base = existing ?? "";
    const argsToml = entry.args.map((a) => JSON.stringify(a)).join(", ");
    const block = `${tableHeader}\ncommand = ${JSON.stringify(entry.command)}\nargs = [${argsToml}]\n`;

    const found = findTableBlock(base, tableHeader);
    if (found) {
      // Table already exists — replace it in place only if its content actually differs,
      // so re-running install after e.g. a package rename fixes a stale command/args
      // instead of silently leaving the old entry behind forever.
      const currentBlock = base.slice(found.start, found.end);
      if (currentBlock.trim() === block.trim()) return base;
      return base.slice(0, found.start) + block + base.slice(found.end);
    }

    const separator =
      base.length > 0 && !base.endsWith("\n\n") ? (base.endsWith("\n") ? "\n" : "\n\n") : "";
    return `${base}${separator}${block}`;
  },
};

/**
 * Finds a `[table.header]` block's span in a TOML string: from the header up to, but not
 * including, the next `[` table header or end of file. Shared by `mergeMcpConfig` (to
 * replace an existing block in place) and `removeCodexMcpEntry` (to delete one) so both
 * agree on exactly what "this table's content" means.
 */
function findTableBlock(text: string, header: string): { start: number; end: number } | null {
  const start = text.indexOf(header);
  if (start === -1) return null;
  const rest = text.slice(start + header.length);
  const nextHeaderMatch = rest.match(/\n\[/);
  const end =
    nextHeaderMatch?.index != null
      ? start + header.length + nextHeaderMatch.index + 1
      : text.length;
  return { start, end };
}

/**
 * Removes a `[mcp_servers.<id>]` table block from a Codex `config.toml`. Deliberately
 * conservative: only strips the block this adapter would itself have written, leaving
 * everything else in a hand-edited TOML file untouched. Returns `null` if the table isn't
 * present, so the caller can skip writing.
 */
export function removeCodexMcpEntry(existing: string | undefined, id: string): string | null {
  if (!existing) return null;
  const found = findTableBlock(existing, `[mcp_servers.${id}]`);
  if (!found) return null;
  return existing.slice(0, found.start) + existing.slice(found.end);
}
