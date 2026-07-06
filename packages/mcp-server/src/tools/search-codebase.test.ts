import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { searchCodebase } from "./search-codebase.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = join(here, "..", "..", "test", "fixtures", "sample-next-app");
const pageFile = join(fixtureRoot, "app", "page.tsx");

describe("searchCodebase", () => {
  it("overview: lists top-level symbols in one file", async () => {
    const result = (await searchCodebase({ action: "overview", filePath: pageFile })) as Array<{
      name: string;
    }>;
    expect(result.some((s) => s.name === "Page")).toBe(true);
  });

  it("find_symbol: finds a declaration by name across the project root", async () => {
    const result = (await searchCodebase({
      action: "find_symbol",
      cwd: fixtureRoot,
      query: "Page",
    })) as Array<{ file: string }>;
    expect(result.some((s) => s.file === pageFile)).toBe(true);
  });

  it("pattern: falls back to plain text search", async () => {
    const result = (await searchCodebase({
      action: "pattern",
      cwd: fixtureRoot,
      query: "hello from the fixture app",
    })) as Array<{ file: string }>;
    expect(result.some((m) => m.file === pageFile)).toBe(true);
  });

  it("throws a clear error when a required argument is missing, rather than guessing", async () => {
    await expect(searchCodebase({ action: "overview" })).rejects.toThrow(/filePath/);
    await expect(searchCodebase({ action: "find_symbol" })).rejects.toThrow(/query/);
  });
});
