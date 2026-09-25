# Changelog

## Unreleased

**Fixed — `install` on a repo it had already set up.** It reported its own pre-push hook as someone
else's and told you to add the line that hook already runs; it now recognises the hook it wrote,
refreshes the node and script paths in it (they change when you move between an npm install and a
local checkout), and never touches a pre-push it did not write. It now says when it adds
`.trailstone/private.yml` to `.gitignore`, and its closing line names every harness that gets the
pre-edit warning (Claude Code, Codex once trusted, Cursor), not Claude Code alone.

**Fixed — an agent editing a repo other than the one its session opened in got no warnings.** The
edit hook and the `Stop` drift check took the repo from the session's working directory and dropped
every path outside it as out of scope — silently, while `doctor` in the edited repo said "watching".
A session opened in one repo (or in a parent folder of several) that edited another was told nothing.
Both now follow each edited file to its own repo and ledger, and name files outside the session's repo
by full path. The `Stop` fetch now runs for the repos the agent edited, not for the session's folder.
Capture still asks only about the session's own repo, because `decide` writes to that ledger.

**Fixed — a ledger without a final newline swallowed the next decision.** `decide`, `reverse` and
`validate` append to `.trailstone/decisions.yml`; a file saved without a trailing newline (a hand edit,
a migration) got the new row glued onto its last line, so the row merged into the previous entry and
inherited its scope — a reversal then flagged files it never governed. Append now starts on a fresh line.

## 0.3.2

**New — Codex gets push.** Codex runs Claude-Code-shaped hooks from `~/.codex/hooks.json`; `install`
now writes them there when you have Codex, `uninstall` removes them, `doctor` reports them. Codex edits
arrive as `apply_patch` with the paths inside the patch, and the edit hook read only `file_path`, so it
had never fired on a Codex edit — now it reads every path in the patch. Codex runs a new or changed
hook only after you trust it: open `codex`, run `/hooks`, and trust the trailstone entries. `install`
says so and never sets `bypass_hook_trust`. Measured with Codex agents in worktrees and a reversal
mid-work: 1/9 reached before (the one ran the CLI itself), 6/6 after — the edit re-warning and the
Stop re-check both seen working in Codex.

**New — a reversal pushed from another clone reaches agents here.** Separate clones (cloud agents, a
teammate's machine) never saw a reversal someone pushed, because nothing fetched: 0/9 agents. The
decisions in force now also include `origin`'s copy of the default branch, and the hooks keep it fresh
— a background fetch at most every 30 s on session start and edits, a synchronous one (5 s cap) at
`Stop` and in the pre-push guard: 9/9. **This is trailstone's first network call:** a `git fetch` of one
ref from your own `origin`, with your git credentials, never prompting, failing open.
`TRAILSTONE_FETCH=0` turns it off. `SECURITY.md` spells it out.

Also verified with real agents: the private ledger in worktrees (15/15 reached, and no private text in
any commit or worktree). README's hook table updated for 0.3.x behaviour.

## 0.3.1

**Fixed — every hook fell silent in a repo reached through a symlink or a Windows short name.** git
reports the repository root with symlinks and short names resolved (`/private/var/…` on macOS,
`C:\Users\runneradmin\…` on Windows); a harness passes file paths as typed (`/var/…`, `RUNNER~1`). The
path comparison read every such file as outside the repo, so the edit hook, the Stop checks and capture
said nothing — no error, no warning. This is what the macOS and Windows CI jobs had been failing on
since 0.2.5, and it is the reason 0.3.0's CI is red. Paths are now compared by their real location
whenever the plain comparison says "outside"; a selfcheck assertion builds a symlinked repo to prove it.

## 0.3.0

**Fixed — agents in git worktrees and on feature branches never saw a reversal made on main.** Each
checkout read its own branch's copy of the ledger, so a decision reversed and committed on the default
branch reached no agent working in a worktree — and they kept being shown the reversed rule as current
(0/9 measured, one worktree per agent). The decisions in force are now this
checkout's ledger **plus** the ledger committed on the default branch (`origin/HEAD`, then
`init.defaultBranch`, then `main`/`master`; local refs only — a separate clone still needs a fetch).
Rows are append-only with unique ids, so the union is safe; rows that only the default branch has bind
here but are never written into this branch's file, and `ratify`/`reject` of one points you to that
branch. **The private ledger now follows the main checkout:** it is gitignored, so a new worktree had
none, and every private decision was invisible to agents working there. Also fixed: an internal ledger
rewrite could have copied private rows into the public file (no command reached it; now excluded).

**Fixed — a decision reversed while an agent works now reaches that agent's in-progress files.** With
several agents in one repo, one agent (or a human) reversing a decision reached every agent that
started a file afterwards — but an agent already mid-file kept the old rule, silently: the edit hook
spoke once per file per session, and `stale` skips uncommitted files, then reads the later commit as
"addressed" (0/3 such agents switched; in the same setup, updating CLAUDE.md
reached 0/9 running agents). Two changes: the edit hook now re-fires whenever the set of decisions
governing a file has changed since the agent last saw it, naming `was → now`; and at `Stop`, if a
decision governing any file the agent edited this session moved after it last saw that file, the
agent is asked once — before the turn ends, while it can still fix it — to re-check those files
(combined with the in-band capture ask when both apply).

**Fixed — on a busy file, the edit hook silently dropped the rules that mattered.** Before an edit,
the hook listed the decisions governing the file in ledger order and cut at 5. With a real-sized
ledger that means the 5 *oldest* broad rules: on a docs page 10 decisions governed, and a newer
`docs/` rule never reached the agent, which then broke it (2/6 followed vs 6/6 with the same rules in
CLAUDE.md). Governing decisions now rank the most specific scope
first (exact file, then the deepest directory), then newest; the edit hook shows up to 10; and
whatever the cap leaves out is named — `…and N more in force here — trailstone governing <file>` —
instead of disappearing.

## 0.2.5

**Changed — capture no longer spends a second model by default.** The default is now *in-band*:
when a turn that wrote a file ends, the `Stop` hook asks the agent that did the work, once, to
record any decision the turn committed to (`decide … --proposed`) or to say there was none. The detached `claude -p` haiku judge at `Stop` — which ran on every
turn, on the user's own plan or key, whether or not `claude` auth billed it the way they expected
— is now opt-in: `TRAILSTONE_CAPTURE=judge`. `TRAILSTONE_CAPTURE=0` still turns capture off.
`doctor` reports the mode. Measured first (42 headless sessions): same
recall as the judge, no false positives on typo/validation turns (the judge had one), rows that name
the rejected alternative, at about half the extra cost. Claude Code labels every Stop-hook block
"Stop hook error occurred" and no output shape avoids it, so the block carries a `systemMessage`
telling the user it is not an error. Asking at the turn's first edit instead avoids the label but
recorded unprompted decisions 3/6 against 9/9 (12 more sessions), so the ask stays at Stop.

**Fixed — the CI gate said "clean" on a shallow clone.** `actions/checkout` fetches one commit by
default, so every file's last commit is the tip, every file reads as touched after the reversal, and
`stale` printed `trailstone: clean.` over real stale files, exiting 0. `stale` now refuses on a shallow
clone when the ledger has a reversal to check (exit 1, naming `git fetch --unshallow` / `fetch-depth: 0`),
and `doctor` reports it.

**Fixed — a hand-edited ledger crashed `list`/`governing` or silently dropped decisions.** `scope:
[src/api/]` (flow list) or `scope: src/api/` (one path) parsed as a string, and `list` died with
`d.scope.join is not a function`. Both now read as lists, as do single-quoted scalars and a leading
`---`. Any other line the parser cannot read is no longer skipped in silence: `stale` exits 1 naming each
`file:line` (a dropped decision flags nothing, so it cannot pass as clean), and `doctor` reports them.
Hooks still fail open.

## 0.2.4

**Fixed — concurrent decisions from separate clones no longer conflict at merge.** The ledger is
append-only, so two clones each recording a decision add a row at EOF and a plain 3-way merge
collides there. `init` now writes a `.gitattributes` marking both ledgers `merge=union`, so git
keeps both sides instead of raising a conflict — the standard fix for an append log. Idempotent;
covered by `--selfcheck`. (Shared-worktree concurrent records were already safe via O_APPEND.)

Also a republish: the 0.2.3 on npm had drifted behind the repo under the same version number.

## 0.2.3

**Fixed — `.cursor/hooks/trailstone.sh` is committed, so it has to run on someone else's machine.**
It carried only this machine's absolute paths to node and to trailstone, which are meaningless in a
teammate's clone. It now tries those first (fastest, and the only thing that works when a GUI editor
has no PATH), then a `trailstone` on PATH, then `npx -y trailstone`. Verified by breaking the baked
path and confirming the fallback still denies a stale write.


## 0.2.2

**Push reaches Cursor, not just Claude Code.** A reversed decision arrives before a Cursor agent
edits a governed file, unasked — verified live with every pull surface removed (no `AGENTS.md`, no
Cursor rules, no MCP server), so the agent had no way to ask: it was told, re-checked the file
against the reversal, rewrote it, and declined to commit.

Both routes are confirmed live, on two different models:

- **`.cursor/hooks.json`** — the standalone path, for Cursor users with no Claude Code at all.
  Proven by instrumenting the wrapper so it could be told apart from the imported hooks: it fired
  16 times in one task (every tool call), denied the stale write, and the agent (grok-4.6) named
  the reversal and fixed the file.
- **Cursor importing Claude Code's hooks** — Cursor reads `~/.claude/settings.json` and calls
  those entries under its own event names, so `hook` detects which harness is calling and answers
  in that dialect. Anyone who has run `install` for Claude Code gets Cursor push with nothing
  further to configure.

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

`preToolUse` fires on *every* tool call, not just writes — 16 spawns in one task. The hook exits
before touching git for anything that is not a write: **88 ms per call, flat with repo size**
(measured on a 494-file repo).

**Known limitation:** two runs, one repo. The mechanism works on both routes and two models; how
reliably it works across real projects is not yet measured.

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
