import { z } from "zod";
import { analyzeProject } from "./analyze-project.js";
import { projectMemory } from "./project-memory.js";
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
      'Deterministic, non-LLM symbol search over a JS/TS/JSX/TSX project (no embeddings, no network access). Use this BEFORE reading whole files to answer a \'where is X handled\' / \'what calls Y\' / \'is it safe to change Z\' question — it finds the exact symbol, method, or file first, so you read one function instead of one whole file. Covers class methods, interface members, and object-literal methods, not just top-level declarations. Actions: "overview" (declarations and their members in one file, needs filePath), "find_symbol" (declaration sites of a name across the project, needs query), "find_references" (usage sites of a name, excluding declarations, needs query), "impact" (transitive blast radius: who references this symbol, who references THOSE callers, and so on, depth-tagged — the \'what breaks if I change this\' answer; needs query, optional maxDepth default 3), "pattern" (plain regex/text search fallback for non-code content, needs query). Every response names the `backend` that answered: "typescript" means results were resolved through the real type checker and each reference carries the declaration it resolves to; "tree-sitter" means results are identifier-name matches (never inside a string or comment, unlike grep) that cannot distinguish two same-named symbols in different scopes — treat those as candidates, not proof, and treat "impact" tails as over-approximate.',
    inputSchema: {
      action: z
        .enum(["overview", "find_symbol", "find_references", "impact", "pattern"])
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
          'Required for "find_symbol"/"find_references"/"impact"/"pattern" — a symbol name, or a regex/literal string for "pattern".',
        ),
      maxDepth: z
        .number()
        .int()
        .min(1)
        .max(10)
        .optional()
        .describe('For "impact" — how many caller hops to walk outward. Defaults to 3.'),
    },
    handler: async (args) =>
      asJson(
        await searchCodebase({
          action: args.action as
            | "overview"
            | "find_symbol"
            | "find_references"
            | "impact"
            | "pattern",
          cwd: args.cwd as string | undefined,
          filePath: args.filePath as string | undefined,
          query: args.query as string | undefined,
          maxDepth: args.maxDepth as number | undefined,
        }),
      ),
  },
  {
    name: "project_memory",
    title: "Project Memory",
    description:
      'Records and recalls this project\'s decisions, mistakes, and constraints as plain markdown under .vovy/memory/, committed to git — so rationale survives across sessions, tools, and teammates with no server or account. Actions: "record" (save an entry; needs type: "decision" | "mistake" | "constraint", title, body — for decisions include what was REJECTED and why, for mistakes include why it happened and how to avoid it, for constraints include the why behind the rule), "recall" (deterministic keyword search over saved entries; needs query — use BEFORE starting non-trivial work and before revisiting any past choice), "list" (every entry\'s title and type, no bodies). Never pass secrets, API keys, or passwords in a body — entries are committed to git, and record refuses content that looks like a credential.',
    inputSchema: {
      action: z.enum(["record", "recall", "list"]).describe("Which memory operation to run."),
      cwd: z
        .string()
        .optional()
        .describe("Absolute path to the project root. Defaults to the server's cwd."),
      type: z
        .enum(["decision", "mistake", "constraint"])
        .optional()
        .describe('Required for "record" — what kind of entry this is.'),
      title: z
        .string()
        .optional()
        .describe('Required for "record" — short, stable name; re-recording it updates in place.'),
      body: z
        .string()
        .optional()
        .describe(
          'Required for "record" — markdown. Decisions: what was chosen AND what was rejected and why. Mistakes: why it happened and how to avoid it. Constraints: the why behind the rule.',
        ),
      tags: z.array(z.string()).optional().describe('For "record" — optional recall keywords.'),
      query: z
        .string()
        .optional()
        .describe('Required for "recall" — what you are about to work on.'),
    },
    handler: async (args) =>
      asJson(
        await projectMemory({
          action: args.action as "record" | "recall" | "list",
          cwd: args.cwd as string | undefined,
          type: args.type as string | undefined,
          title: args.title as string | undefined,
          body: args.body as string | undefined,
          tags: args.tags as string[] | undefined,
          query: args.query as string | undefined,
        }),
      ),
  },
];
