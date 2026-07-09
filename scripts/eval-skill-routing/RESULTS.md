# Skill routing — reproducible benchmark

**Read this before the number.** What actually decides whether a skill fires is the host
model reading that skill's SKILL.md `description`. **This benchmark does not run a model.**
It scores `matchSkills()` — the deterministic proxy in `@vovy-ai/skills` — against
hand-labeled prompts.

So this measures exactly one thing: whether the trigger conditions Vovy's descriptions
encode separate the four skills cleanly on prompts a founder would plausibly type. It is a
regression test that catches a description edit which stops discriminating between skills.
It is **not** a measurement of how Claude, Cursor, or Codex behave, and must not be quoted
as one. There is a real risk of overfitting here — the trigger phrases and the labeled
prompts were written by the same author — which is why 4 cases are marked `hard`:
prompts deliberately written to defeat literal phrase matching. The `hard` column is the
honest one.

Reproduce with `node scripts/eval-skill-routing/run.mjs` (no API key, no network call, no
cost) after `pnpm build`.

## Results

Top-1 accuracy over 33 labeled prompts, 5 of which expect *no* skill to fire.

| Router | Top-1 accuracy | Accuracy on `hard` cases |
|---|---|---|
| triggers | 94% (31/33) | 50% (2/4) |
| description-only baseline | 85% (28/33) | 25% (1/4) |

The baseline is the pre-trigger-metadata world: score each skill purely by content-word
overlap between the prompt and its description. It is what "just write a good description"
gets you, and it is the thing the trigger metadata has to beat to justify existing.

## Where it fails

| Prompt | Expected | Routed to | Why |
|---|---|---|---|
| `where do I add a new route` | `context-scoper` | `prompt-rescoper` | A location question phrased with 'add a'. The literal phrase belongs to prompt-rescoper, the intent belongs to context-scoper. |
| `make the delete button red` | `prompt-rescoper` | `founder-explainer` | 'delete' here is UI copy, not a destructive action. A bare keyword cannot tell the difference. |

**Disclosure — the trigger set was edited once after seeing these results.** `founder-explainer`
gained the keywords `explain` and `deploy` because "explain what this deploy script does"
matched no skill at all, which is a real coverage gap in the skill whose entire job is
explaining high-stakes actions. The remaining failures were deliberately *not* fixed: both
turn on intent ("delete" as UI copy, "add a" as a location question), and literal matching
cannot recover intent no matter how the phrase list is tuned. Chasing them would fit the
benchmark rather than the founder. Read the `hard` accuracy with that edit in mind.

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
