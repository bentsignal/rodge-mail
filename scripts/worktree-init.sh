#!/bin/sh
set -eu

NEW_WT="$PWD"
MAIN_REPO="$(dirname "$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null)")"
if [ -n "$MAIN_REPO" ] && [ "$MAIN_REPO" != "$NEW_WT" ]; then
  cd "$MAIN_REPO"
  for f in $(find . \( -name ".env" -o -name ".env.local" \) -not -path "*/node_modules/*" -not -path "*/.git/*"); do
    rel="${f#./}"
    dest="$NEW_WT/$rel"
    mkdir -p "$(dirname "$dest")"
    cp "$f" "$dest"
    echo "copied $rel"
  done
  cd "$NEW_WT"
fi

WORKTREE_ID="$("$NEW_WT/scripts/worktree-id.sh")"

cat > shared/config/src/auth.ts <<EOF
export const sharedAuthIssuer: string | undefined = undefined;
export const sharedAuthJwksUri: string | undefined = undefined;
EOF
echo "generated auth.ts"
git update-index --skip-worktree shared/config/src/auth.ts
echo "marked auth.ts as skip-worktree"

cat > shared/config/src/overrides.ts <<EOF
export const convexCloudUrl: string | undefined = undefined;
export const worktreeId: string | undefined = "${WORKTREE_ID}";
EOF
echo "generated overrides.ts (worktreeId=${WORKTREE_ID})"
git update-index --skip-worktree shared/config/src/overrides.ts
echo "marked overrides.ts as skip-worktree"

pnpm install
