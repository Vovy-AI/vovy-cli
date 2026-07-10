---
type: decision
title: One-time consent-gated install survey — the single allowed network call
date: 2026-07-10
tags: survey, telemetry, constraint-change, supabase
---
Added (2026-07-09, ~1k npm downloads, zero insight from npm's own stats) a two-question install survey: how-did-you-hear + experience 1-5, POSTed to an INSERT-only Supabase table.

**Rejected alternatives:** link-only to a hosted form (zero promises broken, but low response rate — owner explicitly chose capture over purity); GitHub Discussions poll (public answers, coarser); background telemetry (never on the table).

**Accepted costs, decided with eyes open:** (1) "nothing phones home" README/FAQ claims were amended in the same PR — the docs walk-back ships atomically with the feature, never after; (2) the endpoint URL in public MIT code is the same Supabase project as the owner's web app, discoverable by correlation — owner chose this over a neutral endpoint, twice informed; (3) junk rows possible since the anon key is public — mitigated by INSERT-only RLS + CHECK constraints, accepted rather than fronted by an edge function.

**The consent contract lives in code, not prose:** packages/cli/src/commands/survey.ts + survey.test.ts — nothing sends unless typed, once per machine ever, never in CI/non-TTY, VOVY_NO_SURVEY=1 kills it, payload = answers + CLI version only.
