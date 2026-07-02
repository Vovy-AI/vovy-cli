---
name: prompt-rescoper
description: Use this before writing any code for a new feature, build, or change request — especially phrases like "build me", "add a", "create a", "I want", "can you make", "implement", "set up", or any request that describes an outcome without specifying files, scope, or steps. Also use when a request would touch many files or systems at once. Rewrites the request into a properly scoped spec before implementation starts, so the founder knows what's about to happen and the change stays small enough to review.
---

# Prompt Rescoper

The person you're working with is very likely a non-technical founder. They know what they want the product to *do*, not how to describe it the way an engineer would. Left alone, that gap causes two specific, well-documented failure modes: the model either guesses wrong and builds the wrong thing, or it makes one large sprawling change that's impossible for the founder to review or recover from if it goes sideways. Your job here is to close that gap before writing any code.

## When this applies

Trigger this on any request that describes an outcome ("add a waitlist", "make login work with Google", "the pricing page should look better") rather than a precise change. Do **not** trigger it on requests that are already scoped and small (a one-line fix, a copy change, a request that names specific files).

## What to do

1. **Restate the goal in one sentence**, in your own words, so the founder can confirm you understood it before anything happens.
2. **Propose the smallest slice that's actually useful**, not the whole feature. If the request implies multiple pieces (e.g., "add user accounts" implies signup, login, sessions, password reset, and probably email), name the pieces and propose building one at a time, starting with the one that unblocks the rest.
3. **State what's explicitly out of scope for this pass.** This is as important as what's in scope — it's what keeps the change small and reviewable.
4. **Surface assumptions as questions, not guesses**, but only for the ones that would actually change what you build (e.g., "should this be public or behind login?"). Don't interrogate the founder over details that don't matter yet — that's its own failure mode.
5. **Only after the founder confirms (or the scope is already obviously small), start implementing** — and stay inside the scope you just proposed. If you discover mid-task that the real fix needs to grow beyond it, stop and say so in plain English before continuing, rather than silently expanding the change.

## Format

Keep the rescoped spec short — a few lines, not a document. Something like:

> **Goal:** [one sentence]
> **Building now:** [the smallest useful slice]
> **Not doing yet:** [explicitly deferred pieces]
> **Assuming:** [only if something genuinely blocking is ambiguous]

Then proceed straight into the work — don't wait for a reply unless you asked a blocking question.

## Why this matters

Founders lose trust in AI coding tools for one of two reasons: the tool builds something other than what they meant, or it makes a change so large they can't tell what happened or undo it safely. Both are prevented by scoping down *before* writing code, not by writing more code faster.
