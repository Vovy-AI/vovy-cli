---
type: mistake
title: TypeScript backend paths broke on Windows — TS normalizes to forward slashes
date: 2026-07-09
tags: context-engine, windows, paths, ci
---
The TypeScript compiler API normalizes every file name to forward slashes internally, on ALL platforms. Comparing its file names against `root + sep` (backslash on Windows) made `isProjectFile` reject every declaration, so `find_symbol` silently returned `[]`. Green on macOS/Linux, caught only by the Windows CI matrix on PR #4.

**Why it happened:** "/" is simultaneously the native separator and TS's normalized format on the machines the code was written on, so the two formats were indistinguishable locally — the bug class is invisible except on Windows.

**How to avoid:** inside `backends/typescript.ts`, all comparisons happen in TS's forward-slash format (`toForwardSlashes`) and every path returned to callers goes through `toNativePath`, so both backends emit the platform's own format. When adding any new code that compares or returns paths from the TS LanguageService, route it through those two helpers — and treat the Windows matrix as the real reviewer for path code.
