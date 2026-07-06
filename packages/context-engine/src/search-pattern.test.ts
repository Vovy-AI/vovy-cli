import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { searchPattern } from "./search-pattern.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = join(here, "..", "test", "fixtures", "sample-app");

describe("searchPattern", () => {
  it("matches a plain substring in prose content outside the tree-sitter-supported extensions", () => {
    const results = searchPattern("fixture exists", fixtureRoot);
    expect(results.some((m) => m.file.endsWith("notes.md"))).toBe(true);
  });

  it("supports valid regex queries", () => {
    const results = searchPattern("export (function|class)", fixtureRoot);
    expect(results.some((m) => m.text.includes("export function buildGreeting"))).toBe(true);
    expect(results.some((m) => m.text.includes("export class Greeter"))).toBe(true);
  });

  it("falls back to a literal substring match when the query isn't valid regex", () => {
    // Unbalanced paren — invalid as a regex, must not throw, must still find the literal text.
    const results = searchPattern("buildGreeting(", fixtureRoot);
    expect(results.length).toBeGreaterThan(0);
  });

  it("returns an empty array for a query that matches nothing", () => {
    expect(searchPattern("definitely-not-in-this-fixture", fixtureRoot)).toEqual([]);
  });
});
