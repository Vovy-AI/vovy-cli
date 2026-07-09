---
type: mistake
title: Test fixture names silently corrupted benchmark ground truth
date: 2026-07-09
tags: benchmark, eval, fixtures
---
Named a test fixture method `detect` — the same name a hand-verified benchmark query (`scripts/eval-context-engine/correctness.json`) pins ground truth on. The engine walks the whole repo including `test/fixtures/`, so both backends "failed" with false positives that were actually my own new files.

**Why it happened:** the invariant ("fixture symbol names must not collide with correctness.json query names") was an hour old and existed only in one session's head. **How to avoid:** before adding any symbol to `test/fixtures/` or `scripts/`, grep `correctness.json` for the name; fixtures use deliberately odd names (`probe`, `tally`) for this reason.
