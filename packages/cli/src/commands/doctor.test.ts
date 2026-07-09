import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { TOOL_DEFINITIONS } from "@vovy-ai/mcp-server";
import { SKILL_MANIFEST } from "@vovy-ai/skills";
import { afterEach, describe, expect, it, vi } from "vitest";
import { tmpEnv } from "../test-utils.js";
import { MCP_TOOL_METADATA, estimateTokens, probeContextBackend, runDoctor } from "./doctor.js";

describe("MCP_TOOL_METADATA mirror", () => {
  it("stays byte-identical to @vovy-ai/mcp-server's TOOL_DEFINITIONS", () => {
    // The mirror exists so `npx @vovy-ai/go` never pays the MCP SDK's install weight at
    // runtime; this test (dev-only workspace dependency) is what keeps the copy honest.
    // It drifted twice during Phase 2 development before this existed.
    const shipped = TOOL_DEFINITIONS.map(({ name, title, description }) => ({
      name,
      title,
      description,
    }));
    expect(MCP_TOOL_METADATA).toEqual(shipped);
  });
});

describe("estimateTokens", () => {
  it("is a deterministic chars/4 estimate, not an exact tokenizer", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
  });
});

describe("runDoctor token footprint", () => {
  let cleanup: () => void;
  afterEach(() => cleanup?.());

  it("reports a deterministic, non-zero always-on footprint covering every shipped skill", () => {
    const t = tmpEnv();
    cleanup = t.cleanup;

    const first = runDoctor(t.env, ["claude-code"], "user");
    const second = runDoctor(t.env, ["claude-code"], "user");

    expect(first.tokenFootprint.skillCount).toBe(SKILL_MANIFEST.length);
    expect(first.tokenFootprint.toolCount).toBeGreaterThan(0);
    expect(first.tokenFootprint.totalEstTokens).toBe(
      first.tokenFootprint.skillsEstTokens + first.tokenFootprint.toolsEstTokens,
    );
    expect(first.tokenFootprint.totalEstTokens).toBeGreaterThan(0);
    // Deterministic given fixed input — same repo state, same estimate every time.
    expect(second.tokenFootprint).toEqual(first.tokenFootprint);
  });
});

describe("probeContextBackend", () => {
  let cleanup: () => void;
  afterEach(() => cleanup?.());

  it("reports tree-sitter with an upgrade hint when the project has no typescript", () => {
    const t = tmpEnv();
    cleanup = t.cleanup;
    mkdirSync(t.env.cwd, { recursive: true });
    writeFileSync(join(t.env.cwd, "package.json"), JSON.stringify({ name: "no-ts" }));

    const probe = probeContextBackend(t.env.cwd);
    expect(probe.backend).toBe("tree-sitter");
    expect(probe.reason).toContain("typescript");
  });

  it("reports typescript when the project's own node_modules resolves it", () => {
    const t = tmpEnv();
    cleanup = t.cleanup;
    mkdirSync(join(t.env.cwd, "node_modules"), { recursive: true });
    writeFileSync(join(t.env.cwd, "package.json"), JSON.stringify({ name: "has-ts" }));
    // Symlink the real typescript package into the throwaway project — same shape a
    // package manager produces, no copy of an 8 MB dependency into every test run.
    const realTs = dirname(createRequire(import.meta.url).resolve("typescript/package.json"));
    symlinkSync(realTs, join(t.env.cwd, "node_modules", "typescript"), "dir");

    const probe = probeContextBackend(t.env.cwd);
    expect(probe.backend).toBe("typescript");
  });

  it("honors the VOVY_CONTEXT_BACKEND escape hatch, and says it did", () => {
    const t = tmpEnv();
    cleanup = t.cleanup;
    // vi.stubEnv, not `process.env.X = ...` — assignment coerces undefined to the string
    // "undefined" on restore, and the `delete` operator trips lint/performance/noDelete.
    vi.stubEnv("VOVY_CONTEXT_BACKEND", "tree-sitter");
    try {
      const probe = probeContextBackend(t.env.cwd);
      expect(probe.backend).toBe("tree-sitter");
      expect(probe.reason).toContain("VOVY_CONTEXT_BACKEND");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
