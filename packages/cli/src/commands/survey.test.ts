import { afterEach, describe, expect, it, vi } from "vitest";
import { tmpEnv } from "../test-utils.js";
import { buildSurveyPayload, markSurveyOffered, sendSurvey, shouldOfferSurvey } from "./survey.js";

describe("shouldOfferSurvey", () => {
  let cleanup: () => void;
  afterEach(() => {
    cleanup?.();
    vi.unstubAllEnvs();
  });

  it("offers exactly once per machine", () => {
    const t = tmpEnv();
    cleanup = t.cleanup;
    vi.stubEnv("CI", "");
    vi.stubEnv("VOVY_NO_SURVEY", "");

    expect(shouldOfferSurvey(t.env, true)).toBe(true);
    markSurveyOffered(t.env);
    expect(shouldOfferSurvey(t.env, true)).toBe(false);
  });

  it("never offers without a TTY, in CI, or when explicitly suppressed", () => {
    const t = tmpEnv();
    cleanup = t.cleanup;
    vi.stubEnv("CI", "");
    vi.stubEnv("VOVY_NO_SURVEY", "");

    expect(shouldOfferSurvey(t.env, false)).toBe(false);

    vi.stubEnv("CI", "true");
    expect(shouldOfferSurvey(t.env, true)).toBe(false);
    vi.stubEnv("CI", "");

    vi.stubEnv("VOVY_NO_SURVEY", "1");
    expect(shouldOfferSurvey(t.env, true)).toBe(false);
  });
});

describe("buildSurveyPayload — the consent contract", () => {
  it("returns null when both questions were skipped — the zero-bytes path", () => {
    expect(buildSurveyPayload({}, "0.3.1")).toBeNull();
  });

  it("sends only what was answered, plus the CLI version and nothing else", () => {
    expect(buildSurveyPayload({ rating: 4 }, "0.3.1")).toEqual({
      cli_version: "0.3.1",
      rating: 4,
    });
    const full = buildSurveyPayload(
      { source: "other", sourceOther: "a podcast", rating: 5 },
      "0.3.1",
    );
    expect(full).toEqual({
      cli_version: "0.3.1",
      source: "other",
      source_other: "a podcast",
      rating: 5,
    });
    // The payload shape is closed: exactly these keys, no machine or project info.
    expect(Object.keys(full ?? {}).sort()).toEqual([
      "cli_version",
      "rating",
      "source",
      "source_other",
    ]);
  });

  it("drops free-text detail unless source is 'other', and caps lengths", () => {
    expect(buildSurveyPayload({ source: "github", sourceOther: "sneaky" }, "0.3.1")).toEqual({
      cli_version: "0.3.1",
      source: "github",
    });
    const capped = buildSurveyPayload(
      { source: "other", sourceOther: "x".repeat(500) },
      "y".repeat(99),
    );
    expect(capped?.source_other).toHaveLength(120);
    expect(capped?.cli_version).toHaveLength(20);
  });
});

describe("sendSurvey", () => {
  it("swallows network failure — a survey must never break an install", async () => {
    const ok = await sendSurvey(
      { cli_version: "0.0.0-test", rating: 5 },
      "http://127.0.0.1:1/unreachable",
    );
    expect(ok).toBe(false);
  });
});
