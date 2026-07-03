import type { McpServerEntry } from "./types.js";

/**
 * Shared merge logic for the several hosts that store MCP servers as
 * `{ "mcpServers": { "<id>": { "command": ..., "args": [...] } } }` JSON — Claude Code's
 * `.mcp.json`, Cursor's `mcp.json`, and Windsurf's `mcp_config.json` all use this shape.
 * Preserves every other key in the file untouched; only ever writes/overwrites the one
 * `mcpServers.<entry.id>` entry, so a founder's other configured MCP servers are never
 * clobbered.
 */
export function mergeJsonMcpConfig(existing: string | undefined, entry: McpServerEntry): string {
  let config: Record<string, unknown> = {};
  if (existing?.trim()) {
    try {
      const parsed = JSON.parse(existing);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        config = parsed as Record<string, unknown>;
      }
    } catch {
      throw new Error(
        "Existing MCP config is not valid JSON — refusing to overwrite it. Please fix or remove it and re-run `npx @vovy-ai/go install`.",
      );
    }
  }

  const existingServers =
    config.mcpServers && typeof config.mcpServers === "object" && !Array.isArray(config.mcpServers)
      ? (config.mcpServers as Record<string, unknown>)
      : {};

  config.mcpServers = {
    ...existingServers,
    [entry.id]: {
      command: entry.command,
      args: entry.args,
    },
  };

  return `${JSON.stringify(config, null, 2)}\n`;
}

/**
 * Inverse of `mergeJsonMcpConfig`: removes only the `mcpServers.<id>` entry, leaving every
 * other key untouched. Returns `null` when there's nothing to do (file missing, not valid
 * JSON, or the entry was never present) so callers can skip writing rather than risk
 * clobbering a file they don't understand.
 */
export function removeJsonMcpEntry(existing: string | undefined, id: string): string | null {
  if (!existing?.trim()) return null;
  let config: Record<string, unknown>;
  try {
    const parsed = JSON.parse(existing);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    config = parsed as Record<string, unknown>;
  } catch {
    return null;
  }

  const servers = config.mcpServers;
  if (!servers || typeof servers !== "object" || Array.isArray(servers) || !(id in servers)) {
    return null;
  }

  const { [id]: _removed, ...rest } = servers as Record<string, unknown>;
  // JSON.stringify omits keys whose value is `undefined`, so this drops mcpServers
  // entirely from the written file rather than leaving an empty `{}` behind.
  config.mcpServers = Object.keys(rest).length > 0 ? rest : undefined;

  return `${JSON.stringify(config, null, 2)}\n`;
}
