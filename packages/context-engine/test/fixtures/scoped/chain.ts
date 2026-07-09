import { run } from "./other.js";

/** Calls `run`, which calls `alpha.probe` — the second hop of the impact chain. */
export function outer(): number {
  return run();
}

// A top-level usage: `impact` must attribute this to "<module>", not invent a caller.
outer();
