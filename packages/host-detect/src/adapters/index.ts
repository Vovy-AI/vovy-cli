import type { HostAdapter } from "../types.js";
import { claudeCodeAdapter } from "./claude-code.js";
import { clineAdapter } from "./cline.js";
import { codexAdapter } from "./codex.js";
import { cursorAdapter } from "./cursor.js";
import { windsurfAdapter } from "./windsurf.js";

export { claudeCodeAdapter } from "./claude-code.js";
export { codexAdapter } from "./codex.js";
export { cursorAdapter } from "./cursor.js";
export { clineAdapter } from "./cline.js";
export { windsurfAdapter } from "./windsurf.js";

/** Every adapter Vovy ships, in the order they're listed in CLI output. */
export const ADAPTERS: HostAdapter[] = [
  claudeCodeAdapter,
  codexAdapter,
  cursorAdapter,
  clineAdapter,
  windsurfAdapter,
];

export function getAdapter(id: string): HostAdapter {
  const adapter = ADAPTERS.find((a) => a.id === id);
  if (!adapter) {
    throw new Error(
      `Unknown host id "${id}". Known hosts: ${ADAPTERS.map((a) => a.id).join(", ")}`,
    );
  }
  return adapter;
}
