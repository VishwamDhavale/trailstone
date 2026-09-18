# trailstone

**A decision ledger that lives in your repo.** When a decision is reversed, trailstone flags
every file the decision governed, so it gets re-checked before you build further — in your AI
agent's context the moment it opens one, and at the push. Most flagged files will still be
fine; the point is that the one that isn't no longer slips through green.

```bash
npx trailstone demo     # the whole idea, on a throwaway repo, in ten seconds
```

Real work with an AI is weeks of sessions. Every message steers a little, and what was decided
three sessions ago quietly stops governing the work. Worse: when a decision is *reversed*,
everything built on the old one stays finished, green, and wrong.

trailstone is one file in your repo and one script. No server, no account, no telemetry.

```
$ trailstone reverse d_6d0bf686 "Sessions use a signed HttpOnly cookie, not a JWT header"
d_259ab7a1 recorded (supersedes d_6d0bf686).
now stale (1):
  src/auth/session.ts

$ git push
⚠️ STALE — these files were last committed BEFORE a decision governing them was reversed.
  - src/auth/session.ts — was: Sessions use JWT in an Authorization header, not cookies
                          → now: Sessions use a signed HttpOnly cookie, not a JWT header (Dana, 2026-09-06)
→ exit 1: the push is blocked.
```

Your agent sees the same warning *before* it edits the file, with the old text and the new one,
so it re-checks the work instead of building on ground that moved.

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

## Install

```bash
npm i -g trailstone                 # or use npx trailstone <command> everywhere below
cd your-repo                        # install must run INSIDE the repo
trailstone install                  # Claude Code hooks (global) + this repo's pre-push guard + AGENTS.md
trailstone init --goal "what this project is"
git add .trailstone AGENTS.md && git commit -m "trailstone: ledger"
trailstone doctor                   # confirms it is actually watching
```

**Run `install` from inside the repo.** Outside one it can only write the global Claude Code
hooks — you would get the warnings but *not* the pre-push guard that enforces them. It now
says so when that happens, and `doctor` tells you either way.

A repo without `.trailstone/decisions.yml` is silent — every hook exits immediately, so installing
globally costs nothing on repos that never opted in.

### In CI

```yaml
- uses: actions/checkout@v4
  with: { fetch-depth: 0 }      # the guard compares commit dates; it needs the history
- uses: vishwamdhavale/trailstone@v0.2.0
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

`install` adds four Claude Code hooks to `~/.claude/settings.json` and writes
`.git/hooks/pre-push` in the current repo (if a pre-push already exists it prints
the line to add instead of clobbering it).

| Hook | What it injects |
|---|---|
| `SessionStart` | One line: repo name, decisions in force, proposals pending — plus the stale block if any. |
| `UserPromptSubmit` | Decisions relevant to *this* prompt: the ones governing files you already touched this session, then a lexical top-up (≥2 shared words) — each labelled with why it surfaced. Plus stale. Capped at 5 + 5 proposals, never padded; silent when nothing matches. |
| `PreToolUse` (Edit/Write/MultiEdit/NotebookEdit) | Before the write lands: the decisions governing that exact file, and a stale warning if it has one. **Once per file per session** (remembered in a tmpfile, last 50 files), so a loop of edits does not repeat itself. |
| `Stop` | Passive capture, **on by default**. Detaches immediately — the session never waits — and writes anything it judged a real decision as `status: proposed`. Needs the `claude` CLI on your PATH (without it the hook exits silently); `TRAILSTONE_CAPTURE=0` disables it. |

Budget: the caps above mean a typical injection is a handful of lines; the largest
is SessionStart with a long stale list, which is one line per stale file. Nothing
dumps the ledger.

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

**The honest limit: both of these are _pull_, not _push_.** The agent has to ask. Only
Claude Code gets the warning injected *before* the edit without being asked — and that is
the part that actually changes behaviour, because agents do not reliably remember to ask.
A hook shim that gets pre-edit surfacing working in another harness is the single most
valuable contribution to this project.

## CLI

```
init                          create .trailstone/decisions.yml (commit it)
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

**Explicit first.** You run `decide` when you make a call. Your agent runs the same
command the moment it says "decided" — the `trailstone-decide` skill in
`.claude/skills/trailstone-decide/` tells it when and how. An explicit decision is a real
choice that forecloses an alternative; state the alternative in the text
("X, not Y") so the reversal reads as a diff.

**Passive second — and it is what actually fills the ledger.** The `Stop` hook is **on by
default**: at the end of every turn it detaches a cheap `claude -p` judge (haiku, ~$0.05–0.10
per turn) that appends anything that looks like a decision with `status: proposed`. It needs
the `claude` CLI on your PATH; without it the hook exits silently. Turn it off with
`TRAILSTONE_CAPTURE=0`. A judge run that dies (expired auth, timeout) is invisible by design — the
worker is detached — so every run logs one line to `~/.trailstone/capture.log`; `capture-health`
prints the last five and exits 1 if the last one failed.

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

`report` is the same numbers in a form you can paste into an issue; `report --anon`
drops every name and reduces each path to its extension, so it is shareable from a
private repo. That is how a maintainer learns whether the fires were any good.

## Roadmap

- A GitHub App turning `stale` into check-run annotations on the exact lines.
- `import`/export so a hosted, cross-repo team view can read the same yml.
- Codex, Cursor, and other harnesses via their own hook shims over the same file.
- A `git blame`-shaped `history <file>`: every decision that ever governed it.
- Scope suggestions from the diff, so `decide` rarely needs `--scope` typed by hand.

## Contributing

- **[VISION.md](VISION.md)** — the idea, the invariants, and an honest list of what this
  does not do. Read it before judging the tool or proposing a change.
- **[CONTRIBUTING.md](CONTRIBUTING.md)** — how to work on it, and what gets declined on
  principle (dependency cascade, servers, fuzzy gates).
- **[AGENTS.md](AGENTS.md)** — instructions for AI agents contributing to this repo.
- **[SECURITY.md](SECURITY.md)** — the whole surface, including the one thing that leaves
  your machine (the optional capture judge).

The most useful thing you can send back is not a star — it is `trailstone report --anon`:
how often the stale warning fired on your repo, and whether those fires were right.
