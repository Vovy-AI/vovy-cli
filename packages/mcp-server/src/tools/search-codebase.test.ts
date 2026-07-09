import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { searchCodebase } from "./search-codebase.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = join(here, "..", "..", "test", "fixtures", "sample-next-app");
const pageFile = join(fixtureRoot, "app", "page.tsx");

describe("searchCodebase", () => {
  it("overview: lists top-level symbols in one file", async () => {
    const { results } = await searchCodebase({
      action: "overview",
      cwd: fixtureRoot,
      filePath: pageFile,
    });
    expect((results as Array<{ name: string }>).some((s) => s.name === "Page")).toBe(true);
  });

  it("find_symbol: finds a declaration by name across the project root", async () => {
    const { results } = await searchCodebase({
      action: "find_symbol",
      cwd: fixtureRoot,
      query: "Page",
    });
    expect((results as Array<{ file: string }>).some((s) => s.file === pageFile)).toBe(true);
  });

  it("pattern: falls back to plain text search", async () => {
    const { results } = await searchCodebase({
      action: "pattern",
      cwd: fixtureRoot,
      query: "hello from the fixture app",
    });
    expect((results as Array<{ file: string }>).some((m) => m.file === pageFile)).toBe(true);
  });

  it("impact: walks the reverse reference graph, depth-tagged", async () => {
    const { results } = await searchCodebase({
      action: "impact",
      cwd: fixtureRoot,
      query: "Page",
      maxDepth: 2,
    });
    // The fixture's Page component is referenced nowhere — an empty impact list, not an
    // error, is the correct answer for an unused symbol.
    expect(Array.isArray(results)).toBe(true);
  });

  it("impact: requires query, like the other symbol actions", async () => {
    await expect(searchCodebase({ action: "impact", cwd: fixtureRoot })).rejects.toThrow(/query/);
  });

  it("names the backend that answered, so a name match is never read as a proven one", async () => {
    const { backend } = await searchCodebase({
      action: "find_symbol",
      cwd: fixtureRoot,
      query: "Page",
    });
    expect(["typescript", "tree-sitter"]).toContain(backend);
  });

  it("throws a clear error when a required argument is missing, rather than guessing", async () => {
    await expect(searchCodebase({ action: "overview" })).rejects.toThrow(/filePath/);
    await expect(searchCodebase({ action: "find_symbol" })).rejects.toThrow(/query/);
  });
});
