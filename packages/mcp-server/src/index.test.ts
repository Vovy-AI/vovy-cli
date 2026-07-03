import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const distEntry = join(here, "..", "dist", "index.js");

/**
 * npm/npx never invoke a package's bin by its real path — they always go through a
 * symlink at node_modules/.bin/<name> (exactly how a host tool launches this server via
 * `npx -y @vovy-ai/mcp-server`). A naive `import.meta.url === file://${argv[1]}` "is this
 * the entry point" check breaks under that symlink, silently skipping main() — the
 * process would exit immediately without ever connecting the stdio transport, so the
 * server would be completely non-functional in every real installation despite all other
 * tests passing. This test reproduces the exact invocation shape and speaks real
 * MCP-over-stdio to catch that class of bug. See index.ts's isMainModule().
 */
describe("MCP server entry point via a symlinked bin (the real npx invocation shape)", () => {
  let cleanup: () => void;
  afterEach(() => cleanup?.());

  it("connects the stdio transport and answers a real initialize request", async () => {
    const dir = mkdtempSync(join(tmpdir(), "vovy-mcp-bin-symlink-"));
    cleanup = () => rmSync(dir, { recursive: true, force: true });
    const symlinkPath = join(dir, "vovy-mcp-server");
    symlinkSync(distEntry, symlinkPath);

    const child = spawn(process.execPath, [symlinkPath], { stdio: ["pipe", "pipe", "pipe"] });

    const responseLine = await new Promise<string>((resolve, reject) => {
      let buffered = "";
      const timer = setTimeout(() => {
        reject(new Error(`Timed out waiting for a response. stderr so far: ${stderr}`));
      }, 5000);
      let stderr = "";
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      child.stdout.on("data", (chunk) => {
        buffered += chunk.toString();
        const newlineIndex = buffered.indexOf("\n");
        if (newlineIndex !== -1) {
          clearTimeout(timer);
          resolve(buffered.slice(0, newlineIndex));
        }
      });
      child.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });

      const request = {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "vovy-symlink-test", version: "0.0.0" },
        },
      };
      child.stdin.write(`${JSON.stringify(request)}\n`);
    });

    child.kill();

    const response = JSON.parse(responseLine);
    expect(response.jsonrpc).toBe("2.0");
    expect(response.id).toBe(1);
    expect(response.result ?? response.error).toBeDefined();
  });
});
