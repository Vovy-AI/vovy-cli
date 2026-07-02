import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface ProjectAnalysis {
  root: string;
  hasPackageJson: boolean;
  name?: string;
  packageManager: "pnpm" | "yarn" | "bun" | "npm" | "unknown";
  isGitRepo: boolean;
  scripts: Record<string, string>;
  dependencies: string[];
  frameworks: string[];
  testRunner: string | null;
  topLevelDirs: string[];
  warnings: string[];
}

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
  vite: "Vite",
  "@remix-run/react": "Remix",
};

const TEST_RUNNER_SIGNALS: Record<string, string> = {
  vitest: "Vitest",
  jest: "Jest",
  mocha: "Mocha",
  ava: "AVA",
  "@playwright/test": "Playwright",
  cypress: "Cypress",
};

const IGNORED_TOP_LEVEL_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".turbo",
  ".next",
  "coverage",
  ".cache",
]);

function detectPackageManager(root: string): ProjectAnalysis["packageManager"] {
  if (existsSync(join(root, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(root, "bun.lockb")) || existsSync(join(root, "bun.lock"))) return "bun";
  if (existsSync(join(root, "yarn.lock"))) return "yarn";
  if (existsSync(join(root, "package-lock.json"))) return "npm";
  return "unknown";
}

function readTopLevelDirs(root: string): string[] {
  try {
    return readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !IGNORED_TOP_LEVEL_DIRS.has(entry.name))
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

function checkFootguns(root: string, isGitRepo: boolean): string[] {
  const warnings: string[] = [];
  const hasEnvFile = existsSync(join(root, ".env"));
  if (hasEnvFile && isGitRepo) {
    const gitignorePath = join(root, ".gitignore");
    const gitignoreContent = existsSync(gitignorePath) ? readFileSync(gitignorePath, "utf8") : "";
    const envIgnored = gitignoreContent
      .split(/\r?\n/)
      .map((line) => line.trim())
      .some((line) => line === ".env" || line === "*.env" || line === ".env*");
    if (!envIgnored) {
      warnings.push(
        "A .env file exists but is not covered by .gitignore — secrets in it could be committed to version control.",
      );
    }
  }
  return warnings;
}

/**
 * Pure static analysis — reads package.json and the top-level file tree, no LLM calls,
 * no network access, no guessing. This is the deterministic half of "auto-generate a
 * project-specific skill": Vovy supplies these facts for free, and the
 * `project-skill-drafter` skill instructs the host's own model to turn them into judgment.
 */
export function analyzeProject(root: string): ProjectAnalysis {
  const packageJsonPath = join(root, "package.json");
  const hasPackageJson = existsSync(packageJsonPath);
  const isGitRepo = existsSync(join(root, ".git"));

  let name: string | undefined;
  let scripts: Record<string, string> = {};
  let dependencies: string[] = [];

  if (hasPackageJson) {
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
      name = typeof pkg.name === "string" ? pkg.name : undefined;
      scripts = pkg.scripts && typeof pkg.scripts === "object" ? pkg.scripts : {};
      dependencies = [
        ...Object.keys(pkg.dependencies ?? {}),
        ...Object.keys(pkg.devDependencies ?? {}),
      ];
    } catch {
      // Malformed package.json — report what we can, don't throw.
    }
  }

  const frameworks = [
    ...new Set(
      dependencies.map((dep) => FRAMEWORK_SIGNALS[dep]).filter((f): f is string => Boolean(f)),
    ),
  ];
  const testRunner =
    dependencies.map((dep) => TEST_RUNNER_SIGNALS[dep]).find((t): t is string => Boolean(t)) ??
    null;

  return {
    root,
    hasPackageJson,
    name,
    packageManager: detectPackageManager(root),
    isGitRepo,
    scripts,
    dependencies,
    frameworks,
    testRunner,
    topLevelDirs: readTopLevelDirs(root),
    warnings: checkFootguns(root, isGitRepo),
  };
}
