#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

export { createServer, SERVER_NAME, SERVER_VERSION } from "./server.js";
export { analyzeProject } from "./tools/analyze-project.js";
export type { ProjectAnalysis } from "./tools/analyze-project.js";

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Only auto-start when run directly (as the host-launched subprocess), not when imported
// by tests or other packages. npm/npx always launch a bin through a symlink
// (node_modules/.bin/<name>) — import.meta.url resolves through it to the real path while
// process.argv[1] stays as the symlink path, so a plain string comparison never matches.
// Resolve both to their real path before comparing.
function isMainModule(): boolean {
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1] ?? "");
  } catch {
    return false;
  }
}

if (isMainModule()) {
  main().catch((error) => {
    console.error("[vovy-mcp-server] fatal error:", error);
    process.exit(1);
  });
}
