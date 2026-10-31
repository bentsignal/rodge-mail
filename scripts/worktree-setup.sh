#!/usr/bin/env bash
# Runs when T3 Code creates a worktree (t3.json): copies the main checkout's
# local env files, writes this worktree's shared/config overrides (its
# Portless host prefix), keeps a plain `git push` from ever pushing into the
# base branch, and installs dependencies.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
MAIN="${T3CODE_PROJECT_ROOT:-$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")}"

if [ "$MAIN" != "$ROOT" ]; then
  # Copies, not links, so a worktree can change its own.
  (
    cd "$MAIN"
    find . \( -name ".env" -o -name ".env.local" \) -not -path "*/node_modules/*" -not -path "*/.git/*"
  ) | while read -r file; do
    rel="${file#./}"
    mkdir -p "$(dirname "$ROOT/$rel")"
    cp "$MAIN/$rel" "$ROOT/$rel"
    echo "copied $rel"
  done
fi

cd "$ROOT"

if worktree_id="$(scripts/worktree-id.sh 2>/dev/null)"; then
  cat >shared/config/src/auth.ts <<EOF
export const sharedAuthIssuer: string | undefined = undefined;
export const sharedAuthJwksUri: string | undefined = undefined;
export const nativeAuthBasePath = "/api/mobile-auth";
EOF
  cat >shared/config/src/overrides.ts <<EOF
export const convexCloudUrl: string | undefined = undefined;
export const convexSiteUrl: string | undefined = undefined;
export const worktreeId: string | undefined = "${worktree_id}";
EOF
  git update-index --skip-worktree shared/config/src/auth.ts shared/config/src/overrides.ts
  echo "wrote shared/config overrides (worktreeId=${worktree_id}), marked skip-worktree"
fi

# A new branch can inherit its base as upstream; a plain `git push` must
# never push into the base branch.
branch="$(git branch --show-current)"
upstream="$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || true)"
if [ -n "$branch" ] && [ -n "$upstream" ] && [ "$upstream" != "origin/$branch" ]; then
  git branch --unset-upstream
  echo "cleared upstream $upstream; push with: git push -u origin HEAD"
fi

pnpm install --frozen-lockfile
