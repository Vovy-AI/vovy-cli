import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { DetectEnv, HostAdapter, McpServerEntry, SkillScope } from "./types.js";

export type WriteAction = "created" | "updated" | "unchanged";

export interface WriteResult {
  path: string;
  action: WriteAction;
  /** True if this result came from a dry run — `action` reflects what *would* happen,
   * nothing was actually written to disk. */
  dryRun: boolean;
}

export interface WriteSkillOptions {
  adapter: HostAdapter;
  env: DetectEnv;
  scope: SkillScope;
  skillId: string;
  content: string;
  dryRun?: boolean;
}

export function writeSkillFile(opts: WriteSkillOptions): WriteResult {
  const path = opts.adapter.skillFilePath(opts.env, opts.scope, opts.skillId);
  const existing = existsSync(path) ? readFileSync(path, "utf8") : undefined;
  const action: WriteAction =
    existing === opts.content ? "unchanged" : existing === undefined ? "created" : "updated";

  const dryRun = opts.dryRun ?? false;
  if (!dryRun && action !== "unchanged") {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, opts.content, "utf8");
  }
  return { path, action, dryRun };
}

export interface WriteMcpConfigOptions {
  adapter: HostAdapter;
  env: DetectEnv;
  scope: SkillScope;
  entry: McpServerEntry;
  dryRun?: boolean;
}

export function writeMcpConfig(opts: WriteMcpConfigOptions): WriteResult | null {
  const path = opts.adapter.mcpConfigPath(opts.env, opts.scope);
  if (!path) return null;

  const existing = existsSync(path) ? readFileSync(path, "utf8") : undefined;
  const next = opts.adapter.mergeMcpConfig(existing, opts.entry);
  const action: WriteAction =
    existing === next ? "unchanged" : existing === undefined ? "created" : "updated";

  const dryRun = opts.dryRun ?? false;
  if (!dryRun && action !== "unchanged") {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, next, "utf8");
  }
  return { path, action, dryRun };
}
