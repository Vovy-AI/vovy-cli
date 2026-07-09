import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { tmpEnv } from "../test-utils.js";
import { buildStatusline } from "./statusline.js";

describe("buildStatusline", () => {
  let cleanup: () => void;
  afterEach(() => cleanup?.());

  it("says not installed when no host is detected, and stays one line", () => {
    const t = tmpEnv();
    cleanup = t.cleanup;
    mkdirSync(t.env.cwd, { recursive: true });

    const line = buildStatusline(t.env);
    expect(line).toContain("[vovy] not installed");
    expect(line).toContain("engine:");
    expect(line).not.toContain("\n");
  });

  it("counts committed memory entries when .vovy/memory exists", () => {
    const t = tmpEnv();
    cleanup = t.cleanup;
    const decisions = join(t.env.cwd, ".vovy", "memory", "decisions");
    mkdirSync(decisions, { recursive: true });
    writeFileSync(join(decisions, "a.md"), "---\ntype: decision\ntitle: a\n---\nbody");
    writeFileSync(join(decisions, "b.md"), "---\ntype: decision\ntitle: b\n---\nbody");

    expect(buildStatusline(t.env)).toContain("memory:2");
  });

  it("omits the memory segment entirely for a project with no memory", () => {
    const t = tmpEnv();
    cleanup = t.cleanup;
    mkdirSync(t.env.cwd, { recursive: true });

    expect(buildStatusline(t.env)).not.toContain("memory:");
  });
});
