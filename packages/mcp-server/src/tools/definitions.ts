import { z } from "zod";
import { analyzeProject } from "./analyze-project.js";
import { searchCodebase } from "./search-codebase.js";

export interface ToolContent {
  // Index signature matches the MCP SDK's own CallToolResult shape (it allows arbitrary
  // extra keys) — without it, TS won't accept this as a `registerTool` handler return type.
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
}

export interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, z.ZodTypeAny>;
  handler: (args: Record<string, unknown>) => Promise<ToolContent> | ToolContent;
}

function asJson(value: unknown): ToolContent {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

/**
 * Every tool Vovy's MCP server registers, in one place. `server.ts` loops over this to
 * call `registerTool`, and `@vovy-ai/go`'s `doctor` command reads the same
 * name/title/description triples to estimate the "always-on" token cost every registered
 * tool definition adds to a session, whether or not it's ever called — single source of
 * truth so the two can never drift apart.
 */
export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "analyze_project",
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
    handler: async ({ cwd }) =>
      asJson(analyzeProject((cwd as string | undefined) ?? process.cwd())),
  },
  {
    name: "search_codebase",
    title: "Search Codebase",
    description:
      'Deterministic, non-LLM symbol search over a JS/TS/JSX/TSX project via tree-sitter (no embeddings, no network access). Use this BEFORE reading whole files to answer a \'where is X handled\' / \'how does Y work\' question — it finds the exact symbol or file first so you read only what\'s relevant, not entire files. Actions: "overview" (top-level functions/classes/interfaces/exports in one file, needs filePath), "find_symbol" (declaration sites of a name across the project, needs query), "find_references" (identifier-boundary-aware usage sites of a name — more precise than grep since it never matches inside a string/comment, needs query), "pattern" (plain regex/text search fallback for non-code content, needs query).',
    inputSchema: {
      action: z
        .enum(["overview", "find_symbol", "find_references", "pattern"])
        .describe("Which search to run."),
      cwd: z
        .string()
        .optional()
        .describe("Absolute path to the project root. Defaults to the server's cwd."),
      filePath: z
        .string()
        .optional()
        .describe('Required for "overview" — absolute or cwd-relative path to one file.'),
      query: z
        .string()
        .optional()
        .describe(
          'Required for "find_symbol"/"find_references"/"pattern" — a symbol name, or a regex/literal string for "pattern".',
        ),
    },
    handler: async (args) =>
      asJson(
        await searchCodebase({
          action: args.action as "overview" | "find_symbol" | "find_references" | "pattern",
          cwd: args.cwd as string | undefined,
          filePath: args.filePath as string | undefined,
          query: args.query as string | undefined,
        }),
      ),
  },
];
