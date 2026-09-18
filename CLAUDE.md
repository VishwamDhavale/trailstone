# CLAUDE.md

Instructions for AI agents working on this repo live in **[AGENTS.md](AGENTS.md)** —
read that file. It is the single source of truth so the two never drift.

Short version: one file (`trailstone.mjs`), zero dependencies, hooks must always exit 0,
never make anything that *gates* fuzzy, run `node trailstone.mjs --selfcheck` before and
after, and record real decisions with `node trailstone.mjs decide`.
