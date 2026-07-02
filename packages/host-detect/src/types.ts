/**
 * Every path-touching function takes an explicit `DetectEnv` instead of reading
 * `process.env`/`os.homedir()` directly. That's what lets tests redirect `home`/`cwd`
 * to a throwaway `os.tmpdir()` and snapshot exactly what would be written, without ever
 * touching the real machine's dotfiles.
 */
export interface DetectEnv {
  home: string;
  cwd: string;
  platform: NodeJS.Platform;
}

export type SkillScope = "user" | "project";

export interface McpServerEntry {
  /** Server id/key as it should appear in the host's config, e.g. "vovy". */
  id: string;
  command: string;
  args: string[];
}

export interface HostAdapter {
  /** Stable id, used with `--host <id>` and in test fixtures. */
  id: string;
  /** Human-readable name shown in CLI output. */
  label: string;
  /**
   * Best-effort signal that this host tool is installed/configured on this machine.
   * Should never throw — return false on any uncertainty rather than guessing.
   */
  detect(env: DetectEnv): boolean;
  /**
   * Absolute path Vovy should write the skill identified by `skillId` to, for this host
   * at the given scope. Hosts differ on convention — some use a folder-per-skill with a
   * fixed filename (Claude Code/Codex: `<dir>/<skillId>/SKILL.md`), others use one flat
   * file per skill (Cline/Windsurf: `<dir>/<skillId>.md`) — so this returns the full path
   * rather than exposing a directory + fixed filename that wouldn't fit both shapes.
   */
  skillFilePath(env: DetectEnv, scope: SkillScope, skillId: string): string;
  /**
   * Path to this host's MCP server config file, or null if this host is skills-only
   * (no MCP registration support/needed).
   */
  mcpConfigPath(env: DetectEnv, scope: SkillScope): string | null;
  /**
   * Merge `entry` into the raw contents of an existing config file (`existing`, undefined
   * if the file doesn't exist yet) and return the full new file contents to write.
   * Must be idempotent — merging the same entry twice produces the same result as once.
   */
  mergeMcpConfig(existing: string | undefined, entry: McpServerEntry): string;
}

/**
 * Adapters that are fully verified against the host's official documentation and are
 * safe to auto-detect by default.
 */
export const VERIFIED_ADAPTER_IDS = ["claude-code", "codex"] as const;
