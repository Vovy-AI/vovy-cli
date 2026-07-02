import { describe, expect, it } from "vitest";
import { codexAdapter, removeCodexMcpEntry } from "./codex.js";

const ENTRY = { id: "vovy", command: "npx", args: ["-y", "@vovy-ai/mcp-server"] };

describe("codexAdapter.mergeMcpConfig (TOML)", () => {
  it("appends a mcp_servers table to an empty file", () => {
    const result = codexAdapter.mergeMcpConfig(undefined, ENTRY);
    expect(result).toContain("[mcp_servers.vovy]");
    expect(result).toContain('command = "npx"');
    expect(result).toContain('args = ["-y", "@vovy-ai/mcp-server"]');
  });

  it("leaves an existing table untouched rather than duplicating it (idempotent)", () => {
    const once = codexAdapter.mergeMcpConfig(undefined, ENTRY);
    const twice = codexAdapter.mergeMcpConfig(once, ENTRY);
    expect(twice).toBe(once);
    expect(twice.match(/\[mcp_servers\.vovy\]/g)).toHaveLength(1);
  });

  it("appends after existing unrelated TOML content without altering it", () => {
    const existing = '[some_other_section]\nfoo = "bar"\n';
    const result = codexAdapter.mergeMcpConfig(existing, ENTRY);
    expect(result).toContain('[some_other_section]\nfoo = "bar"');
    expect(result).toContain("[mcp_servers.vovy]");
  });

  it("updates an existing table in place when the args actually change, rather than leaving a stale entry forever", () => {
    const stale = '[mcp_servers.vovy]\ncommand = "npx"\nargs = ["-y", "@old-scope/mcp-server"]\n';
    const result = codexAdapter.mergeMcpConfig(stale, ENTRY);
    expect(result).not.toContain("@old-scope/mcp-server");
    expect(result).toContain('args = ["-y", "@vovy-ai/mcp-server"]');
    expect(result.match(/\[mcp_servers\.vovy\]/g)).toHaveLength(1);
  });

  it("preserves sibling tables when updating an existing entry in place", () => {
    const stale =
      '[mcp_servers.other]\ncommand = "x"\nargs = []\n\n[mcp_servers.vovy]\ncommand = "npx"\nargs = ["-y", "@old-scope/mcp-server"]\n';
    const result = codexAdapter.mergeMcpConfig(stale, ENTRY);
    expect(result).toContain("[mcp_servers.other]");
    expect(result).toContain('args = ["-y", "@vovy-ai/mcp-server"]');
    expect(result).not.toContain("@old-scope/mcp-server");
  });
});

describe("removeCodexMcpEntry", () => {
  it("returns null when the table isn't present", () => {
    expect(removeCodexMcpEntry(undefined, "vovy")).toBeNull();
    expect(removeCodexMcpEntry('[some_other_section]\nfoo = "bar"\n', "vovy")).toBeNull();
  });

  it("removes only the vovy table, preserving sibling tables", () => {
    const withOther = codexAdapter.mergeMcpConfig(
      '[mcp_servers.other]\ncommand = "x"\nargs = []\n',
      ENTRY,
    );
    const result = removeCodexMcpEntry(withOther, "vovy");
    expect(result).not.toBeNull();
    expect(result).not.toContain("[mcp_servers.vovy]");
    expect(result).toContain("[mcp_servers.other]");
  });
});
