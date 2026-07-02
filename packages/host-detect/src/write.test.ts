import { existsSync, readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { claudeCodeAdapter } from "./adapters/claude-code.js";
import { tmpEnv } from "./test-utils.js";
import { writeMcpConfig, writeSkillFile } from "./write.js";

const ENTRY = { id: "vovy", command: "npx", args: ["-y", "@vovy/mcp-server"] };

describe("writeSkillFile / writeMcpConfig", () => {
  let cleanup: () => void;

  afterEach(() => cleanup?.());

  it("dry-run never touches the filesystem", () => {
    const t = tmpEnv();
    cleanup = t.cleanup;
    const result = writeSkillFile({
      adapter: claudeCodeAdapter,
      env: t.env,
      scope: "user",
      skillId: "prompt-rescoper",
      content: "hello",
      dryRun: true,
    });
    expect(result.action).toBe("created");
    expect(result.dryRun).toBe(true);
    expect(existsSync(result.path)).toBe(false);
  });

  it("creates the file, then reports unchanged on a second identical run", () => {
    const t = tmpEnv();
    cleanup = t.cleanup;
    const first = writeSkillFile({
      adapter: claudeCodeAdapter,
      env: t.env,
      scope: "user",
      skillId: "prompt-rescoper",
      content: "hello",
    });
    expect(first.action).toBe("created");
    expect(readFileSync(first.path, "utf8")).toBe("hello");

    const second = writeSkillFile({
      adapter: claudeCodeAdapter,
      env: t.env,
      scope: "user",
      skillId: "prompt-rescoper",
      content: "hello",
    });
    expect(second.action).toBe("unchanged");
  });

  it("reports updated when content changes", () => {
    const t = tmpEnv();
    cleanup = t.cleanup;
    writeSkillFile({
      adapter: claudeCodeAdapter,
      env: t.env,
      scope: "user",
      skillId: "prompt-rescoper",
      content: "v1",
    });
    const updated = writeSkillFile({
      adapter: claudeCodeAdapter,
      env: t.env,
      scope: "user",
      skillId: "prompt-rescoper",
      content: "v2",
    });
    expect(updated.action).toBe("updated");
    expect(readFileSync(updated.path, "utf8")).toBe("v2");
  });

  it("writes and merges the MCP config idempotently", () => {
    const t = tmpEnv();
    cleanup = t.cleanup;
    const first = writeMcpConfig({
      adapter: claudeCodeAdapter,
      env: t.env,
      scope: "user",
      entry: ENTRY,
    });
    expect(first?.action).toBe("created");

    const second = writeMcpConfig({
      adapter: claudeCodeAdapter,
      env: t.env,
      scope: "user",
      entry: ENTRY,
    });
    expect(second?.action).toBe("unchanged");
  });
});
