#!/bin/sh
set -eu

branch="$(git symbolic-ref --quiet --short HEAD 2>/dev/null || true)"
git_dir="$(git rev-parse --path-format=absolute --git-dir)"
git_common_dir="$(git rev-parse --path-format=absolute --git-common-dir)"

if [ "$git_dir" = "$git_common_dir" ]; then
  printf 'Current checkout is not a linked git worktree.\n' >&2
  exit 1
fi

raw_id="$(basename "$git_dir")"

worktree_id="$(printf '%s\n' "$raw_id" \
  | tr '[:upper:]' '[:lower:]' \
  | sed 's/[^a-z0-9-]/-/g' \
  | sed 's/^-*//;s/-*$//' \
  | sed -E 's/^.*-([a-f0-9]{7,12})$/\1/')"

if [ -z "$worktree_id" ]; then
  printf 'Could not derive worktree id from branch "%s" or git HEAD.\n' "$branch" >&2
  exit 1
fi

printf '%s\n' "$worktree_id"
