## What does this change?

<!-- One or two sentences. Link an issue if there is one. -->

## Checklist

- [ ] `pnpm ci` passes locally (lint, typecheck, test, build)
- [ ] Added/updated tests — and if this touches `@vovy-ai/host-detect` or `vibez`, confirmed they use `tmpEnv()` and never touch the real `$HOME`
- [ ] Added a changeset (`pnpm changeset`) if this changes a published package (`@vovy-ai/*` or `vibez`)
- [ ] Updated `docs/host-support-matrix.md` if this adds or corrects a host adapter
