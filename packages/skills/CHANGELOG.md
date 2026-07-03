# @vovy-ai/skills

## 0.2.0

### Minor Changes

- Sharpen `prompt-rescoper` with battle-tested prompt-engineering rules adapted from Vovy Go's own live prompt-enhancer (rules only — no live LLM call, consistent with Vovy CLI never running its own inference): silent CREATE-vs-ITERATE mode classification that changes what the spec is allowed to assume, numbered steps for requests with more than two distinct pieces, an anti-prompt-injection guard for pasted errors/files/output, and explicit guidance not to assert unverified project state. Also documents why the skill intentionally still asks blocking questions rather than adopting the "never ask the user" rule some one-shot tools use — this skill runs inside a live conversation, so asking is cheap and guessing is the actual failure mode.
