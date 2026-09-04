#!/usr/bin/env bash
# ZOOM_ALONE_TICK_UNIT — run the computeZoomAloneTick unit suite.
# Release 260904-zoom-alone-timeout. Exit 0 = pass; last stdout line = reason.
set -u
ROOT="${ROOT:-$(git rev-parse --show-toplevel)}"
CORE="$ROOT/services/vexa-bot/core"
TEST="src/platforms/zoom/web/alone-tick.test.ts"

if [ ! -f "$CORE/$TEST" ]; then
  echo "test file missing: $TEST" >&2
  exit 1
fi
if ! command -v npx >/dev/null 2>&1; then
  echo "npx unavailable on this host — cannot prove ZOOM_ALONE_TICK_UNIT" >&2
  exit 1
fi

out=$(cd "$CORE" && npx tsx "$TEST" 2>&1)
code=$?
summary=$(printf '%s\n' "$out" | grep -E '[0-9]+ passed' | tail -1)
if [ "$code" -ne 0 ]; then
  printf '%s\n' "$out" | grep FAIL >&2
  echo "${summary:-alone-tick.test.ts failed (exit $code)}" >&2
  exit 1
fi
echo "${summary:-passed}"
