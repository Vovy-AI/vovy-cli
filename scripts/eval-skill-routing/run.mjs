#!/usr/bin/env node
// Reproducible, zero-API-cost benchmark for skill routing.
//
// READ THIS BEFORE READING THE NUMBER IT PRINTS. What actually decides whether a skill
// fires is the *host model* reading that skill's SKILL.md `description`. This script does
// not run a model. It scores `matchSkills()` — the deterministic proxy in
// `@vovy-ai/skills` — against hand-labeled prompts, and compares it to a description-only
// bag-of-words baseline.
//
// So the number below measures ONE thing: whether the trigger conditions Vovy's
// descriptions encode separate the four skills cleanly on prompts a founder would plausibly
// type. It is a regression test against descriptions that stop discriminating. It is NOT a
// measurement of how Claude, Cursor, or Codex will behave, and must never be quoted as one.
//
// Regenerates RESULTS.md in this directory. Requires `pnpm build` first.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");

const skillsDist = join(repoRoot, "packages", "skills", "dist", "index.js");
let skills;
try {
  skills = await import(skillsDist);
} catch (error) {
  console.error(`Could not load ${skillsDist} — build it first:\n  pnpm build\n`);
  throw error;
}
const { getAllSkills, matchSkills } = skills;

const cases = JSON.parse(readFileSync(join(here, "prompts.json"), "utf8"));
const loadedSkills = getAllSkills();

/** Deliberately not named `normalize` — `scripts/` is inside the Context Engine's own walk,
 * and `eval-context-engine/correctness.json` pins ground truth on that symbol name. */
function normalizePrompt(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "this",
  "that",
  "to",
  "of",
  "in",
  "is",
  "it",
  "and",
  "or",
  "for",
  "before",
  "any",
  "use",
  "you",
  "your",
  "what",
  "when",
  "how",
  "do",
  "does",
  "i",
  "me",
  "my",
  "can",
  "so",
  "not",
  "on",
  "with",
  "as",
  "at",
  "by",
  "be",
  "are",
  "from",
  "than",
]);

function contentWords(text) {
  return new Set(
    normalizePrompt(text)
      .split(" ")
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w)),
  );
}

/**
 * Baseline: the pre-trigger-metadata world. Score each skill purely by how many content
 * words its description shares with the prompt. This is the closest deterministic stand-in
 * for "a reader who only sees the description text".
 */
const descriptionWords = new Map(loadedSkills.map((s) => [s.id, contentWords(s.description)]));

function baselineRoute(prompt) {
  const promptWords = contentWords(prompt);
  const scored = loadedSkills
    .map((skill) => {
      const words = descriptionWords.get(skill.id);
      const overlap = [...promptWords].filter((w) => words.has(w)).length;
      return { id: skill.id, score: overlap };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return scored[0]?.id ?? null;
}

function triggerRoute(prompt) {
  return matchSkills(prompt)[0]?.id ?? null;
}

const routers = [
  ["triggers", triggerRoute],
  ["description-only baseline", baselineRoute],
];

const results = routers.map(([name, route]) => {
  const rows = cases.map((testCase) => {
    const actual = route(testCase.prompt);
    return { ...testCase, actual, correct: actual === testCase.expected };
  });
  const correct = rows.filter((r) => r.correct).length;
  const hardRows = rows.filter((r) => r.hard);
  const hardCorrect = hardRows.filter((r) => r.correct).length;
  return {
    name,
    rows,
    accuracy: correct / rows.length,
    correct,
    total: rows.length,
    hardAccuracy: hardRows.length === 0 ? 0 : hardCorrect / hardRows.length,
    hardTotal: hardRows.length,
  };
});

const pct = (n) => `${(n * 100).toFixed(0)}%`;
const triggers = results[0];

const failureRows = triggers.rows
  .filter((r) => !r.correct)
  .map(
    (r) =>
      `| \`${r.prompt}\` | \`${r.expected ?? "(none)"}\` | \`${r.actual ?? "(none)"}\` | ${r.hard ?? "Not marked hard — an unexpected miss."} |`,
  )
  .join("\n");

const summaryTable = results
  .map(
    (r) =>
      `| ${r.name} | ${pct(r.accuracy)} (${r.correct}/${r.total}) | ${pct(r.hardAccuracy)} (${r.rows.filter((x) => x.hard && x.correct).length}/${r.hardTotal}) |`,
  )
  .join("\n");

const resultsMd = `# Skill routing — reproducible benchmark

**Read this before the number.** What actually decides whether a skill fires is the host
model reading that skill's SKILL.md \`description\`. **This benchmark does not run a model.**
It scores \`matchSkills()\` — the deterministic proxy in \`@vovy-ai/skills\` — against
hand-labeled prompts.

So this measures exactly one thing: whether the trigger conditions Vovy's descriptions
encode separate the four skills cleanly on prompts a founder would plausibly type. It is a
regression test that catches a description edit which stops discriminating between skills.
It is **not** a measurement of how Claude, Cursor, or Codex behave, and must not be quoted
as one. There is a real risk of overfitting here — the trigger phrases and the labeled
prompts were written by the same author — which is why ${triggers.hardTotal} cases are marked \`hard\`:
prompts deliberately written to defeat literal phrase matching. The \`hard\` column is the
honest one.

Reproduce with \`node scripts/eval-skill-routing/run.mjs\` (no API key, no network call, no
cost) after \`pnpm build\`.

## Results

Top-1 accuracy over ${triggers.total} labeled prompts, ${cases.filter((c) => c.expected === null).length} of which expect *no* skill to fire.

| Router | Top-1 accuracy | Accuracy on \`hard\` cases |
|---|---|---|
${summaryTable}

The baseline is the pre-trigger-metadata world: score each skill purely by content-word
overlap between the prompt and its description. It is what "just write a good description"
gets you, and it is the thing the trigger metadata has to beat to justify existing.

## Where it fails

${failureRows.length > 0 ? `| Prompt | Expected | Routed to | Why |\n|---|---|---|---|\n${failureRows}` : "No failures on the current prompt set — which most likely means the prompt set is too easy, not that routing is solved."}

**Disclosure — the trigger set was edited once after seeing these results.** \`founder-explainer\`
gained the keywords \`explain\` and \`deploy\` because "explain what this deploy script does"
matched no skill at all, which is a real coverage gap in the skill whose entire job is
explaining high-stakes actions. The remaining failures were deliberately *not* fixed: both
turn on intent ("delete" as UI copy, "add a" as a location question), and literal matching
cannot recover intent no matter how the phrase list is tuned. Chasing them would fit the
benchmark rather than the founder. Read the \`hard\` accuracy with that edit in mind.

Note also which direction the proxy errs: a real host model reads the whole description and
would very likely route "make the delete button red" correctly. The proxy under-reads intent
by construction, so it *understates* the shipped descriptions. That asymmetry is the reason
this number is a regression test and not a capability claim.

## What this does not show

Nothing here proves a host model loads the right skill. Confirming that needs a live-model
eval against each host, which costs API tokens and would go stale with every model release
— deliberately out of scope for a benchmark that must stay free to run and reproducible
offline. The value of this one is narrow and real: if someone edits a description and two
skills stop being distinguishable, this number drops before a user ever notices.
`;

writeFileSync(join(here, "RESULTS.md"), resultsMd);

for (const result of results) {
  console.log(
    `${result.name.padEnd(28)} top-1 ${pct(result.accuracy).padStart(4)} (${result.correct}/${result.total})   hard ${pct(result.hardAccuracy).padStart(4)}`,
  );
}
console.log("\n── trigger-router failures ──");
for (const row of triggers.rows.filter((r) => !r.correct)) {
  console.log(
    `  "${row.prompt}"\n     expected ${row.expected ?? "(none)"}, got ${row.actual ?? "(none)"}${row.hard ? "  [hard]" : "  [UNEXPECTED]"}`,
  );
}
console.log(`\nWrote ${join(here, "RESULTS.md")}`);
