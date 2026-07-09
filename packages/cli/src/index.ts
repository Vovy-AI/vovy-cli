#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { ADAPTERS, type SkillScope } from "@vovy-ai/host-detect";
import { runDoctor } from "./commands/doctor.js";
import { runInstall } from "./commands/install.js";
import { buildStatusline } from "./commands/statusline.js";
import { runUninstall } from "./commands/uninstall.js";
import { realEnv } from "./env.js";

const HELP = `Vovy — free, forever, drop-in skills for vibe coding safely. Run via \`npx @vovy-ai/go\` (or \`vovy\` if installed globally).

Usage:
  npx @vovy-ai/go install [options]     Write Vovy's skills into detected (or specified) host tools
  npx @vovy-ai/go doctor [options]      Check whether Vovy is correctly installed, without changing anything
  npx @vovy-ai/go uninstall [options]   Remove everything Vovy's installer wrote
  npx @vovy-ai/go statusline            One-line status for a host's status bar (engine, skills, memory)

Options:
  --host <ids>       Comma-separated host ids to target instead of auto-detecting.
                      Known hosts: ${ADAPTERS.map((a) => a.id).join(", ")}
  --scope <scope>    "user" (default, applies everywhere) or "project" (this directory only)
  --dry-run          Show what would change without writing anything
  --help             Show this message

Vovy never runs its own AI model and never calls a Vovy-hosted server — it only writes
markdown skill files that your existing AI coding tool reads for free with the model you
already pay for. No account, no API key, no cost, ever.`;

function parseCommonFlags(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      host: { type: "string" },
      scope: { type: "string" },
      "dry-run": { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  const scope = values.scope as SkillScope | undefined;
  if (scope && scope !== "user" && scope !== "project") {
    throw new Error(`Invalid --scope "${scope}" — expected "user" or "project".`);
  }

  return {
    hosts: values.host ? values.host.split(",").map((h) => h.trim()) : undefined,
    scope,
    dryRun: Boolean(values["dry-run"]),
    help: Boolean(values.help),
  };
}

function actionSymbol(action: string): string {
  if (action === "unchanged") return "=";
  if (action === "created") return "+";
  return "~";
}

function cmdInstall(argv: string[]) {
  const flags = parseCommonFlags(argv);
  if (flags.help) return console.log(HELP);

  const env = realEnv();
  const reports = runInstall({ env, hosts: flags.hosts, scope: flags.scope, dryRun: flags.dryRun });

  if (reports.length === 0) {
    console.log(
      `No supported host tools detected on this machine.\nUse --host <${ADAPTERS.map((a) => a.id).join("|")}> to install anyway.`,
    );
    return;
  }

  const prefix = flags.dryRun ? "[dry-run] " : "";
  for (const { adapter, skillResults, mcpResult } of reports) {
    console.log(`\n${adapter.label}:`);
    for (const r of skillResults) {
      console.log(`  ${prefix}${actionSymbol(r.action)} ${r.skillId} -> ${r.path} (${r.action})`);
    }
    if (mcpResult) {
      console.log(
        `  ${prefix}${actionSymbol(mcpResult.action)} mcp server -> ${mcpResult.path} (${mcpResult.action})`,
      );
    }
  }
  console.log(
    flags.dryRun
      ? "\nDry run only — nothing was written. Re-run without --dry-run to apply."
      : "\nDone. Vovy's skills are now available in your tool(s) above.",
  );

  // Purely visual, strictly opt-in, and only relevant to the one host that has a status
  // bar — never write settings.json for the founder, just show the snippet.
  if (!flags.dryRun && reports.some((r) => r.adapter.id === "claude-code")) {
    console.log(
      `\nOptional: a Vovy status-bar badge for Claude Code (shows engine + memory at a glance).\nAdd to ~/.claude/settings.json:\n  "statusLine": { "type": "command", "command": "npx -y @vovy-ai/go statusline" }\n(Faster variant: npm i -g @vovy-ai/go, then use "vovy statusline" as the command.)`,
    );
  }
}

function cmdStatusline() {
  // No flags: this runs on every status-bar refresh and must stay dumb and fast.
  console.log(buildStatusline(realEnv()));
}

function cmdDoctor(argv: string[]) {
  const flags = parseCommonFlags(argv);
  if (flags.help) return console.log(HELP);

  const env = realEnv();
  const { reports, tokenFootprint, contextBackend } = runDoctor(env, flags.hosts, flags.scope);

  if (reports.length === 0) {
    console.log("No supported host tools detected on this machine — nothing to check.");
    return;
  }

  let allHealthy = true;
  for (const { adapter, entries, mcp, healthy } of reports) {
    allHealthy &&= healthy;
    console.log(`\n${adapter.label}: ${healthy ? "OK" : "needs `npx @vovy-ai/go install`"}`);
    for (const e of entries) {
      console.log(`  [${e.status === "ok" ? "x" : " "}] ${e.skillId} (${e.status})`);
    }
    if (mcp) {
      console.log(`  [${mcp.status === "ok" ? "x" : " "}] mcp server (${mcp.status})`);
    }
  }
  console.log(
    `\nsearch_codebase backend for this directory: ${contextBackend.backend} (${contextBackend.reason})`,
  );
  console.log(
    `\nEstimated always-on token footprint: ~${tokenFootprint.totalEstTokens} tokens (${tokenFootprint.skillCount} skill files ~${tokenFootprint.skillsEstTokens}, ${tokenFootprint.toolCount} MCP tool definitions ~${tokenFootprint.toolsEstTokens}) — what every session pays whether or not a skill fires. chars/4 estimate, not an exact tokenizer count.`,
  );
  process.exitCode = allHealthy ? 0 : 1;
}

function cmdUninstall(argv: string[]) {
  const flags = parseCommonFlags(argv);
  if (flags.help) return console.log(HELP);

  const env = realEnv();
  const reports = runUninstall({
    env,
    hosts: flags.hosts,
    scope: flags.scope,
    dryRun: flags.dryRun,
  });

  if (reports.length === 0) {
    console.log("No supported host tools detected on this machine — nothing to remove.");
    return;
  }

  const prefix = flags.dryRun ? "[dry-run] " : "";
  for (const { adapter, removedSkillPaths, removedMcpEntry } of reports) {
    console.log(`\n${adapter.label}:`);
    if (removedSkillPaths.length === 0 && !removedMcpEntry) {
      console.log("  nothing to remove");
      continue;
    }
    for (const p of removedSkillPaths) console.log(`  ${prefix}- removed ${p}`);
    if (removedMcpEntry) console.log(`  ${prefix}- removed vovy entry from ${removedMcpEntry}`);
  }
  console.log(flags.dryRun ? "\nDry run only — nothing was removed." : "\nDone.");
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);

  switch (command) {
    case "install":
      return cmdInstall(rest);
    case "doctor":
      return cmdDoctor(rest);
    case "uninstall":
      return cmdUninstall(rest);
    case "statusline":
      return cmdStatusline();
    case "--help":
    case "-h":
    case undefined:
      return console.log(HELP);
    default:
      console.error(`Unknown command "${command}".\n`);
      console.log(HELP);
      process.exitCode = 1;
  }
}

// npm/npx always launch a package's bin through a symlink (node_modules/.bin/<name>).
// import.meta.url resolves through that symlink to the file's real path, while
// process.argv[1] stays as the symlink path — a plain string comparison never matches,
// silently skipping main() for every real-world invocation. Resolve both to their real
// path before comparing.
function isMainModule(): boolean {
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1] ?? "");
  } catch {
    return false;
  }
}

if (isMainModule()) {
  main().catch((error) => {
    console.error(`vovy: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
