# @vovy-ai/host-detect

## 0.1.2

### Patch Changes

- 1b546eb: Refresh every package README for what 0.3 actually ships — five skills including Memory Keeper, scope-aware search with `impact`, and the `statusline` subcommand — and lead each intro with what the package does rather than the pricing ("free forever" moves to a supporting sentence, including in the CLI help text and package descriptions). npm only refreshes a package's page on publish, so these need a release to become visible; the 0.3.0/0.4.0 release shipped hours before the README sync landed.

## 0.1.1

### Patch Changes

- Add a package-level README.md to each published package. npm only reads the README physically inside a package's own directory, not the monorepo root one, so all four packages were showing "This package does not have a README" on npmjs.com despite the root README being thorough.
