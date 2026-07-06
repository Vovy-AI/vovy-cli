import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getAllSkills } from "@vovy-ai/skills";
import { TOOL_DEFINITIONS } from "./tools/definitions.js";

export const SERVER_NAME = "vovy";
export const SERVER_VERSION = "0.1.0";

/**
 * Builds the Vovy MCP server: every tool in `TOOL_DEFINITIONS` (all deterministic, no LLM
 * calls — see tools/definitions.ts), plus every skill in @vovy-ai/skills exposed twice
 * more — as an MCP prompt and as an MCP resource (`skill://<id>`) — so hosts with good
 * MCP-prompt/resource UX get the same content Vovy's CLI installer already wrote directly
 * into the host's native skill directory. This is a redundant, secondary discovery path;
 * nothing depends on it working.
 */
export function createServer(): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  for (const tool of TOOL_DEFINITIONS) {
    server.registerTool(
      tool.name,
      { title: tool.title, description: tool.description, inputSchema: tool.inputSchema },
      tool.handler,
    );
  }

  for (const skill of getAllSkills()) {
    server.registerPrompt(
      skill.id,
      {
        title: skill.title,
        description: skill.description,
      },
      async () => ({
        messages: [
          {
            role: "user",
            content: { type: "text", text: skill.body },
          },
        ],
      }),
    );

    server.registerResource(
      skill.id,
      `skill://${skill.id}`,
      {
        title: skill.title,
        description: skill.summary,
        mimeType: "text/markdown",
      },
      async (uri) => ({
        contents: [{ uri: uri.href, text: skill.raw, mimeType: "text/markdown" }],
      }),
    );
  }

  return server;
}
