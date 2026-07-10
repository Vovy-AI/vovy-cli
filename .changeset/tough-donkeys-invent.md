---
"@vovy-ai/go": minor
---

One-time, consent-gated install survey — and an honest amendment to "nothing phones home".

After a successful `install`, the CLI asks two questions once per machine, ever: how you heard about Vovy, and your experience 1–5. The contract, enforced in code and tests: answers are sent **only if you type them** (skipping either or both sends zero bytes for that answer; skipping everything sends nothing at all), the payload is your answers plus the CLI version — no machine, project, or identifying information — and `VOVY_NO_SURVEY=1`, CI, or a non-interactive terminal suppress the prompt entirely. The endpoint is an INSERT-only table: the embedded public key cannot read anything back. README and architecture docs updated in the same release to reflect the one narrow exception; background telemetry remains off the table.
