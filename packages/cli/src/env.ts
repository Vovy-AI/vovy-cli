import { homedir } from "node:os";
import type { DetectEnv } from "@vovy/host-detect";

/** The real machine's environment. Commands take a `DetectEnv` parameter so tests can
 * inject a throwaway one instead — nothing in this package reads `os.homedir()` directly
 * except this one function. */
export function realEnv(): DetectEnv {
  return { home: homedir(), cwd: process.cwd(), platform: process.platform };
}
