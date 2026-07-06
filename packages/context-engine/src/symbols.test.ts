import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { findReferencingSymbols, findSymbol, getSymbolsOverview } from "./symbols.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = join(here, "..", "test", "fixtures", "sample-app");
const greeterFile = join(fixtureRoot, "greeter.ts");
const consumerFile = join(fixtureRoot, "consumer.ts");

describe("getSymbolsOverview", () => {
  it("extracts every top-level declaration with the right kind and exported flag", async () => {
    const symbols = await getSymbolsOverview(greeterFile);
    const byName = Object.fromEntries(symbols.map((s) => [s.name, s]));

    expect(byName.Greeting).toMatchObject({ kind: "interface", exported: true });
    expect(byName.buildGreeting).toMatchObject({ kind: "function", exported: true });
    expect(byName.Greeter).toMatchObject({ kind: "class", exported: true });
    expect(byName.DEFAULT_NAME).toMatchObject({ kind: "variable", exported: true });
    expect(byName.internalHelper).toMatchObject({ kind: "function", exported: false });
  });

  it("reports 1-based, sensible line ranges", async () => {
    const symbols = await getSymbolsOverview(greeterFile);
    const buildGreeting = symbols.find((s) => s.name === "buildGreeting");
    expect(buildGreeting?.startLine).toBe(5);
    expect(buildGreeting?.endLine).toBeGreaterThanOrEqual(buildGreeting?.startLine ?? 0);
  });

  it("returns an empty array for an unsupported or unreadable file, never throws", async () => {
    await expect(getSymbolsOverview(join(fixtureRoot, "notes.md"))).resolves.toEqual([]);
    await expect(getSymbolsOverview(join(fixtureRoot, "does-not-exist.ts"))).resolves.toEqual([]);
  });
});

describe("findSymbol", () => {
  it("finds a declaration by exact name across the whole fixture root", async () => {
    const results = await findSymbol("Greeter", fixtureRoot);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ kind: "class", file: greeterFile });
  });

  it("returns an empty array for a name that doesn't exist", async () => {
    await expect(findSymbol("DoesNotExist", fixtureRoot)).resolves.toEqual([]);
  });
});

describe("findReferencingSymbols", () => {
  it("finds usage sites but excludes the declaration site itself", async () => {
    const results = await findReferencingSymbols("buildGreeting", fixtureRoot);

    const declarationSite = results.find((r) => r.file === greeterFile && r.line === 5);
    expect(declarationSite).toBeUndefined();

    const usageInGreeter = results.find((r) => r.file === greeterFile && r.line === 11);
    expect(usageInGreeter).toBeDefined();

    const usageInConsumer = results.some((r) => r.file === consumerFile);
    expect(usageInConsumer).toBe(true);
  });

  it("only counts real identifier tokens, not text inside comments — unlike plain grep", async () => {
    // greeter.ts's internalHelper has a comment mentioning "buildGreeting" in prose
    // (line 19); a naive grep for "buildGreeting" would match it, tree-sitter must not,
    // since comment text never becomes an `identifier`/`type_identifier` node.
    const results = await findReferencingSymbols("buildGreeting", fixtureRoot);
    expect(results.some((r) => r.file === greeterFile && r.line === 19)).toBe(false);
  });
});
