# Changelog

## 0.2.2

**Push reaches Cursor, not just Claude Code.** A reversed decision arrives before a Cursor agent
edits a governed file, unasked — verified live with every pull surface removed (no `AGENTS.md`, no
Cursor rules, no MCP server), so the agent had no way to ask: it was told, re-checked the file
against the reversal, rewrote it, and declined to commit.

Be precise about which path was proven, because they are not equally tested:

- **Cursor importing your Claude Code hooks** — confirmed live. `hook` now detects which harness
  is calling and answers in that dialect, so anyone who has run `install` for Claude Code gets
  Cursor push with nothing further to do. This is the path the live test exercised.
- **`.cursor/hooks.json`**, for Cursor users without Claude Code — written by `install`, unit
  tested, and exercised end to end from the command line, but **never yet seen fire inside the
  Cursor GUI.**

Cursor can only reach an agent from `preToolUse` by *denying*, so a stale write is denied exactly
once, carrying the reversal, and the retry proceeds. Merely-governed edits are never blocked.

**Fixed — every one of these failed silently**

- **`install` outside a repo skipped the pre-push guard and said nothing.** The README told you to
  run it in that order, so following the instructions left you with the advisory half and no gate.
- **`stale` reported only ONE reversal per file.** Two reversed decisions governing one file: you
  re-checked the cause you were shown, validated, the flag cleared — and the file still rested on
  the other reversal. Keyed by file *and* reversal now.
- **`stale` said "clean" when there was no ledger at all**, so a CI gate on a repo whose ledger was
  never committed went green forever, gating nothing. It still exits 0 (a repo that never opted in
  must never be blocked) but no longer claims to have checked.
- **Every generated command said bare `node`** — the four Claude Code hooks, the pre-push guard,
  the Cursor wrapper. A GUI editor inherits no shell PATH, and bare `node` is absent from a clean
  one for anyone using nvm, fnm or asdf. They now carry the absolute node that ran `install`,
  resolved through realpath, with a PATH fallback.
- **A fresh Cursor user got no Cursor hooks at all**: `install` keyed off the repo already having a
  `.cursor/` directory, which a new repo does not. It now keys off the user having Cursor.
- `reverse` with an empty ref silently became `decide`: the old decision stayed in force, nothing
  went stale, and two contradictory rules sat in the ledger. Refused now.
- `validate` printed a confident "holds" while clearing nothing (a typo in `--scope`). It now
  reports what it actually cleared, and says so when that is nothing.
- `governing` answered "ungoverned" for a path that does not exist, a path outside the repo, and
  no path at all — telling an agent it was clear to proceed on ground the tool could not see.
- `decide` accepted a scope matching no tracked file as an ordinary success, recording a decision
  that reads as in force and can never fire.
- The capture judge's timeout was 90s; a trivial transcript already took 45s. Now 300s.
- `doctor` printed `✗ pre-push guard installed` — a cross beside the word "installed".

**How the last two were found, because it is the useful part.** Everything above was first tested
on a machine where Trailstone was already installed. Simulating a stranger — empty HOME, `npm i -g`
from the release tarball, a repo with no prior config — surfaced both immediately. A working setup
hides exactly the defects a new user hits first.

**Known limitation:** the live Cursor result is one run, one repo, one agent. The mechanism works;
how reliably it works is not yet measured.

## 0.2.1

**Fixed**

- **The version it reported was wrong.** `VERSION` was a hardcoded literal that never got
  bumped, so the published 0.2.0 announced itself as **0.1.0** to every MCP client and
  stamped 0.1.0 on every `report --anon` — misattributing the one number this project
  asks users to send back. It now reads `package.json`, and the selfcheck asserts the two
  can never drift again.
- **`trailstone --help` outside a git repo said "not a git repo" and exited 2.** That is
  precisely where a fresh `npm i -g trailstone` is first run. Help and `--version` now
  answer anywhere; only real commands hit the guard, and the guard says what to do about it
  (`cd` into a repo, `git init`, or `trailstone demo`).

**Added**

- `--version` / `-v` prints just the version; the help banner carries version and node.

## 0.2.0 — Apache-2.0

**Fixed**

- **`stale` was O(files) git processes.** It ran `git log -1` once per file in scope — 2000
  files took **11.3 seconds**, inside a hook that runs on every prompt. Now one `git log`
  builds the whole map: **0.13 seconds**, same results.
- **`git` calls had no `maxBuffer`**, so on a repo of roughly 30k+ files `git ls-files`
  exceeded node's 1 MB default, threw, was caught, and staleness silently stopped firing.
- `doctor` reported *"only 0/4 hooks installed"* while all four were live. `install`
  started quoting the script path, and doctor's regex could not match across the closing
  quote — a false "not watching" in the one command whose whole job is answering that.
  Hooks are now counted structurally, and the selfcheck asserts doctor sees what install
  wrote.

**Added**

- `uninstall` — removes the hooks and the pre-push guard it wrote. It deliberately leaves
  your ledger and any `AGENTS.md` block alone; those are your decisions and your repo.

**Changed**

- Licence is **Apache-2.0** (0.1.0 remains available under MIT). Equally permissive, plus
  an express patent grant and, via section 5, inbound contribution terms with no CLA.

## 0.1.0 — published to npm 2026-09-18 (MIT)

First release. The whole loop: record a decision with the files it governs, surface it to
your agent when it edits one of those files, and when the decision is reversed flag every
file that still rests on it — at edit time, at `git push`, and in CI.

- `init` / `decide` / `reverse` / `list` / `governing` / `validate` / `stale`
- Claude Code hooks (session, prompt, pre-edit, and passive capture at Stop)
- `mcp` — an MCP server on stdio for any MCP client (Cursor, Claude Desktop, Codex)
- `install` — wires the hooks, the pre-push guard, and an `AGENTS.md` rules block for
  harnesses without a hook API
- `doctor`, `report --anon`, `stats`, `demo`, `--selfcheck`

Licensing note: 0.1.0 shipped under MIT and stays available under MIT.
Everything from 0.2.0 on is Apache-2.0.
