#!/bin/bash
# Regenerate docs/demo.gif from `trailstone demo` (needs asciinema 3 + agg):
#   asciinema rec --overwrite --headless --window-size 150x30 -c scripts/record-demo.sh demo.cast
#   agg --font-size 16 --idle-time-limit 2.5 --last-frame-duration 6 --theme monokai demo.cast docs/demo.gif
# Paces the output, stops at the blocked push, drops the long advisory lines, and shortens the
# quoted rules on the three "changed while you worked" lines so they fit on one line each.
TS="$(cd "$(dirname "$0")/.." && pwd)/trailstone.mjs"
cd "${TMPDIR:-/tmp}"
node "$TS" demo 2>&1 \
 | awk '/was never governed/{exit} {print}' \
 | grep -v "This note is advisory\|Reconcile:\|Note: ANY commit\|^A throwaway repo" \
 | sed -E -e "s/\(Dana, [0-9-]+\) \[decision d_[0-9a-f]+\]//" -e "/changed while you worked/{s/\"Sessions use JWT in an Authorization header, not cookies\"/\"JWT in a header, not cookies\"/;s/\"Sessions use a signed HttpOnly cookie, not a JWT header\"/\"a signed HttpOnly cookie, not a JWT\"/}" \
 | while IFS= read -r l; do
     if [[ "$l" == '$ '* ]]; then printf '\e[1;36m'; for ((i=0;i<${#l};i++)); do printf '%s' "${l:$i:1}"; sleep 0.018; done; printf '\e[0m\n'; sleep 0.6
     elif [[ "$l" == *"changed while you worked"* || "$l" == *"push is blocked"* ]]; then printf '\e[1;33m%s\e[0m\n' "$l"; sleep 1.0
     elif [[ -z "$l" ]]; then echo; sleep 0.5
     else echo "$l"; sleep 0.35; fi
   done
sleep 3
