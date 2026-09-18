# Contributing to Trailstone

Thanks for looking. Trailstone is deliberately small, and it intends to stay that way.
Read this before opening a PR — a lot of reasonable-sounding changes will be declined
on principle, and it is only fair that you know which ones up front.

## What this project is

One script and one file in your repo. It records the decisions that govern your code,
surfaces them to an AI agent at the moment it edits a governed file, and when a
decision is reversed it names exactly which files rested on the old one.

Read **[VISION.md](VISION.md)** first. It contains the invariants, and the honest list
of what the tool does not do.

## The shape of the project (and why)

- **One file: `trailstone.mjs`.** The CLI, the staleness engine, all four Claude Code
  hooks, the installer, the capture judge, and the test suite live in it. This is not
  an accident and not technical debt — a tool that installs itself into everyone's
  prompt path must be auditable in one sitting.
- **Zero dependencies.** Node standard library only. `npx trailstone` must work on a
  machine with nothing installed.
- **No server, no account, no telemetry.** Nothing leaves your machine except the
  optional capture judge (see [SECURITY.md](SECURITY.md)).

## Running it

```bash
node trailstone.mjs --selfcheck   # the test suite. Must pass before and after your change.
node trailstone.mjs demo          # the whole loop on a throwaway repo, ten seconds
node trailstone.mjs doctor        # is Trailstone actually watching this repo?
```

`--selfcheck` spins up throwaway git repos and asserts real behaviour: glob governance,
reversal → stale, the three clear paths, proposed-is-inert, YAML round-tripping, the
fire log, and that **every hook exits 0 with no stderr across six failure modes**.

**If you add non-trivial logic, add an assertion to `--selfcheck`.** No frameworks, no
fixtures — the smallest thing that fails if your logic breaks.

## The invariants — not up for debate

A PR that breaks one of these will be declined even if the code is good:

1. **Exact, never fuzzy, on anything that gates.** A stale flag fires on supersession
   plus exact scope overlap — path, directory prefix, or glob. Lexical or semantic
   matching may *surface* a decision to an agent; it may never flag a file or fail a
   push. **A false stale flag is worse than a missed one.**
2. **The hooks fail open, always.** A hook that exits non-zero *blocks the user's
   prompt*. This has happened, machine-wide, and it is the worst bug this tool can
   have. Every path must exit 0 with no stderr when anything goes wrong — and the
   selfcheck must prove it.
3. **Minimum sufficient surfacing.** Never dump the ledger into an agent's context.
   Push what is critical, pull what is relevant, nothing else.
4. **Derived, never stored.** `supersedes` and `scope` are the only stored edges.
   Staleness is computed from git timestamps and scope membership on every read.
5. **The human outranks the ledger.** A decision gives an agent standing to refuse and
   to ask; it never lets the agent overrule an explicit human authorization.

## What we will happily merge

- Bug fixes, with an assertion added to `--selfcheck`.
- Hook shims for other agent harnesses (Codex, Cursor, …) over the same YAML file.
- Clearer wording in what the tool surfaces — the messages are the product.
- Better scope ergonomics (e.g. suggesting a scope from the diff).
- Docs that make a limitation *more* honest.

## What we will decline

- **Dependency cascade** (flagging files that merely *import* a flagged file). It trades
  the tool's only real asset — precision — for a flood of guesses. See VISION.md.
- **A server, a database, an account, or telemetry.** Git already provides provenance,
  membership, review, and sync.
- **Semantic judgement of whether work is "correct."** Trailstone asserts on the
  constraints work was done under, never on the quality of the output.
- **Dependencies**, unless the standard library genuinely cannot do it.
- **A plan, steps, or a DAG.** It tracks decisions and the files they govern. That is all.

## Scope discipline

The single biggest source of noise is an over-broad `--scope`. A scope of
`src/auth/session.js` is a scalpel; `src/` is a smoke alarm. If you are adding a
feature that records decisions, make the narrow scope the easy path.

## The one thing we actually want back

Not stars — **the precision number.**

```bash
trailstone report --anon
```

That drops every name and reduces each path to its extension, so it is safe to paste
from a private repo. It tells us how often the stale warning fired and whether those
fires were right. If precision is bad on your repo, that is the most useful bug report
you can file.

## If your change alters behaviour

Record it. This project governs itself with its own ledger:

```bash
node trailstone.mjs decide "what you chose, not what you rejected" \
  --why "the reason" --scope trailstone.mjs
```

The PR that adds that line to `.trailstone/decisions.yml` *is* the review.

## Platforms

Trailstone is meant to work everywhere its users are — macOS, Windows and Linux. The
known cross-platform hazards are handled and asserted in `--selfcheck`:

- Every **generated shell command** (the four hook entries, the `pre-push` script) quotes
  the script path and uses forward slashes, so a path containing a space
  (`/Users/My Name/…`, `C:\Users\John Doe\…`) or Windows backslashes cannot silently
  break the install.
- **Capture detection** uses `where`/`which` rather than `sh -c command -v`, which does not
  exist on Windows.
- The **YAML parser tolerates CRLF**, so a ledger rewritten by Windows git still parses.
- All paths go through `join`, and `git ls-files` reports forward slashes on every OS.

Status, honestly:

- **Linux** — developed and tested here.
- **macOS** — the POSIX assumptions are the same as Linux and the space-in-path case is
  covered, but **we have not run it on a Mac.**
- **Windows** — the known hazards above are fixed, but **we have not run it on Windows.**

If you use macOS or Windows, running `node trailstone.mjs --selfcheck` and telling us what
happened — including "nothing broke" — is one of the most useful contributions right now.

## Licence

**Apache-2.0.** Contributions are licensed under it too — Apache-2.0 section 5 says any
contribution you deliberately submit for inclusion is under the same terms, so there is no
CLA to sign and nothing extra to agree to.

Why Apache-2.0 rather than MIT: it carries an express patent grant and explicit inbound
contribution terms, which is what companies' legal review looks for and what keeps
contributor IP unambiguous. It is just as permissive as MIT — commercial use, proprietary
forks, SaaS and redistribution are all fine.

Version 0.1.0 was published under MIT and remains available under MIT; everything from
0.2.0 on is Apache-2.0.
