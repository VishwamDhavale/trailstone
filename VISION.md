# Trailstone

> **Trailstone keeps an AI faithful to what you decided — across sessions, people, and
> tools — and when a decision is reversed, it names exactly which work is now
> suspect, so it gets re-checked before anyone builds further.**

A trailstone is a stack of stones a traveler leaves to mark the trail, so whoever comes
after does not lose the path. This is that, for a codebase built with an AI over
many weeks.

Trailstone is **one small script and one file in your repo**. No server, no account, no
telemetry. `npx trailstone demo` shows the whole idea on a throwaway repo in ten
seconds.

**Who it's for:** developers building with an AI coding agent, today. The underlying
idea is domain-general — we tested it on a grant proposal, and it flagged exactly the
documents a budget change invalidated — but the *delivery* is git-native (a decision
clears when you commit the fixed file), which fits developers first. A writer-native
surface is a future direction, not this release.

---

## The problem

Real work with an AI is not one session. A product, a research protocol, a
financial model — it is weeks of sessions, many messages each, across Claude,
Codex, and whatever comes next. Two things go wrong, every time:

1. **Drift.** Every new message steers a little. The AI does what the latest
   message says, and what was decided ten messages or three sessions ago quietly
   stops governing the work. Nobody sees the moment it happened.

2. **Silent invalidation.** A decision gets reversed — "actually, cookies, not JWT."
   Everything built on the old decision stays green, finished, and *wrong*. Nothing
   tells the AI, or you, which parts now have to be redone.

No AI harness solves this. Their memory stores facts and preferences; it does not
know what a decision *governs*, so it cannot tell you what a reversal breaks.

## The idea

Record the decisions, in the repo, next to the code. Each decision names what it
**governs** — the files it applies to. Because a decision knows its scope, reversing
it can point at exactly the work that rested on the old rule. The AI sees the
relevant decision at the moment it touches a governed file, and work resting on a
reversed decision cannot quietly ship.

It is a **layer under your AI harness, never the harness itself.** It never does the
work and never spends your tokens on its own. It is deliberately domain-general:
today a "scope" is a file or a directory, but the same idea holds for a document, a
spreadsheet tab, or any unit of work.

## The core loop — five verbs

Everything Trailstone does is one of these. This is the whole product.

| Verb | What it means |
|---|---|
| **Record** | A decision enters the ledger with its rationale, who made it, and its *scope* — the files it governs. State the alternative in the text ("X, not Y") so a future reversal reads as a diff. Decisions are immutable: changing your mind is a *new* decision that supersedes the old one. |
| **Surface** | At the *right moment* — when the AI opens or edits a governed file — it sees only the decisions relevant to that file. Never a dump of the whole ledger. |
| **Invalidate** | Reversing a decision *derives* (never stores) which committed work rested on it: any tracked file in the reversed decision's scope whose last commit predates the reversal. |
| **Re-validate** | Seeing a flag, the AI re-checks that work against the *new* decision and reports what changed and what it proposes. Trailstone carries the flag and its cause; the AI recomputes; the human decides. |
| **Enforce** | A choke point the AI cannot talk its way past: a file resting on a reversed decision does not pass the pre-push guard or the CI gate until it is re-checked. |

Plus the feeder that makes the loop real without anyone remembering to log:

| Feeder | What it means |
|---|---|
| **Capture** | Decisions can enter passively from the work stream — a cheap judge reads the end of an AI turn and proposes anything that looks like a real decision. Proposals bind nothing until a human confirms. Precision over recall. |

## What the local tool proves *today* (be skeptical — try it)

- **The ledger is a YAML file** — `.trailstone/decisions.yml` — committed with your code.
  The pull request that adds a decision *is* the review. Git already gives you
  provenance (blame), membership (who can push), and sync (clone); Trailstone does not
  rebuild any of that.
- **Three rules are the entire engine:** decisions are immutable (reverse with a new
  entry); a file is *stale* when its last commit predates a reversal of a decision
  whose scope matches it; a stale flag clears when you edit + commit the file, or
  record that you re-checked it and it still holds.
- **It surfaces into your AI agent** via Claude Code hooks: the decisions governing a
  file appear in the agent's context *before* it edits that file, with the old text
  and the new one.
- **It blocks at the push** and in CI: a stale file about to be pushed fails the
  guard.
- **One honest metric:** fires that were right versus fires that were wrong. Nothing
  else. `trailstone report --anon` produces a shareable summary of exactly that.

## The format is the contract — build on top of this

The important artifact here is not the script. It is **`.trailstone/decisions.yml`** — a
small, documented, boring YAML shape (every field is in the README). *That* is the
standard; `trailstone.mjs` is just the first implementation of it.

So **don't wait for us.** If you want this in a different editor, a different UI, a
different enforcement point, or a different language, read the ledger and write it. We
will keep the format stable, and we would rather review your shim than write five
integrations badly ourselves.

Concretely — the layers, and how portable each already is:

| Layer | Portability today |
|---|---|
| **The ledger** (`.trailstone/decisions.yml`) | **Universal.** Plain YAML in your repo; any tool, agent or language can read it. |
| **Enforcement** (pre-push hook, CI Action) | **Universal.** Git does not care what wrote the code. |
| **Pull** — an agent *asking* "what governs this file?" | **Universal, shipped.** `trailstone mcp` speaks MCP on stdio for any MCP client; `install` also writes agent rules into `AGENTS.md` / Cursor rules. |
| **Push** — the warning *injected before* the edit, unasked | **Claude Code only today.** No cross-agent hook standard exists yet. |

That last row is the honest gap, and it matters, because **push is the differentiator.**
We measured it: agents do not reliably *remember* to ask. A warning an agent must choose
to look up is a warning it skips. So a shim that gets automatic pre-edit surfacing
working in Codex, Cursor, Windsurf or Claude Desktop is the single most valuable
contribution to this project.

## Open directions (not a roadmap we are guarding — things worth building)

- **Push shims for other harnesses.** Pull already works everywhere (MCP + agent rules).
  What is missing is *unasked, pre-edit* surfacing outside Claude Code — a hook shim for
  Codex, Cursor, Windsurf or Claude Desktop over the same ledger. Most wanted, and most
  useful to whoever actually uses that editor daily.
- **Teams.** A reversal by one person reaching another at *their* next relevant moment.
  The YAML-in-repo design is meant to make this a clone rather than a database.
- **A GitHub App** turning a stale flag into an inline check-run annotation on the exact
  lines, with "re-affirm" / "supersede" actions in the PR.
- **Richer scope** — from files to globs to symbols/modules ("the auth module").
- **Scope suggestion from the diff**, so a narrow scope is the easy path.

None of these are reserved. If one of them is what you need, build it.

## The invariants (the constitution — a change here is a pivot, not a feature)

1. **Derived, never stored.** `supersedes` and `scope` are the only stored edges.
   Staleness is *computed* from git timestamps and scope membership on every read.
2. **Exact, never fuzzy, on anything that gates.** A stale flag fires on supersession
   plus exact scope overlap — path, directory prefix, or glob — never a guess.
   (Lexical matching may *surface* a decision; it can never flag a file or fail a
   push.) **A false stale flag is worse than a missed one.**
3. **Minimum sufficient surfacing.** Never dump the ledger. Push what is critical
   (stale), pull what is relevant, nothing else.
4. **The human outranks the ledger.** A recorded decision gives the AI standing to
   *refuse* a contradicting request and to *ask* — it never lets the AI overrule an
   explicit human authorization.
5. **A flag means "governed by," not "broken."** Reversing a directory-scoped
   decision flags every file under it; most will still comply and clear in seconds.
   Scope discipline is the whole game.

## Known limitations (found by simulation, stated honestly)

We ran cold AI agents against this on throwaway repos and stress-tested the edges.
What holds, and what doesn't:

- **Scope discipline is the whole game.** A tight scope (`src/auth/session.js`) is a
  scalpel; a bare directory (`src/`) is a smoke alarm — on reversal it flags every
  file under it, most of which never touched the decision (we measured ~1 in 4 that
  did). `decide` warns when a scope is a whole top-level directory, and the precision
  metric exposes over-broad scopes after the fact — but the discipline is yours.
- **The false clear.** Any commit that touches a flagged file clears the flag — even
  one unrelated to the reversal. The pre-edit warning is the mitigation (whoever
  touches the file is told first), and the stale message says this plainly, but a
  passing commit is not proof the reversal was addressed. Requiring an attributed
  re-validation to clear is a considered future option, gated on this actually
  biting in real use.
- **It does not follow file renames.** `git mv` a governed file and it silently
  leaves that decision's scope until you re-scope. The gate stays exact, not guessing.
- **Re-affirming re-flags.** Reversing a decision back to its original still marks the
  resting work stale — the tool can't know your code matches the old rule again
  without a re-check.
- **Concurrent decisions conflict.** Two branches each appending a decision produce an
  ordinary git merge conflict in the ledger; you resolve it by keeping both.
- **Considered and deferred: dependency cascade.** We do *not* follow imports to flag
  files that merely *depend on* a flagged file. That would trade the tool's one real
  asset — precision — for a flood of guesses. If it ever returns, only as a soft hint
  that never blocks.

## Status

v0.1, local-first, Apache-2.0 licensed. The mechanism is real and self-verifying; everything
above the local tool is a direction put out for validation, not a finished system.

We are publishing the idea, not guarding it. The problem is real, the loop is small
enough to reason about, and the format is stable enough to build on. If it earns its
place on your repo, tell us what the fires were worth (`trailstone report --anon`) — and
if you need a piece that does not exist yet, that is an invitation, not a waiting list.
