# Changelog

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
