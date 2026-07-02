import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { tmpEnv } from "../test-utils.js";
import { claudeCodeAdapter } from "./claude-code.js";

describe("claudeCodeAdapter", () => {
  let cleanup: () => void;
  afterEach(() => cleanup?.());

  it("does not detect when ~/.claude doesn't exist", () => {
    const t = tmpEnv();
    cleanup = t.cleanup;
    expect(claudeCodeAdapter.detect(t.env)).toBe(false);
  });

  it("detects when ~/.claude exists", () => {
    const t = tmpEnv();
    cleanup = t.cleanup;
    mkdirSync(join(t.env.home, ".claude"), { recursive: true });
    expect(claudeCodeAdapter.detect(t.env)).toBe(true);
  });

  it("resolves user-scope and project-scope skill paths to different, correct locations", () => {
    const t = tmpEnv();
    cleanup = t.cleanup;
    const userPath = claudeCodeAdapter.skillFilePath(t.env, "user", "prompt-rescoper");
    const projectPath = claudeCodeAdapter.skillFilePath(t.env, "project", "prompt-rescoper");
    expect(userPath).toBe(join(t.env.home, ".claude", "skills", "prompt-rescoper", "SKILL.md"));
    expect(projectPath).toBe(join(t.env.cwd, ".claude", "skills", "prompt-rescoper", "SKILL.md"));
  });
});
