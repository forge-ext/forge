#!/usr/bin/env bash
# Run scenarios on one Forge build, each on a fresh sandbox, and print a summary.
#
#   sandbox/run-suite.sh [scenario ...]            default: all scenarios/*.py
#   FORGE_SRC=/path/to/forge SANDBOX_PROFILE=real sandbox/run-suite.sh 03 07
#
# Scenarios can be given by number (03) or file name. A scenario that needs something this
# machine or build doesn't have (an app, a setting) is reported as skipped, not failed. A line
# "# sandbox: second-monitor" in a scenario makes its sandbox start with a second monitor.
# Full output of each scenario goes to $SUITE_OUT (default
# ~/.cache/forge-sandbox/suite/<build>-<profile>/<scenario>.txt; <build> ends in -dirty-<hash of the
# changes> when the checkout has uncommitted changes, so a before/after pair never shares a directory).
# Watch it live with sandbox/watch.py &.
#
# Exit status: 0 if every scenario passed or was skipped, 1 otherwise.
set -uo pipefail
source "$(dirname "$0")/env.sh"
cd "$REPRO_ROOT"

PROFILE=${SANDBOX_PROFILE:-plain}
BUILD=$(git -C "$FORGE_SRC" rev-parse --short HEAD)
if [[ -n $(git -C "$FORGE_SRC" status --porcelain --untracked-files=no -- . ':!po') ]]; then
  BUILD=$BUILD-dirty-$(git -C "$FORGE_SRC" diff HEAD -- . ':!po' | sha1sum | cut -c1-7)
fi
OUT=${SUITE_OUT:-${XDG_CACHE_HOME:-$HOME/.cache}/forge-sandbox/suite/$BUILD-$PROFILE}
mkdir -p "$OUT"

if [[ $# -eq 0 ]]; then
  set -- scenarios/[0-9]*.py
fi

declare -a SUMMARY
failed=0
for arg in "$@"; do
  scenario=$(ls scenarios/"$arg"*.py 2>/dev/null | head -1)
  [[ -n $scenario ]] || scenario=$arg
  name=$(basename "$scenario" .py)
  second=${SANDBOX_SECOND_MONITOR:-}
  grep -q '^# sandbox: second-monitor' "$scenario" && second=${second:-1280x1024}
  sandbox/stop.sh >/dev/null
  if ! SANDBOX_SECOND_MONITOR=$second sandbox/launch.sh > "$OUT/$name.launch.txt" 2>&1; then
    SUMMARY+=("$name: sandbox failed to start (see $OUT/$name.launch.txt)")
    failed=1
    continue
  fi
  echo "== $name on $(cat "$SANDBOX_DIR/forge-version") [$PROFILE]"
  timeout 1200 "$scenario" > "$OUT/$name.txt" 2>&1
  status=$?
  grep -E "PASS|FAIL|SKIP|^ +- |RESULT|errors: [1-9]|Traceback|Error" "$OUT/$name.txt"
  result=$(grep -oE 'RESULT: .*' "$OUT/$name.txt" | tail -1)
  case $status in
    0) ;;
    77) result=${result:-skipped} ;;
    124) result="timed out after 1200 s${result:+ ($result)}"; failed=1 ;;
    *) result="${result:-no result} (exit $status, see output)"; failed=1 ;;
  esac
  SUMMARY+=("$name: $result")
done
sandbox/stop.sh >/dev/null

echo
echo "== summary: $BUILD [$PROFILE], outputs in $OUT"
printf '  %s\n' "${SUMMARY[@]}"
exit $failed
