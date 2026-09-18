# Changelog

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
