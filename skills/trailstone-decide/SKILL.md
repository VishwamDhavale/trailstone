---
name: trailstone-decide
description: Record or reverse a project decision in the repo's Trailstone ledger. Use when you or the user make a real choice that forecloses an alternative ("use X not Y", "we'll go with", "decided", "switch from A to B", "let's drop"), reverse an earlier one ("revert that decision", "actually, go back to"), or when a STALE warning appears.
---

# Recording decisions

Invoke `A=$(git rev-parse --show-toplevel)/scripts/trailstone.mjs` (or the path named
in the SessionStart context).

## When

A **decision** is a commitment that constrains future work and could be reversed:
"Postgres, not Dynamo". Record it the moment it is made. Do **not** record:

- an implementation move ("added an OwnerChip component", "fixed the portal mount")
- a tuning knob (timeout 30s, cap of 5, a retry count)
- an observation ("the tests are slow", "prod runs the full server")
- a deferral ("we'll look at Stripe later") — nothing is foreclosed yet
- process narration ("I'll read the file first", "next I'll run the tests")

## How

```bash
node $A decide "Sessions use a signed HttpOnly cookie, not a JWT header" \
  --why "XSS token theft; the CLI gets a separate PAT" --scope src/auth/,src/api/login.ts
node $A reverse d_6d0bf686 "Sessions use JWT in an Authorization header, not cookies" --why "..."
```

Name the alternative in the text ("X, not Y") — the reversal has to read as a diff.
`--scope` is the paths the decision *governs*, not the paths you happened to edit.

## When a STALE warning appears

It names `was:` and `now:`. Do not silently fix, and do not ignore it:

1. Re-read the flagged file against the **now** decision.
2. Tell the user in three lines: what changed, what you re-checked, what you propose.
3. Then: edit + commit the fix, or `node $A validate <decisionId> --scope <file>` if
   the work genuinely still holds, or `... --scope <file> --wrong` if the file never
   rested on that decision at all (a false positive — this is the precision metric).

## The human outranks the ledger

If the user explicitly asks for something a recorded decision forbids, do it — and
record it as a new decision superseding the old one:
`node $A reverse <id> "<what they asked for>" --why "user-authorized"`.
Never refuse the user because of the ledger, and never obey them silently either.
