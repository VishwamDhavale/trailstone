#!/bin/bash
# Regenerate docs/demo.gif from a real `trailstone demo` run (needs asciinema 3 + agg):
#   asciinema rec --overwrite --headless --window-size 80x20 -c scripts/record-demo.sh demo.cast
#   agg --font-size 18 --idle-time-limit 2 --last-frame-duration 6 --theme monokai demo.cast docs/demo.gif
# Every line below is parsed from the demo's actual output (ids, files, the hook's was → now, the stale
# count) and only shortened to fit 80 columns. A hook line that did not say was → now is shown as-is.
TS="$(cd "$(dirname "$0")/.." && pwd)/trailstone.mjs"
OUT="$(cd "${TMPDIR:-/tmp}" && node "$TS" demo 2>&1)"
short() { sed -e 's/Sessions use JWT in an Authorization header, not cookies/JWT headers, not cookies/g' \
              -e 's/Sessions use a signed HttpOnly cookie, not a JWT header/signed HttpOnly cookies/g'; }
C=$'\e[1;36m' Y=$'\e[1;33m' G=$'\e[2m' R=$'\e[0m'
type_() { printf '%s$ ' "$C"; local s="$1"; for ((i=0;i<${#s};i++)); do printf '%s' "${s:$i:1}"; sleep 0.012; done; printf '%s\n' "$R"; sleep 0.4; }
line() { printf '%s\n' "$1"; sleep "${2:-0.25}"; }
d1=$(grep -o 'decide ".*' <<<"$OUT" | head -1)
id=$(grep -oE 'reverse d_[0-9a-f]{8}' <<<"$OUT" | head -1 | cut -d' ' -f2)
n=$(grep -oE 'now stale \([0-9]+\)' <<<"$OUT" | grep -oE '[0-9]+')
type_ "trailstone $(short <<<"$d1")"
line ""
line "Three agents start work on src/auth/. Before each first edit, each is told:" 0.4
grep -E '^  agent [0-9] → ' <<<"$OUT" | grep -v 'changed while' | short | sed -E 's#  agent ([0-9]) → src/auth/([a-z]+\.ts): (.*)#\1 \2 \3#' | while read -r a f t; do line "$(printf '  agent %s · %-11s %s' "$a" "$f" "$t")"; done
line ""
type_ "trailstone reverse $id \"signed HttpOnly cookies, not JWT\""
line "${G}now stale ($n): files built on the old rule${R}" 0.6
line ""
line "The agents are still running. At each one's next edit:" 0.4
grep 'changed while you worked' <<<"$OUT" | short | sed -E 's#  agent ([0-9]) → src/auth/([a-z]+\.ts): ⚠ changed while you worked — was "([^",]+)[^"]*" → now "([^"]+)"#\1|\2|\3|\4#' \
  | while IFS='|' read -r a f w n2; do line "$Y$(printf '  agent %s · %-11s ⚠ was %s → now %s' "$a" "$f" "$w" "$n2")$R" 0.35; done
sleep 0.6
line ""
type_ "git push              ${G}# the pre-push hook runs trailstone stale${R}"
grep -q 'the push is blocked' <<<"$OUT" && line "$Y⚠ $n files still rest on the reversed decision → push blocked$R" 1
line ""
line "${G}A CLAUDE.md edited mid-work reached 0 of 9 running agents (measured).${R}" 0.2
sleep 4
