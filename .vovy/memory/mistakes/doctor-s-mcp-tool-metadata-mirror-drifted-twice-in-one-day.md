---
type: mistake
title: doctor's MCP tool metadata mirror drifted twice in one day
date: 2026-07-09
tags: doctor, mcp-server, invariant
---
`packages/cli/src/commands/doctor.ts`'s `MCP_TOOL_METADATA` deliberately duplicates `packages/mcp-server/src/tools/definitions.ts` descriptions (importing would pull the MCP SDK into every `npx` run). It drifted twice in one day — despite a clear warning comment sitting directly on it.

**Why it happened:** prose invariants are read at write-time by whoever wrote them, not at break-time by whoever breaks them. **How to avoid:** it's now enforced byte-for-byte by a test in `doctor.test.ts` (dev-only workspace dep). The general rule: never keep a cross-file invariant as a comment when a test can hold it — and when you edit a tool description in `definitions.ts`, the mirror edit is mandatory.
