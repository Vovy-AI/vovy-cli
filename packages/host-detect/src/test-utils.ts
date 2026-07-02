import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DetectEnv } from "./types.js";

/** A fresh, throwaway `DetectEnv` under `os.tmpdir()` — never the real `$HOME`. Every
 * host-detect/cli test that writes files must use this instead of `realEnv()`. */
export function tmpEnv(): { env: DetectEnv; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), "vovy-test-"));
  const home = join(root, "home");
  const cwd = join(root, "project");
  return {
    env: { home, cwd, platform: process.platform },
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}
