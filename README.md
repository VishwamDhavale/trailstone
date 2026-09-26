# trailstone

**You changed your mind. Your agents didn't.**

When a decision changes while AI agents are already working — yours in other worktrees, or a
teammate's in their own clone — trailstone gets the new rule to each of them at their next edit, and
blocks the push of any file still built on the old one. One script and one file in your repo. No
server, no account, no telemetry.

```bash
npx trailstone demo     # three agents, one reversal, ten seconds
```

![trailstone demo: three running agents are told the new rule at their next edit, and the push is blocked](https://raw.githubusercontent.com/VishwamDhavale/trailstone/main/docs/demo.gif)

```
Three agents start work on auth, each in its own session. Before each first edit, the hook tells it:
  agent 1 → src/auth/session.ts: "Sessions use JWT in an Authorization header, not cookies"
  agent 2 → src/auth/login.ts:   "Sessions use JWT in an Authorization header, not cookies"

$ trailstone reverse d_5913723e "Sessions use a signed HttpOnly cookie, not a JWT header"
now stale (3): src/auth/login.ts  src/auth/logout.ts  src/auth/session.ts

The three agents are still running. At each one's NEXT edit:
  agent 1 → src/auth/session.ts: ⚠ changed while you worked — was "…JWT…" → now "…signed HttpOnly cookie…"
  agent 2 → src/auth/login.ts:   ⚠ changed while you worked — was "…JWT…" → now "…signed HttpOnly cookie…"

$ git push
⚠️ STALE — these files were last committed BEFORE a decision governing them was reversed.
→ exit 1: the push is blocked.
```

**Why not just a CLAUDE.md?** We measured it. For rules that stay put, a CLAUDE.md holds as well as
trailstone — within a session, across sessions, against a drifting goal. And in the interactive
Claude Code app, an agent notices a CLAUDE.md edited *in its own checkout* mid-work (4 of 4 in our
runs; headless `claude -p` sessions did not, 0 of 9). What a CLAUDE.md cannot do is reach an agent
whose checkout never sees the edit: a teammate's pushed decision reached **0 of 3** clones that
hadn't pulled (trailstone: 3 of 3, via a fetch of origin's default branch), and a change committed
on `main` never alters the copy an agent in another worktree is reading (trailstone reads `main`'s
ledger too). That is where it earns its place: the rule moved somewhere the agent is not looking.

## What it does and doesn't catch (read this before judging it)

**It fires when a *decision* changes while code still rests on the old one — not when code
changes.** A `git revert` edits the very files in scope, and any edit clears the flag, so
reverting a commit fires nothing. The tool is for the case a revert can't see: you decide "cookies,
not JWT" in conversation, and three files written under the old rule are still sitting there green.

**A flag means "governed by," not "broken."** Reversing a directory-scoped decision flags every
file under it. In real use most of them still comply with the replacement and clear in seconds —
the flag's job is to force the re-check that catches the one file that doesn't. If you write
`--scope src/` you will get a big, noisy flag; if you write `--scope src/auth/session.ts` you get
a precise one. **`decide` tells you the file count up front** so you can narrow it before a future
reversal makes you re-check them all:

```
$ trailstone decide "Sessions use JWT headers, not cookies" --scope src/auth/
d_a1b2c3d4 recorded. scope src/auth/ covers 4 tracked files — a reversal will flag all 4 to re-check.
```

Scope discipline is the whole game: a tight scope is a sharp tool, a whole-directory scope is an
alarm you'll learn to ignore.

**It only watches the files you scope.** A decision's *prose* can still drift in a file no
decision names — a README that describes an approach you've since reversed, a stale comment. That
is real drift the tool will not flag, because it tracks scoped files, not every place a decision is
described. Scope the docs you want watched, and treat the rest as your job.

## Install

```bash
npm i -g trailstone                 # or use npx trailstone <command> everywhere below
cd your-repo                        # install must run INSIDE the repo
trailstone install                  # Claude Code (+ Codex) hooks, global + this repo's pre-push guard + AGENTS.md
trailstone init --goal "what this project is"
git add .trailstone AGENTS.md && git commit -m "trailstone: ledger"
trailstone doctor                   # confirms it is actually watching
```

**What `install` touches** — `trailstone uninstall` removes the hooks, the pre-push and the Cursor
files; the ledger, the `AGENTS.md` block and the `.gitignore` line are yours to delete: four hook entries in `~/.claude/settings.json` (and
`~/.codex/hooks.json` if you use Codex), this repo's `.git/hooks/pre-push`, a line in `.gitignore`
for the private ledger, a short block in `AGENTS.md`, and `.cursor/hooks.json` if you use Cursor.
Nothing else, and nothing leaves your machine.

**Run `install` from inside the repo.** Outside one it can only write the global Claude Code
hooks — you would get the warnings but *not* the pre-push guard that enforces them. It now
says so when that happens, and `doctor` tells you either way.

A repo without `.trailstone/decisions.yml` is silent — every hook exits immediately, so installing
globally costs nothing on repos that never opted in.

### In CI

```yaml
- uses: actions/checkout@v4
  with: { fetch-depth: 0 }      # the guard compares commit dates; it needs the history
- uses: vishwamdhavale/trailstone@v0.3.5
```

## The convention

One file, committed with your code: **`.trailstone/decisions.yml`**. A YAML list, one
entry per decision. The PR that adds a line *is* the review.

```yaml
# Trailstone decision ledger. One entry per decision: what was decided, why, and the
# paths it governs. Decisions are immutable — reverse one with a new entry carrying
# `supersedes: <id>`. Editing this file in a PR IS the review.
- id: d_6d0bf686
  at: 2026-09-01T11:04:12.882Z
  by: Dana
  decision: Sessions use JWT in an Authorization header, not cookies
  why: the API is called from a CLI too
  scope:
    - src/auth/

- id: d_259ab7a1                     # the reversal — a new entry, never an edit
  at: 2026-09-06T09:20:03.114Z
  by: Dana
  decision: Sessions use a signed HttpOnly cookie, not a JWT header
  why: XSS token theft; the CLI gets a separate PAT
  scope:
    - src/auth/
  supersedes: d_6d0bf686

- kind: validation                   # "I re-read this file; it still holds"
  id: v_968dc1c7
  at: 2026-09-06T09:41:55.001Z
  by: Dana
  decisionId: d_6d0bf686
  scope:
    - src/auth/session.ts
```

Fields: `id` (generated), `at` (ISO), `by` (git `user.name`), `decision` (what was
chosen, naming the alternative), `why` (optional), `scope` (globs / paths / dirs it
governs), `supersedes` (the id this reverses), `status` (`proposed` or `rejected` —
absent means it binds). Validation rows carry `kind: validation`, `decisionId`, and
the `scope` they re-checked, plus `wrong: true` for a false-positive fire.

**Three rules, and that is the whole engine:**

1. **Immutable.** You never edit a decision. Changing your mind is a new entry with
   `supersedes: <id>`. A decision that something supersedes stops binding.
2. **Stale** = a tracked file whose *last commit predates* a reversal of a decision
   whose `scope` matches it. Scope match is exact path, directory prefix, or glob —
   never fuzzy.
3. **Clears** three ways: edit the file in the working tree, commit it after the
   reversal, or add a `validation` row naming the decision (dated after the reversal).

`status: proposed` binds nothing: not in force, never flags anything stale.

## What the hooks do

`install` adds four Claude Code hooks to `~/.claude/settings.json` — and, if you have Codex, the
same four to `~/.codex/hooks.json` — and writes `.git/hooks/pre-push` in the current repo (if a
pre-push already exists it prints the line to add instead of clobbering it). **Codex runs new hooks
only after you trust them:** open `codex`, run `/hooks`, and trust the trailstone entries (once, and
again after an upgrade changes them).

| Hook | What it injects |
|---|---|
| `SessionStart` | One line: repo name, decisions in force, proposals pending — plus the stale block if any. |
| `UserPromptSubmit` | Decisions relevant to *this* prompt: the ones governing files you already touched this session, then a lexical top-up (≥2 shared words) — each labelled with why it surfaced. Plus stale. Capped at 5 + 5 proposals, never padded; silent when nothing matches. |
| `PreToolUse` (Edit/Write/MultiEdit/NotebookEdit; Codex `apply_patch`) | Before the write lands: the decisions governing each file it touches — most specific scope first, then newest, up to 10, naming any it leaves out — and a stale warning if it has one. **Once per file per rule set per session**: silent on repeat edits, but if a decision governing the file changes while the agent works (someone reversed it mid-session), the next edit says `was → now`. |
| `Stop` | **Drift check:** if a decision governing any file the agent edited this session was reversed after it last saw that file's rules, the agent is asked **once** to re-check those files before the turn ends. **Capture:** after a turn that wrote a file *and looks like it chose something*, it asks the agent **once** to record anything the turn committed to (`decide … --proposed`) — see *Recording decisions*. Claude Code labels these "Stop hook error occurred"; Trailstone's note beside it says it is not. `TRAILSTONE_CAPTURE=always` asks after every editing turn; `=judge` swaps in the opt-in judge; `=0` turns capture off. |

Budget: the caps above mean a typical injection is a handful of lines; the largest
is SessionStart with a long stale list, which is one line per stale file. Nothing
dumps the ledger.

**Parallel agents.** The decisions in force are this checkout's ledger plus the one committed on the
default branch — locally and on `origin` — so a reversal committed on `main` reaches agents in other
worktrees and on feature branches, and one pushed from another clone reaches this one. To see a push,
the hooks fetch origin's default branch: in the background (at most every 30 s) on session start and
edits, and synchronously (5 s cap) at `Stop` and in the pre-push guard. They never prompt for
credentials and fail open; `TRAILSTONE_FETCH=0` turns fetching off. A linked worktree shares the main
checkout's private ledger.

`pre-push` runs `stale` and **exits 1** when a stale file is about to be pushed.

## Other agents — Codex, Cursor, Claude Desktop, …

The ledger is a plain file in your repo, so anything can read it. Two portable surfaces
ship today.

**1. Agent rules — works everywhere.** `trailstone install` writes a short block into
`AGENTS.md` (and into `.cursor/rules/trailstone.mdc` if the repo already uses Cursor),
telling any agent to run `governing <file>` before it edits and to honor what comes back.
Commit it, and every agent your team uses reads it at session start. `--no-rules` skips it.

**2. An MCP server — any MCP client.** `trailstone mcp` speaks MCP over stdio, with six
tools: `list_decisions`, `governing`, `stale`, `decide`, `reverse`, `validate`. No
dependencies, nothing to install beyond this script.

```json
{
  "mcpServers": {
    "trailstone": {
      "command": "npx",
      "args": ["-y", "trailstone", "mcp", "--repo", "/absolute/path/to/your/repo"]
    }
  }
}
```

`--repo` (or the `TRAILSTONE_REPO` env var) matters for desktop clients, which launch MCP
servers with an arbitrary working directory. A terminal agent already sitting in the repo
can leave it out. Leave it out and the server still starts — the first tool call then tells
the agent to pass its project path as the `repo` argument, which agents do recover from.

> **Claude Desktop: quit it before you edit the file.** Claude Desktop holds its MCP config in
> memory and writes `claude_desktop_config.json` back **on quit**, so an edit made while it is
> running is silently reverted when you close it — the app restarts looking perfectly configured,
> pointed wherever it was before. Quit it fully, then edit, then start it: that survives. (Its
> **Settings → Local MCP servers → Edit config** button just reveals the file, and on Linux may
> only open the folder.) Cursor and Codex read their config files normally and can be edited any
> time.
>
> On Claude Desktop, consider leaving `--repo` **out**. It has no notion of a "current project",
> so a pinned repo means every question is answered from that one repo without ever saying so.
> With no `--repo` the first call asks the agent for the project path, and the repo is then
> explicit in the conversation.

**3. Cursor hooks — push, not pull.** If you have Cursor, `install` also writes
`.cursor/hooks.json` (merging into any hooks you already have). Cursor additionally *imports*
Claude Code's hooks and calls them under its own event names, which Trailstone answers too — so
push works whether or not you have Claude Code. Both routes are verified against a live Cursor
agent. `sessionStart` injects the
goal, the decisions in force and anything stale; `preToolUse` **denies a write to a stale file
exactly once**, handing the agent the reversal, and allows the retry. That one-time deny is the
only way Cursor lets a hook reach the agent before an edit — and it fires only on files that are
already blocked at push, so it interrupts nothing that was not going to be stopped anyway.

**Codex hooks — push, once trusted.** Codex runs the same hook shape from `~/.codex/hooks.json`;
`install` writes it when `~/.codex` exists. Codex edits arrive as `apply_patch`, which trailstone reads
for the paths it touches. Codex skips any new or changed hook until you trust it in `/hooks`, so
nothing reaches a Codex agent until you do that once.

**The honest limit.** Push — the warning arriving *unasked, before the edit* — works in Claude
Code, Codex (after `/hooks`) and Cursor. Windsurf and Claude Desktop are pull-only: the agent has to
ask, and agents do not reliably remember to. A hook shim for one of those is the most valuable
contribution to this project.

## CLI

```
init                          create .trailstone/decisions.yml (commit it)
goal "<what this project is>"  set the goal every session sees; run from an AI agent's shell it is only
                              PROPOSED until you `ratify` it — an agent never changes the goal by itself
decide "<what>" --why "<why>" --scope src/auth/,src/api/tokens.ts
reverse <id> "<new decision>" [--why ...] [--scope ...]   # inherits the old scope if omitted
list [--all]                  decisions in force (--all includes superseded/proposed/rejected)
governing <file>              which decisions bind this file
validate <id> --scope <file>  "I re-checked it; it holds" — clears the stale flag
validate <id> --scope <file> --wrong   the fire was a false positive; the file never rested on it
stats                         fires by surface, and precision (right vs wrong)
report [--anon] [--json]      paste-ready summary: ledger, fires, precision, current stale
demo [--keep]                 the whole loop on a throwaway repo, in ten seconds
proposed                      pending captures
ratify <id> / reject <id>     accept or drop one
stale                         the guard: prints stale files, exit 1 (exit 0 = clean)
doctor                        is Trailstone watching this repo? exit 1 if installed but blind
capture-health                the last 5 judge runs; exit 1 if the last one failed
hook                          Claude Code hook dispatch (stdin JSON) — not for humans
install                       wire the hooks + pre-push
uninstall                     remove that wiring (leaves your ledger alone)
```

Real example:

```bash
trailstone decide "Sessions use JWT in an Authorization header, not cookies" \
  --why "the API is called from a CLI too" --scope src/auth/
trailstone reverse d_6d0bf686 "Sessions use a signed HttpOnly cookie, not a JWT header"
# → now stale (1):  src/auth/session.ts
```

## Recording decisions

**The agent that is doing the work records it.** When a turn that wrote a file ends *and looks like it
chose something* — the user stated a rule ("not", "never", "from now on"), the agent said what it
picked over what ("instead of", "rather than"), or it created a new file — the `Stop` hook asks the
agent once: did this turn commit to a choice that rules out an alternative — its own
or the user's? If so, record it with `decide "X, not Y" --scope <files> --proposed`; if not, say
"No decision to record." No second model and no second call: it is one short extra reply in the
session you are already running and paying for. Claude Code shows any Stop-hook ask as "Stop hook
error occurred" — there is no output shape that avoids it — so Trailstone puts its own line beside
it: *not an error — asking the agent to record this turn's decisions*. That label is why routine edits
(a typo, a validation fix) are not asked about: on 36 recorded sessions the signals above fired on 0 of
12 no-decision turns and 24 of 30 turns that made a choice. `TRAILSTONE_CAPTURE=always` asks every time. The `trailstone-decide` skill says the same for when a human or agent wants to record
by hand. State the alternative in the text ("X, not Y") so a later reversal reads as a diff.

Why this and not a background judge: measured over 42 headless sessions, agents that choose
something *themselves* (storage, pagination style, an id scheme) recorded it unasked only 3 times
in 18 — asked once, they recorded 9 of 9, each naming what it rejected, with no false positives on
typo and validation turns. The separate judge matched that recall at about twice the extra cost,
with a false positive and duplicate rows. The same ask delivered earlier, at the turn's first edit
(where no label appears), recorded unprompted decisions only 3 of 6 — asked at the end, the agent
has just finished the choice; asked at the start, the note has faded by then. Turn capture off
with `TRAILSTONE_CAPTURE=0`.

**Opt-in: the capture judge.** `TRAILSTONE_CAPTURE=judge` adds a detached `claude -p` judge
(haiku, ~$0.05–0.10 per turn, on your own `claude` login) at the end of every turn, appending
anything that looks like a decision as `status: proposed`. It needs the `claude` CLI on your
PATH; without it the hook exits silently. A judge run that dies (expired auth, timeout) is
invisible by design — the worker is detached — so every run logs one line to
`~/.trailstone/capture.log`; `capture-health` prints the last five and exits 1 if the last one
failed.

**If Trailstone seems quiet, run `doctor` before believing the ledger is empty.** Every hook here
fails open — it can never block your prompt — which means a hook that is *blind* looks exactly
like a hook with nothing to say. `doctor` reports the repo, the ledger and whether it is
committed, the four hooks, the pre-push guard and the last judge run, and exits 1 if anything
is missing. The most common cause is the simplest: your session is sitting one directory
*above* the repo, so there is no `.git` to walk up to. `doctor` looks one level down and names
the directory you should be in.

Proposals bind nothing: not in force, never flag anything stale, until a human ratifies.
Review them as what they are — a diff in a file you own:

- keep it: delete the `status: proposed` line in your editor, or `ratify <id>`
- drop it: delete the entry, or `reject <id>` to keep the record

## What it deliberately does not do

- **No server, no token, no account.** Git already gives provenance (blame),
  membership (who can push), review (the PR), and sync (clone).
- **No plan, no steps, no DAG.** It tracks decisions and files, not work.
- **No semantic judging of what is stale.** Staleness is git timestamps and glob
  membership, full stop.
- **No fuzzy matching on anything that gates.** The lexical prompt match only
  *surfaces* a decision to the agent; it can never flag a file or fail a push.
  A false stale flag is worse than a missed one.
- **It does not follow file renames.** Scope is a path; `git mv`-ing a governed
  file to a new name silently drops it from that decision's scope until you
  re-scope (record a new decision naming the new path). Following renames would
  mean heuristic rename detection *in the gate*, and the gate stays exact, never
  heuristic — so this is on you: after a rename, re-scope the decision.
- **It does not auto-merge concurrent decisions.** Two branches that each append
  a decision produce an ordinary git conflict in `.trailstone/decisions.yml`; resolve
  it by keeping both entries. The append-only list makes this the easy kind of
  conflict, but it is still a manual resolve.

## The one metric

Fires that were right versus fires that were wrong. Nothing else.

**What it looked like on a real project.** One reversal on a 79-file product repo flagged
**9 governed files**: 7 were re-checked and still held, 1 genuinely needed rework, and 1 was
a false positive the developer marked `--wrong`. **89% precision.** That is the shape to
expect — most flagged files still comply, and the flag's job is to force the re-check that
finds the one that does not. (Measured, not projected; it was a deliberate re-validation
sweep after a real decision changed, not a surprise catch.)

When a stale warning fires and the file genuinely needed re-checking, `validate <id>
--scope <file>` records the good fire. When it fired on a file that never rested on
that decision, `validate <id> --scope <file> --wrong` records the false positive.
`stats` prints fires by surface and the resulting precision. If precision drops,
scopes are too broad — narrow them; do not soften the rule.

**Fires are the rare event; surfacings are the denominator.** A healthy repo goes a
long time with zero fires — that does not mean the tool did nothing, it means every
decision it surfaced still held. So `stats` also counts every time a governing decision
was actually *put in front of someone* — split into **pushed** to the agent unasked
(the session/prompt/edit hooks, MCP) and **pulled** on demand (`governing`, `list`). A
clean repo then reads `surfaced 40×, fired 0` instead of an empty log — the difference
between "kept the agent on course 40 times" and "was never even consulted". (This is a
count of exposure, not proof the agent obeyed — that only a reversal it honors can show.)

`report` is the same numbers in a form you can paste into an issue; `report --anon`
drops every name and reduces each path to its extension, so it is shareable from a
private repo. That is how a maintainer learns whether the fires were any good.

## Roadmap

- A GitHub App turning `stale` into check-run annotations on the exact lines.
- `import`/export so a hosted, cross-repo team view can read the same yml.
- Windsurf and other harnesses via their own hook shims over the same file.
- A `git blame`-shaped `history <file>`: every decision that ever governed it.
- Scope suggestions from the diff, so `decide` rarely needs `--scope` typed by hand.

## Contributing

- **[VISION.md](VISION.md)** — the idea, the invariants, and an honest list of what this
  does not do. Read it before judging the tool or proposing a change.
- **[CONTRIBUTING.md](CONTRIBUTING.md)** — how to work on it, and what gets declined on
  principle (dependency cascade, servers, fuzzy gates).
- **[AGENTS.md](AGENTS.md)** — instructions for AI agents contributing to this repo.
- **[SECURITY.md](SECURITY.md)** — the whole surface, including the one thing that leaves
  your machine (the opt-in capture judge).

The most useful thing you can send back is not a star — it is `trailstone report --anon`:
how often the stale warning fired on your repo, and whether those fires were right.
