import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getAllSkills } from "@vovy/skills";
import { z } from "zod";
import { analyzeProject } from "./tools/analyze-project.js";

export const SERVER_NAME = "vovy";
export const SERVER_VERSION = "0.1.0";

/**
 * Builds the Vovy MCP server: one deterministic tool (`analyze_project`, no LLM calls),
 * plus every skill in @vovy/skills exposed twice more — as an MCP prompt and as an MCP
 * resource (`skill://<id>`) — so hosts with good MCP-prompt/resource UX get the same
 * content Vovy's CLI installer already wrote directly into the host's native skill
 * directory. This is a redundant, secondary discovery path; nothing depends on it working.
 */
export function createServer(): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  server.registerTool(
    "analyze_project",
    {
      title: "Analyze Project",
      description:
        "Deterministic, non-LLM static analysis of a project: detected framework/stack, package manager, test runner, top-level directories, and any obvious security footguns (e.g. an untracked .env). No network access, no guessing.",
      inputSchema: {
        cwd: z
          .string()
          .optional()
          .describe(
            "Absolute path to the project root. Defaults to the server's current working directory.",
          ),
      },
    },
    async ({ cwd }) => {
      const analysis = analyzeProject(cwd ?? process.cwd());
      return {
        content: [{ type: "text", text: JSON.stringify(analysis, null, 2) }],
      };
    },
  );

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
