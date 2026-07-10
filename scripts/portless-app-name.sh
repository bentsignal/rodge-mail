#!/bin/sh
set -eu

if [ "$#" -ne 1 ]; then
  printf 'Usage: portless-app-name.sh <base-name>\n' >&2
  exit 1
fi

base_name="$1"
worktree_id="$("$(dirname "$0")/worktree-id.sh" 2>/dev/null || true)"

if [ -n "$worktree_id" ]; then
  printf '%s.%s\n' "$worktree_id" "$base_name"
else
  printf '%s\n' "$base_name"
fi
