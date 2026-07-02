import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { analyzeProject } from "./analyze-project.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = join(here, "..", "..", "test", "fixtures", "sample-next-app");

describe("analyzeProject", () => {
  it("detects the framework, package manager, and test runner from the fixture app", () => {
    const result = analyzeProject(fixtureRoot);
    expect(result.hasPackageJson).toBe(true);
    expect(result.name).toBe("sample-next-app");
    expect(result.frameworks).toContain("Next.js");
    expect(result.frameworks).toContain("React");
    expect(result.packageManager).toBe("pnpm");
    expect(result.testRunner).toBe("Vitest");
    expect(result.topLevelDirs).toContain("app");
  });

  it("never throws on a directory with no package.json", () => {
    const result = analyzeProject(here);
    expect(result.hasPackageJson).toBe(false);
    expect(result.frameworks).toEqual([]);
    expect(result.warnings).toEqual([]);
  });
});
