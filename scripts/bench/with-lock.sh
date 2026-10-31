#!/usr/bin/env bash
# Serializes native builds across every repo on Shawn's Mac. The lock is
# Vera's (~/Library/Caches/vera/heavy.lock), which Vera and SYNQ also take,
# so a Rodge dev client build never overlaps theirs. Keep it in step with
# Vera's scripts/bench/with-lock.sh. Unlike Vera's it is re-entrant, so
# wrapping scripts/sim.sh in it doesn't deadlock on the build sim.sh locks.
#
#   scripts/bench/with-lock.sh <command> [args...]
set -euo pipefail
if [ -n "${RODGE_HEAVY_LOCK_HELD:-}" ]; then
  exec "$@"
fi
lock="$HOME/Library/Caches/vera/heavy.lock"
mkdir -p "$(dirname "$lock")"
said=""
until mkdir "$lock" 2>/dev/null; do
  if [ -n "$(find "$lock" -maxdepth 0 -mmin +90 2>/dev/null)" ]; then
    [ ! -f "$lock/owner" ] || unlink "$lock/owner"
    rmdir "$lock" 2>/dev/null || true
  fi
  if [ -z "$said" ]; then
    echo "waiting for the heavy-work lock: $(cat "$lock/owner" 2>/dev/null || echo "another build")" >&2
    said=1
  fi
  sleep 15
done
trap 'unlink "$lock/owner"; rmdir "$lock"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
printf '%s %s %s\n' "rodge-mail/$(basename "$(git rev-parse --show-toplevel 2>/dev/null || pwd)")" "$(date +%H:%M)" "$*" >"$lock/owner"
export RODGE_HEAVY_LOCK_HELD=1
"$@"
