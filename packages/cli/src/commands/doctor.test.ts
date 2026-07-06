import { SKILL_MANIFEST } from "@vovy-ai/skills";
import { afterEach, describe, expect, it } from "vitest";
import { tmpEnv } from "../test-utils.js";
import { estimateTokens, runDoctor } from "./doctor.js";

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
