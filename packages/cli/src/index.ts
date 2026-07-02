#!/usr/bin/env node
import { parseArgs } from "node:util";
import { ADAPTERS, type SkillScope } from "@vovy-ai/host-detect";
import { runDoctor } from "./commands/doctor.js";
import { runInstall } from "./commands/install.js";
import { runUninstall } from "./commands/uninstall.js";
import { realEnv } from "./env.js";

const HELP = `vovy — free, forever, drop-in skills for vibe coding safely.

Usage:
  vovy install [options]     Write Vovy's skills into detected (or specified) host tools
  vovy doctor [options]      Check whether Vovy is correctly installed, without changing anything
  vovy uninstall [options]   Remove everything Vovy's installer wrote

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
}

function cmdDoctor(argv: string[]) {
  const flags = parseCommonFlags(argv);
  if (flags.help) return console.log(HELP);

  const env = realEnv();
  const reports = runDoctor(env, flags.hosts, flags.scope);

  if (reports.length === 0) {
    console.log("No supported host tools detected on this machine — nothing to check.");
    return;
  }

  let allHealthy = true;
  for (const { adapter, entries, mcp, healthy } of reports) {
    allHealthy &&= healthy;
    console.log(`\n${adapter.label}: ${healthy ? "OK" : "needs `vovy install`"}`);
    for (const e of entries) {
      console.log(`  [${e.status === "ok" ? "x" : " "}] ${e.skillId} (${e.status})`);
    }
    if (mcp) {
      console.log(`  [${mcp.status === "ok" ? "x" : " "}] mcp server (${mcp.status})`);
    }
  }
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

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`vovy: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
