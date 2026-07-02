#!/usr/bin/env node
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
// by tests or other packages.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("[vovy-mcp-server] fatal error:", error);
    process.exit(1);
  });
}
