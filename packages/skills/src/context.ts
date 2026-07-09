import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Framework signals, deliberately duplicated from `@vovy-ai/mcp-server`'s
 * `analyze-project.ts` rather than imported. This package has zero runtime dependencies by
 * design — both `@vovy-ai/go` and `@vovy-ai/mcp-server` depend on it, so it cannot depend
 * on either without a cycle. Same reasoning as `@vovy-ai/context-engine`'s duplicated
 * ignore-directory set.
 */
const FRAMEWORK_SIGNALS: Record<string, string> = {
  next: "Next.js",
  react: "React",
  "react-dom": "React",
  vue: "Vue",
  nuxt: "Nuxt",
  svelte: "Svelte",
  "@sveltejs/kit": "SvelteKit",
  astro: "Astro",
  express: "Express",
  fastify: "Fastify",
  "@nestjs/core": "NestJS",
  "react-native": "React Native",
  "@remix-run/react": "Remix",
};

export type ProjectLanguage = "TypeScript" | "JavaScript" | "unknown";

export interface ProjectContext {
  language: ProjectLanguage;
  /** Deduplicated, in the order the signals above declare them. */
  frameworks: string[];
  /** Human-readable stack, e.g. `"Next.js + React + TypeScript"`. */
  stack: string;
}

/** What a skill description says when Vovy has no idea what the project is — the same
 * wording the descriptions carried before they were made context-aware, so nothing gets
 * worse for an unrecognized project. */
const UNKNOWN_STACK = "JS/TS/JSX/TSX";

function detectLanguage(root: string, dependencies: string[]): ProjectLanguage {
  if (existsSync(join(root, "tsconfig.json")) || dependencies.includes("typescript")) {
    return "TypeScript";
  }
  return existsSync(join(root, "package.json")) ? "JavaScript" : "unknown";
}

/**
 * Deterministic, no-network, no-LLM read of what kind of project `root` is — the same
 * ethos as `analyze_project`, scoped to the one question a skill description needs
 * answered: what should this project be *called*.
 */
export function detectProjectContext(root: string): ProjectContext {
  let dependencies: string[] = [];
  const packageJsonPath = join(root, "package.json");

  if (existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
      dependencies = [
        ...Object.keys(pkg.dependencies ?? {}),
        ...Object.keys(pkg.devDependencies ?? {}),
      ];
    } catch {
      // Malformed package.json — fall through to the unknown stack rather than throw.
    }
  }

  const language = detectLanguage(root, dependencies);
  const frameworks = [
    ...new Set(
      dependencies.map((dep) => FRAMEWORK_SIGNALS[dep]).filter((f): f is string => Boolean(f)),
    ),
  ];

  const parts = [...frameworks];
  if (language !== "unknown") parts.push(language);
  const stack = parts.length > 0 ? parts.join(" + ") : UNKNOWN_STACK;

  return { language, frameworks, stack };
}

export const UNKNOWN_PROJECT_STACK = UNKNOWN_STACK;
