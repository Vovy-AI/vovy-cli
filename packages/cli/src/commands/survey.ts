import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Interface } from "node:readline/promises";
import type { DetectEnv } from "@vovy-ai/host-detect";

/**
 * One-time, consent-gated install survey — the only network call anywhere in this CLI.
 *
 * The contract, enforced here and in survey.test.ts, is: nothing is ever sent unless the
 * user typed an answer. Skipping both questions (or the whole prompt never showing) sends
 * zero bytes. Whatever happens, the offer is made at most once per machine, and
 * VOVY_NO_SURVEY=1 or CI suppresses it entirely. The payload is the answers plus the CLI
 * version — no machine info, no project info, no identifiers.
 *
 * This is a deliberate, documented exception to "nothing phones home" (see README FAQ and
 * docs/architecture.md, updated in the same PR that added this): npm download counts say
 * nothing about who finds Vovy useful or how they found it, and a two-question answer
 * volunteered by the user is the cheapest honest alternative to real telemetry, which
 * remains off the table.
 */

/** Supabase anon key — public by design (the same key ships in a public web bundle), and
 * the table it writes to is INSERT-only for this role: no reads, updates, or deletes. */
const SURVEY_URL = "https://swrrttvhfnsiesmkbwia.supabase.co/rest/v1/vovy_cli_survey";
const SURVEY_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3cnJ0dHZoZm5zaWVzbWtid2lhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ0ODI1MjQsImV4cCI6MjA2MDA1ODUyNH0.5BMG6KY-49J_Gz8Qg02Hf3DEHgiy3evtiXqP77non_A";

const SOURCES = [
  { key: "1", value: "x_twitter", label: "X / Twitter" },
  { key: "2", value: "github", label: "GitHub" },
  { key: "3", value: "friend", label: "A friend or colleague" },
  { key: "4", value: "search", label: "Search" },
  { key: "5", value: "youtube", label: "YouTube" },
  { key: "6", value: "other", label: "Other" },
] as const;

export interface SurveyAnswers {
  source?: string;
  sourceOther?: string;
  rating?: number;
}

export interface SurveyPayload {
  source?: string;
  source_other?: string;
  rating?: number;
  cli_version: string;
}

/** Machine-level (not project-level) state — the survey is once per machine, ever. */
function statePath(env: DetectEnv): string {
  return join(env.home, ".vovy", "cli-state.json");
}

function readState(env: DetectEnv): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(statePath(env), "utf8"));
  } catch {
    return {};
  }
}

export function markSurveyOffered(env: DetectEnv): void {
  const path = statePath(env);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify({ ...readState(env), surveyOffered: true }, null, 2)}\n`);
}

/**
 * Whether to show the offer at all. Every guard here is a hard "no": already offered,
 * explicitly suppressed, running in CI, or no interactive terminal to ask in.
 */
export function shouldOfferSurvey(env: DetectEnv, isTty: boolean): boolean {
  if (!isTty) return false;
  if (process.env.VOVY_NO_SURVEY) return false;
  if (process.env.CI) return false;
  if (readState(env).surveyOffered) return false;
  return true;
}

/** Pure: answers → wire payload. Returns null when there is nothing to send, which is the
 * skip path — the caller must send zero bytes in that case. */
export function buildSurveyPayload(
  answers: SurveyAnswers,
  cliVersion: string,
): SurveyPayload | null {
  if (answers.source === undefined && answers.rating === undefined) return null;

  const payload: SurveyPayload = { cli_version: cliVersion.slice(0, 20) };
  if (answers.source !== undefined) payload.source = answers.source;
  if (answers.source === "other" && answers.sourceOther) {
    payload.source_other = answers.sourceOther.slice(0, 120);
  }
  if (answers.rating !== undefined) payload.rating = answers.rating;
  return payload;
}

/** Asks the two questions. Enter skips either one; skipping both means nothing is sent. */
export async function askSurveyQuestions(rl: Interface): Promise<SurveyAnswers> {
  const answers: SurveyAnswers = {};

  const sourceMenu = SOURCES.map((s) => `  [${s.key}] ${s.label}`).join("\n");
  const sourceInput = (
    await rl.question(`\nHow did you hear about Vovy?\n${sourceMenu}\n> `)
  ).trim();
  const source = SOURCES.find((s) => s.key === sourceInput);
  if (source) {
    answers.source = source.value;
    if (source.value === "other") {
      const detail = (await rl.question("Where? (optional) > ")).trim();
      if (detail) answers.sourceOther = detail;
    }
  }

  const ratingInput = (await rl.question("\nExperience so far, 1 (rough) to 5 (great)? > ")).trim();
  const rating = Number.parseInt(ratingInput, 10);
  if (Number.isInteger(rating) && rating >= 1 && rating <= 5) answers.rating = rating;

  return answers;
}

/** Fire-and-forget POST with a short timeout. A survey must never break or delay an
 * install: every failure path is swallowed. */
export async function sendSurvey(
  payload: SurveyPayload,
  url: string = SURVEY_URL,
): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { apikey: SURVEY_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(2500),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * The full flow `install` calls once: disclose, ask, and send only what was answered.
 * `createInterface` is injected so tests can script the terminal.
 */
export async function offerSurvey(
  env: DetectEnv,
  cliVersion: string,
  makeInterface: () => Interface,
): Promise<void> {
  markSurveyOffered(env);

  console.log(
    "\nOne-time question (never asked again — press Enter to skip either one)." +
      "\nIf you answer, the answers and the CLI version are sent to the Vovy team; skipping sends nothing.",
  );

  const rl = makeInterface();
  try {
    const answers = await askSurveyQuestions(rl);
    const payload = buildSurveyPayload(answers, cliVersion);
    if (!payload) {
      console.log("Skipped — nothing was sent.");
      return;
    }
    const sent = await sendSurvey(payload);
    console.log(
      sent
        ? "Thanks — that helps more than you'd think."
        : "Thanks! (Couldn't reach the survey endpoint — nothing else to do.)",
    );
  } finally {
    rl.close();
  }
}
