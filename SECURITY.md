# Security & privacy

Trailstone is a local CLI plus a set of git/agent hooks. It is small on purpose, and
this file states its whole surface honestly.

## What it touches

- **Reads and writes one file in your repo:** `.trailstone/decisions.yml`.
- **Runs `git`** (read-only, except `.git/hooks/pre-push` which `install` writes).
- **Writes `~/.claude/settings.json`** when you run `install`, to register four hooks.
  It appends its own entries; it does not remove yours. If a `pre-push` hook already
  exists in your repo, it prints the line to add rather than clobbering the file.
- **Appends a local log:** `~/.trailstone/fires.log` and `~/.trailstone/capture.log`
  (file paths and decision ids — no file contents).
- **No server, no account, no token, no telemetry.** Nothing is reported to us, ever.
  The precision numbers only reach us if *you* choose to paste `report --anon`.

## The one thing that leaves your machine

**Passive capture is on by default, and it sends your session transcript to Anthropic.**

The `Stop` hook detaches a cheap judge that runs the `claude` CLI (`claude -p`, Haiku)
over the end of the turn to propose decisions the turn made. That call goes out through
**your own `claude` CLI authentication**, to Anthropic's API, and the turn transcript is
the input. Trailstone adds no key of its own and no third party.

If that is not acceptable on your repo:

```bash
export TRAILSTONE_CAPTURE=0     # disables passive capture entirely
```

It is also a silent no-op when the `claude` binary is not on your PATH. Everything
else — recording, surfacing, staleness, the push guard — works fully offline.

## The ledger is as public as the repo it lives in

`.trailstone/decisions.yml` is a plaintext file committed with your code. It is readable —
including its full history, author names, and timestamps — by anyone who can read the repo.
On a public or shared repo, **your decisions are published.** Two things follow:

- **Never put secrets, credentials, or sensitive personal data** in decision text or
  `--why` rationale. Write "use the managed secret store, not env files", never the secret.
- **A confidential choice goes in the private ledger.** If a decision is sensitive — pricing,
  a competitive move, an unannounced pivot — record it with `--private`:

  ```bash
  trailstone decide "..." --why "..." --scope <paths> --private
  ```

  It is written to `.trailstone/private.yml`, which `install` adds to `.gitignore`, so it is
  **never committed or pushed**. It still works fully on your machine — it surfaces to the
  agent and flags stale work exactly like a public decision; the tool merges both ledgers on
  read. Reversing or validating a private decision stays private too. Point it at a store
  outside the repo entirely with `TRAILSTONE_PRIVATE=/path/to/private.yml`.

  The pre-push guard (`trailstone stale`) refuses the push if `private.yml` was ever
  force-added to git, and `trailstone doctor` reports whether it is safely untracked.

Rewriting history to remove an already-pushed *public* decision is possible (`git
filter-repo`) but imperfect once it is out — clones and forks keep their copies. The reliable
control is `--private`, or not recording it at all.

**Open-source maintainers:** if you dogfood Trailstone on the same repo you publish, your
public ledger becomes part of the release. That is often a feature ("it governs itself"); put
anything you would not want public in the private ledger, or keep the real ledger in a
gitignore your `.trailstone/decisions.yml` and commit a curated
`.trailstone/decisions.example.yml` instead (this is what Trailstone's own repo does).

## Availability is a security property here

These hooks sit in front of every prompt. A hook that exits non-zero **blocks the
user's prompt**. Trailstone therefore fails open on every path — no repo, no cwd,
deleted cwd, unknown event, malformed stdin all exit 0 with empty stderr — and
`--selfcheck` asserts this across all six failure modes. A change that can make a hook
exit non-zero is treated as a security bug, not a papercut.

## Reporting a vulnerability

Open a GitHub issue. This is a local, dependency-free tool with no network service and
no user data on our side, so there is no embargo process to respect — a public issue is
usually the fastest path to a fix.

If you believe a report genuinely should not be public (for example, it describes a way
to make the hooks block or corrupt a repo), open an issue saying only that you have a
security report and asking for a private channel, and we will arrange one.

## Scope

Out of scope: the content of your decisions, the correctness of your code, and anything
the `claude` CLI does under your own credentials. In scope: anything that lets
Trailstone block a prompt, corrupt a repo, write outside the paths listed above, clear a
stale flag it should not, or flag a file it should not.
