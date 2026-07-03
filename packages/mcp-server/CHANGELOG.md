# @vovy-ai/mcp-server

## 0.1.3

### Patch Changes

- Add a package-level README.md to each published package. npm only reads the README physically inside a package's own directory, not the monorepo root one, so all four packages were showing "This package does not have a README" on npmjs.com despite the root README being thorough.
- Updated dependencies
  - @vovy-ai/skills@0.2.1

## 0.1.2

### Patch Changes

- Updated dependencies
  - @vovy-ai/skills@0.2.0

## 0.1.1

### Patch Changes

- 8a2c3f4: Fix a critical bug where the "is this the entry point" check in both bin files broke under symlink invocation — which is exactly how npm/npx always launch a package's bin (`node_modules/.bin/<name>` is a symlink). `import.meta.url` resolves through the symlink to the file's real path while `process.argv[1]` stays as the symlink path, so the old string comparison never matched. This meant `npx @vovy-ai/go install` silently did nothing, and the MCP server never actually started when a host tool launched it via `npx -y @vovy-ai/mcp-server`. Both now compare real (symlink-resolved) paths instead, and both packages gained a regression test that spawns the real built bin through an actual symlink to catch this class of bug going forward.
