import { describe, expect, it } from "vitest";
import { mergeJsonMcpConfig, removeJsonMcpEntry } from "./json-mcp-config.js";

const ENTRY = { id: "vovy", command: "npx", args: ["-y", "@vovy/mcp-server"] };

describe("mergeJsonMcpConfig", () => {
  it("creates a fresh config when none exists", () => {
    const result = JSON.parse(mergeJsonMcpConfig(undefined, ENTRY));
    expect(result.mcpServers.vovy).toEqual({ command: "npx", args: ["-y", "@vovy/mcp-server"] });
  });

  it("preserves other mcpServers entries and other top-level keys untouched", () => {
    const existing = JSON.stringify({
      someOtherTopLevelKey: true,
      mcpServers: { "some-other-server": { command: "foo", args: ["bar"] } },
    });
    const result = JSON.parse(mergeJsonMcpConfig(existing, ENTRY));
    expect(result.someOtherTopLevelKey).toBe(true);
    expect(result.mcpServers["some-other-server"]).toEqual({ command: "foo", args: ["bar"] });
    expect(result.mcpServers.vovy).toBeDefined();
  });

  it("is idempotent", () => {
    const once = mergeJsonMcpConfig(undefined, ENTRY);
    const twice = mergeJsonMcpConfig(once, ENTRY);
    expect(twice).toBe(once);
  });

  it("throws rather than silently overwriting invalid JSON", () => {
    expect(() => mergeJsonMcpConfig("{ not valid json", ENTRY)).toThrow(/not valid JSON/);
  });
});

describe("removeJsonMcpEntry", () => {
  it("returns null when the file doesn't exist", () => {
    expect(removeJsonMcpEntry(undefined, "vovy")).toBeNull();
  });

  it("returns null when the entry isn't present", () => {
    const existing = JSON.stringify({ mcpServers: { other: { command: "x", args: [] } } });
    expect(removeJsonMcpEntry(existing, "vovy")).toBeNull();
  });

  it("removes only the named entry, preserving siblings", () => {
    const existing = mergeJsonMcpConfig(
      JSON.stringify({ mcpServers: { other: { command: "x", args: [] } } }),
      ENTRY,
    );
    const result = JSON.parse(removeJsonMcpEntry(existing, "vovy") ?? "{}");
    expect(result.mcpServers.vovy).toBeUndefined();
    expect(result.mcpServers.other).toEqual({ command: "x", args: [] });
  });

  it("drops the mcpServers key entirely once it's empty", () => {
    const existing = mergeJsonMcpConfig(undefined, ENTRY);
    const result = JSON.parse(removeJsonMcpEntry(existing, "vovy") ?? "{}");
    expect(result.mcpServers).toBeUndefined();
  });
});
