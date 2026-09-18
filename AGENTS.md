# AGENTS.md — instructions for AI agents working on Trailstone

You are an AI agent contributing to a tool whose entire purpose is keeping AI agents
faithful to recorded decisions. Hold yourself to it here.

Read **[VISION.md](VISION.md)** for what this is, and
**[CONTRIBUTING.md](CONTRIBUTING.md)** for what gets declined. This file is the short,
operational version.

## Orient first

```bash
node trailstone.mjs --selfcheck                 # must pass BEFORE you change anything
node trailstone.mjs list                        # the decisions governing this project
node trailstone.mjs governing trailstone.mjs    # what binds the file you are about to edit
```

This repo carries its own ledger at `.trailstone/decisions.yml`. **Honor it.** If your
change would contradict a decision in force, say which decision first and ask — do not
quietly depart from it. Changing a decision is allowed and is how this is meant to
work; a silent departure is the one thing that is not.

## Hard constraints

Breaking any of these invalidates the change, however good the code:

1. **One file.** Everything lives in `trailstone.mjs`. Do not split it into modules.
   A tool that sits in front of every prompt must be auditable in one sitting.
2. **Zero dependencies.** Node standard library only. Do not add a package, and do not
   introduce a build step. `npx trailstone` must work on a bare machine.
3. **Hooks fail open, always.** `hook` must exit 0 with empty stderr on every path —
   no git repo, no cwd, deleted cwd, unknown event, malformed stdin. A non-zero exit
   from a `UserPromptSubmit` hook **blocks the user's prompt**; this has happened
   machine-wide and is the worst failure this tool has. The selfcheck asserts all six
   failure modes. Do not weaken it.
4. **Never make a gate fuzzy.** Staleness fires on supersession + exact scope overlap.
   Lexical matching is allowed only where it *surfaces* a decision to an agent; it may
   never flag a file or fail a push. A false stale flag is worse than a missed one.
5. **No server, no telemetry, no account.** Ever.

## Working rules

- **Read the whole function before you edit it.** This file is dense on purpose; the
  comments record why something is the way it is, often from a real incident. If a
  comment explains a past bug, you are probably about to reintroduce it.
- **Do not reformat.** No whole-file prettier runs, no reflowing unrelated lines. Keep
  the diff to what you actually changed — a large diff on this file is unreviewable.
- **Match the surrounding style.** Terse, dense, comment-only-where-the-why-is-not-obvious.
- **Add a selfcheck assertion for non-trivial logic** — a branch, a parser, a matcher.
  No frameworks, no fixtures. The smallest assertion that fails if your logic breaks.
- **The messages are the product.** The text Trailstone injects into an agent's context
  is the user-facing surface. If you change it, read it back cold and ask whether
  someone who has never heard of this tool would know what to do.

## Before you finish

```bash
node trailstone.mjs --selfcheck   # must still pass
node trailstone.mjs demo          # the loop still reads correctly end to end
```

Then record what you decided, if you decided anything:

```bash
node trailstone.mjs decide "what you chose, naming the alternative you rejected" \
  --why "the reason" --scope trailstone.mjs
```

State the decision as `X, not Y` so a future reversal reads as a diff. Keep the scope
as narrow as the change really is — a whole-directory scope is an alarm someone will
learn to ignore.

## Report honestly

If you could not make something work, say so plainly. If you skipped a check, say
which. If you changed behaviour the tests do not cover, say that. An agent that
narrates success it did not achieve is the exact failure this project exists to catch.
