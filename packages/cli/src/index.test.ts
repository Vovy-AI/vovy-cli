import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const distEntry = join(here, "..", "dist", "index.js");

/**
 * npm/npx never invoke a package's bin by its real path — they always go through a
 * symlink at node_modules/.bin/<name>. A naive `import.meta.url === file://${argv[1]}`
 * "is this the entry point" check breaks under that symlink (import.meta.url resolves
 * through it, argv[1] doesn't), silently skipping main() for every real install. This
 * test reproduces that exact invocation shape so a regression here fails loudly instead
 * of only surfacing in production. See index.ts's isMainModule().
 */
describe("CLI entry point via a symlinked bin (the real npm/npx invocation shape)", () => {
  let cleanup: () => void;
  afterEach(() => cleanup?.());

  it("prints help output when invoked through a symlink, not the real path", () => {
    const dir = mkdtempSync(join(tmpdir(), "vovy-bin-symlink-"));
    cleanup = () => rmSync(dir, { recursive: true, force: true });
    const symlinkPath = join(dir, "vovy");
    symlinkSync(distEntry, symlinkPath);

    const result = spawnSync(process.execPath, [symlinkPath, "--help"], { encoding: "utf8" });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Vovy —");
    expect(result.stdout).toContain("npx @vovy-ai/go install");
  });
});
