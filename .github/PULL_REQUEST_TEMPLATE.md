## What this changes

<!-- One or two sentences. If it fixes a bug, name the wrong behaviour. -->

## Checklist

- [ ] `node trailstone.mjs --selfcheck` passes
- [ ] Non-trivial logic has an assertion added to `--selfcheck`
- [ ] Still **one file, zero dependencies** (no new package, no build step)
- [ ] Hooks still **fail open** — every path exits 0 with empty stderr
- [ ] Nothing that *gates* became fuzzy (staleness stays exact scope + supersession)
- [ ] The diff is scoped to the change (no whole-file reformatting)

## If this changes behaviour

Record it in the ledger — the line you add to `.trailstone/decisions.yml` is the review:

```bash
node trailstone.mjs decide "what you chose, not Y" --why "the reason" --scope trailstone.mjs
```

- [ ] Decision recorded, or N/A (no behaviour change)

## Anything you could not verify

<!-- Be honest. Skipped checks and untested paths are more useful stated than hidden. -->
