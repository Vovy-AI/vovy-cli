# Contributing to Vovy

Thanks for considering it. Vovy is small on purpose — most contributions will fit in one of the categories below.

## Setup

```
pnpm install
pnpm build
pnpm test
```

Requires Node 20+ and pnpm (`corepack enable` will get you the right version automatically).

## Everyday commands

```
pnpm lint          # Biome check
pnpm lint:fix       # Biome check --write
pnpm typecheck      # tsc --noEmit across all packages
pnpm test           # vitest across all packages
pnpm build          # tsup build across all packages
pnpm ci             # everything CI runs, locally
```

Everything is orchestrated by Turborepo, so `pnpm build` etc. run per-package with caching — you don't need to `cd` into a package to work on it.

## Adding a new host adapter

This is the single highest-value contribution to Vovy, and the main reason `@vovy-ai/host-detect` is its own package. To add support for a new AI coding tool:

1. Read `packages/host-detect/src/types.ts` — every adapter implements the `HostAdapter` interface: `detect()`, `skillFilePath()`, `mcpConfigPath()`, `mergeMcpConfig()`.
2. Look at `packages/host-detect/src/adapters/claude-code.ts` as the reference implementation, and `cursor.ts`/`cline.ts`/`windsurf.ts` as examples of best-effort adapters that are honest about what's unconfirmed.
3. Create `packages/host-detect/src/adapters/<your-host>.ts`. Document your sources in a comment at the top of the file — link the host's own docs for the skill/rules file convention and the MCP config format.
4. Register it in `packages/host-detect/src/adapters/index.ts` (the `ADAPTERS` array) and re-export it.
5. Add `packages/host-detect/src/adapters/<your-host>.test.ts` — at minimum, test `detect()` against a fake `DetectEnv` (see `test-utils.ts`, and never touch the real `$HOME`) and assert the exact paths `skillFilePath()`/`mcpConfigPath()` produce.
6. Update `docs/host-support-matrix.md`.

If you're fixing or confirming an existing best-effort adapter (see `docs/host-support-matrix.md` for the current list), the same steps apply minus step 4.

## Editing a skill

Skill content lives in `packages/skills/skills/<id>/SKILL.md`. The `description` field in the YAML frontmatter is what the host model reads to decide whether to trigger the skill — per Anthropic's own Agent Skills guidance, models tend to under-trigger skills, so keep descriptions assertive and keyword-dense rather than vague. Run `pnpm --filter @vovy-ai/skills test` after editing to make sure frontmatter still parses.

## Testing conventions

- **Never touch the real `$HOME` or `cwd` in a test.** `@vovy-ai/host-detect` and `@vovy-ai/go` both take an explicit `DetectEnv` parameter everywhere specifically so tests can redirect it — use the `tmpEnv()` helper (`src/test-utils.ts` in each package) which creates a throwaway directory under `os.tmpdir()` and cleans it up after the test.
- Prefer testing through the public exported functions (`runInstall`, `runDoctor`, `runUninstall`, adapter methods) over reaching into private internals.

## Pull requests

- Run `pnpm ci` before opening a PR.
- Add a changeset (`pnpm changeset`) for any change to a published package (`@vovy-ai/*`) — this drives the changelog and version bump on release.
- Keep PRs scoped to one adapter/skill/fix where possible; it makes review faster and the changeset more meaningful.

## Code of conduct

See [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).
