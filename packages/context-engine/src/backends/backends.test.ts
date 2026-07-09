import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadTypeScript } from "./load-typescript.js";
import { createTreeSitterBackend } from "./tree-sitter.js";
import type { SymbolBackend } from "./types.js";
import { createTypeScriptBackend } from "./typescript.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = join(here, "..", "..", "test", "fixtures", "scoped");
const shapesFile = join(fixtureRoot, "shapes.ts");
const otherFile = join(fixtureRoot, "other.ts");

const ts = await loadTypeScript(fixtureRoot);
if (!ts) throw new Error("TypeScript must resolve for these tests — it is a devDependency.");

const typescriptBackend = createTypeScriptBackend(ts, fixtureRoot);
const treeSitterBackend = createTreeSitterBackend(fixtureRoot);

const backends: Array<[string, SymbolBackend]> = [
  ["typescript", typescriptBackend],
  ["tree-sitter", treeSitterBackend],
];

describe.each(backends)("%s backend — recall", (_name, backend) => {
  it("reports methods declared on an object literal, not just the variable holding it", async () => {
    const symbols = await backend.overview(shapesFile);
    const probe = symbols.find((s) => s.name === "probe" && s.container === "alpha");

    expect(probe).toBeDefined();
    expect(probe?.kind).toBe("method");
  });

  it("reports class methods with their containing class", async () => {
    const symbols = await backend.overview(shapesFile);
    expect(symbols.find((s) => s.name === "open")).toMatchObject({
      kind: "method",
      container: "Box",
    });
  });

  it("reports interface members", async () => {
    const symbols = await backend.overview(shapesFile);
    expect(symbols.find((s) => s.name === "label" && s.container === "Adapter")).toBeDefined();
  });

  it("finds usages of a method name — never a silent empty array", async () => {
    const references = await backend.findReferences("probe");
    expect(references.length).toBeGreaterThan(0);
    expect(references.some((r) => r.file === otherFile)).toBe(true);
  });

  it("never lists a function body's locals as symbols of the file", async () => {
    // `run()` declares `localOnly`. Listing body locals made `overview` of one real file
    // cost more estimated tokens than reading the whole file — caught by
    // scripts/eval-context-engine, which scored that query at -14%.
    const symbols = await backend.overview(otherFile);
    expect(symbols.map((s) => s.name)).not.toContain("localOnly");
    expect(symbols.every((s) => s.container !== "run")).toBe(true);
  });
});

describe.each(backends)("%s backend — impact", (_name, backend) => {
  it("walks the reverse call chain transitively, depth-tagged", async () => {
    // probe <- run() in other.ts (depth 1) <- outer() in chain.ts (depth 2).
    const nodes = await backend.impact("probe", 3);

    const direct = nodes.find((n) => n.symbol === "run");
    expect(direct).toMatchObject({ depth: 1, file: otherFile });

    const transitive = nodes.find((n) => n.symbol === "outer");
    expect(transitive?.depth).toBe(2);
  });

  it("attributes a top-level usage to <module> instead of inventing a caller", async () => {
    // chain.ts calls outer() at top level — depth 3 from probe.
    const nodes = await backend.impact("probe", 3);
    const topLevel = nodes.find((n) => n.depth === 3);
    expect(topLevel?.symbol).toBe("<module>");
  });

  it("respects maxDepth as a hard stop", async () => {
    const nodes = await backend.impact("probe", 1);
    expect(nodes.length).toBeGreaterThan(0);
    expect(nodes.every((n) => n.depth === 1)).toBe(true);
  });

  it("walks through an object-literal property instead of dead-ending at <module>", async () => {
    // `helpers = { compute: tally }` — the usage of tally sits inside a property
    // assignment, not a function. The walk must name `compute` and continue from it.
    const nodes = await backend.impact("tally", 2);
    expect(nodes.find((n) => n.symbol === "compute")).toMatchObject({ depth: 1 });
  });
});

describe("typescript backend — precision", () => {
  it("distinguishes two same-named symbols declared in different scopes", async () => {
    const declarations = await typescriptBackend.findSymbol("estimate");
    expect(declarations).toHaveLength(2);
    expect(declarations.map((d) => d.file).sort()).toEqual([otherFile, shapesFile].sort());
  });

  it("attributes a usage to the declaration it actually resolves to", async () => {
    const references = await typescriptBackend.findReferences("estimate");

    // `other.ts` calls its own local `estimate`, never the one exported from `shapes.ts`.
    expect(references).toHaveLength(1);
    expect(references[0]?.file).toBe(otherFile);
    expect(references[0]?.declaration?.file).toBe(otherFile);
  });

  it("excludes declaration sites written as a property assignment, not only as a method", async () => {
    // `beta`'s `probe: () => false` is a declaration, not a usage of `Adapter.probe`.
    const references = await typescriptBackend.findReferences("probe");
    expect(references.every((r) => r.line !== 14)).toBe(true);
  });
});

describe("tree-sitter backend — documented limits", () => {
  it("cannot attribute a usage to a declaration", async () => {
    const references = await treeSitterBackend.findReferences("estimate");
    expect(references.length).toBeGreaterThan(0);
    expect(references.every((r) => r.declaration === undefined)).toBe(true);
  });

  it("matches identifier tokens only, never text inside a comment", async () => {
    // shapes.ts mentions `estimate` in a doc comment above the declaration.
    const references = await treeSitterBackend.findReferences("estimate");
    expect(references.some((r) => r.file === shapesFile)).toBe(false);
  });
});

describe("backend kinds", () => {
  it("reports which engine answered, so a name match is never read as a proven one", () => {
    expect(typescriptBackend.kind).toBe("typescript");
    expect(treeSitterBackend.kind).toBe("tree-sitter");
  });
});
