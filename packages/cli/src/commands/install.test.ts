import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SKILL_MANIFEST } from "@vovy/skills";
import { afterEach, describe, expect, it } from "vitest";
import { tmpEnv } from "../test-utils.js";
import { runDoctor } from "./doctor.js";
import { runInstall } from "./install.js";
import { runUninstall } from "./uninstall.js";

describe("install / doctor / uninstall lifecycle", () => {
  let cleanup: () => void;
  afterEach(() => cleanup?.());

  it("installs into an explicitly targeted host, reports healthy via doctor, then fully uninstalls", () => {
    const t = tmpEnv();
    cleanup = t.cleanup;
    // Nothing auto-detects in a fresh tmp home — target claude-code explicitly, matching
    // how a founder would use `--host claude-code` if auto-detection ever misses them.
    const hosts = ["claude-code"];

    const installReports = runInstall({ env: t.env, hosts, scope: "user" });
    expect(installReports).toHaveLength(1);
    const [report] = installReports;
    expect(report?.skillResults).toHaveLength(SKILL_MANIFEST.length);
    for (const r of report?.skillResults ?? []) {
      expect(r.action).toBe("created");
      expect(existsSync(r.path)).toBe(true);
      expect(readFileSync(r.path, "utf8")).toContain(`name: ${r.skillId}`);
    }
    expect(report?.mcpResult?.action).toBe("created");
    const mcpConfig = JSON.parse(readFileSync(report?.mcpResult?.path ?? "", "utf8"));
    expect(mcpConfig.mcpServers.vovy).toEqual({ command: "npx", args: ["-y", "@vovy/mcp-server"] });

    const doctorReports = runDoctor(t.env, hosts, "user");
    expect(doctorReports).toHaveLength(1);
    expect(doctorReports[0]?.healthy).toBe(true);

    const uninstallReports = runUninstall({ env: t.env, hosts, scope: "user" });
    expect(uninstallReports[0]?.removedSkillPaths).toHaveLength(SKILL_MANIFEST.length);
    for (const p of uninstallReports[0]?.removedSkillPaths ?? []) {
      expect(existsSync(p)).toBe(false);
    }
    expect(uninstallReports[0]?.removedMcpEntry).toBeTruthy();
    const mcpConfigAfter = JSON.parse(readFileSync(report?.mcpResult?.path ?? "", "utf8"));
    expect(mcpConfigAfter.mcpServers).toBeUndefined();
  });

  it("never modifies an unrelated MCP server already present in the host's config", () => {
    const t = tmpEnv();
    cleanup = t.cleanup;
    const claudeDir = join(t.env.home, ".claude");
    mkdirSync(claudeDir, { recursive: true });
    const mcpPath = join(claudeDir, "mcp.json");
    const preexisting = { mcpServers: { "some-other-tool": { command: "foo", args: ["bar"] } } };
    writeFileSync(mcpPath, JSON.stringify(preexisting));

    runInstall({ env: t.env, hosts: ["claude-code"], scope: "user" });
    const afterInstall = JSON.parse(readFileSync(mcpPath, "utf8"));
    expect(afterInstall.mcpServers["some-other-tool"]).toEqual({ command: "foo", args: ["bar"] });
    expect(afterInstall.mcpServers.vovy).toBeDefined();

    runUninstall({ env: t.env, hosts: ["claude-code"], scope: "user" });
    const afterUninstall = JSON.parse(readFileSync(mcpPath, "utf8"));
    expect(afterUninstall.mcpServers["some-other-tool"]).toEqual({ command: "foo", args: ["bar"] });
    expect(afterUninstall.mcpServers.vovy).toBeUndefined();
  });

  it("dry-run install leaves the filesystem completely untouched", () => {
    const t = tmpEnv();
    cleanup = t.cleanup;
    runInstall({ env: t.env, hosts: ["claude-code"], scope: "user", dryRun: true });
    expect(existsSync(join(t.env.home, ".claude"))).toBe(false);
  });
});
