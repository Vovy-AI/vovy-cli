import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { SKILL_MANIFEST } from "@vovy-ai/skills";
import { beforeEach, describe, expect, it } from "vitest";
import { createServer } from "./server.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = join(here, "..", "test", "fixtures", "sample-next-app");

async function connectedClient() {
  const server = createServer();
  const client = new Client({ name: "vovy-test-client", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

describe("Vovy MCP server", () => {
  let client: Awaited<ReturnType<typeof connectedClient>>;

  beforeEach(async () => {
    client = await connectedClient();
  });

  it("lists every tool in TOOL_DEFINITIONS", async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    expect(names).toContain("analyze_project");
    expect(names).toContain("search_codebase");
  });

  it("exposes every manifest skill as both a prompt and a skill:// resource", async () => {
    const { prompts } = await client.listPrompts();
    const { resources } = await client.listResources();
    for (const skill of SKILL_MANIFEST) {
      expect(prompts.some((p) => p.name === skill.id)).toBe(true);
      expect(resources.some((r) => r.uri === `skill://${skill.id}`)).toBe(true);
    }
  });

  it("runs analyze_project against a fixture repo and returns structured JSON with no LLM involved", async () => {
    const result = await client.callTool({
      name: "analyze_project",
      arguments: { cwd: fixtureRoot },
    });
    const content = result.content as Array<{ type: string; text: string }>;
    const analysis = JSON.parse(content[0]?.text ?? "{}");
    expect(analysis.name).toBe("sample-next-app");
    expect(analysis.frameworks).toContain("Next.js");
  });

  it("returns a skill's raw SKILL.md content via its resource URI", async () => {
    const first = SKILL_MANIFEST[0];
    if (!first) throw new Error("expected at least one skill in the manifest");
    const result = await client.readResource({ uri: `skill://${first.id}` });
    const [content] = result.contents;
    if (!content || !("text" in content)) throw new Error("expected a text resource content");
    expect(content.text).toContain("---");
    expect(content.text).toContain(`name: ${first.id}`);
  });
});
