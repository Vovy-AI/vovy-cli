import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DetectEnv } from "@vovy-ai/host-detect";

/** A fresh, throwaway `DetectEnv` under `os.tmpdir()` — every CLI test must use this
 * instead of `realEnv()`, since these tests exercise the actual installer. */
export function tmpEnv(): { env: DetectEnv; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), "vovy-cli-test-"));
  const home = join(root, "home");
  const cwd = join(root, "project");
  return {
    env: { home, cwd, platform: process.platform },
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}
