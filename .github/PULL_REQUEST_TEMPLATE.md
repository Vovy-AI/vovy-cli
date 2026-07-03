## What does this change?

<!-- One or two sentences. Link an issue if there is one. -->

## Checklist

- [ ] `pnpm ci` passes locally (lint, typecheck, test, build)
- [ ] Added/updated tests — and if this touches `@vovy-ai/host-detect` or `@vovy-ai/go`, confirmed they use `tmpEnv()` and never touch the real `$HOME`
- [ ] Added a changeset (`pnpm changeset`) if this changes a published package (`@vovy-ai/*`)
- [ ] Updated `docs/host-support-matrix.md` if this adds or corrects a host adapter
