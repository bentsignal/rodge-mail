#!/bin/sh
set -eu

NEW_WT="$PWD"
MAIN_REPO="$(dirname "$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null)")"
if [ -z "$MAIN_REPO" ] || [ "$MAIN_REPO" = "$NEW_WT" ]; then
  MAIN_REPO="$NEW_WT"
fi

BRANCH_NAME="$(git symbolic-ref --quiet --short HEAD 2>/dev/null || true)"
HEAD_SHA="$(git rev-parse --short HEAD)"
PORTLESS_WORKTREE_ID="$("$NEW_WT/scripts/worktree-id.sh")"
WT_NAME="$(printf '%s\n' "${BRANCH_NAME:-worktree-$PORTLESS_WORKTREE_ID}" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g' | sed 's/^-*//;s/-*$//')"

if [ -z "$WT_NAME" ]; then
  WT_NAME="worktree-$PORTLESS_WORKTREE_ID"
fi

CONVEX_TEAM="${WORKTREE_CONVEX_TEAM:-BSX}"
CONVEX_PROJECT="${WORKTREE_CONVEX_PROJECT:-rodge-mail}"

echo "branch=${BRANCH_NAME:-HEAD}"
echo "head=$HEAD_SHA"
echo "worktree_id=$PORTLESS_WORKTREE_ID"
echo "web_url=https://$PORTLESS_WORKTREE_ID.www.rodge-mail.local"
echo "source_repo=$MAIN_REPO"

set_env_var() {
  FILE="$1"
  NAME="$2"
  VALUE="$3"

  touch "$FILE"
  if grep -q "^$NAME=" "$FILE"; then
    sed -i '' "s|^$NAME=.*|$NAME=$VALUE|" "$FILE"
  else
    printf '\n%s=%s\n' "$NAME" "$VALUE" >> "$FILE"
  fi
}

remove_env_var() {
  FILE="$1"
  NAME="$2"

  if [ -f "$FILE" ]; then
    sed -i '' "/^$NAME=/d" "$FILE"
  fi
}

clear_convex_selection() {
  FILE="$1"

  remove_env_var "$FILE" "CONVEX_URL"
  remove_env_var "$FILE" "CONVEX_SITE_URL"
  remove_env_var "$FILE" "CONVEX_DEPLOY_KEY"
}

# Pull env vars from the main deployment before switching the worktree deployment.
TEMP_ENV=$(mktemp)
SOURCE_CONVEX_DIR="$MAIN_REPO/services/convex"
if [ ! -d "$SOURCE_CONVEX_DIR" ]; then
  rm -f "$TEMP_ENV"
  echo "Could not find source Convex directory at $SOURCE_CONVEX_DIR" >&2
  exit 1
fi

cd "$SOURCE_CONVEX_DIR"
npx convex env list > "$TEMP_ENV"
if grep -Eq '^ENVIRONMENT="?production"?$' "$TEMP_ENV"; then
  rm -f "$TEMP_ENV"
  echo "Refusing to copy environment variables from the production Convex deployment." >&2
  exit 1
fi

cd "$NEW_WT/services/convex"
clear_convex_selection ".env.local"
DEPLOYMENT_REF="$CONVEX_TEAM:$CONVEX_PROJECT:dev/$WT_NAME"
if npx convex deployment select "$DEPLOYMENT_REF" < /dev/null; then
  echo "selected existing worktree deployment $DEPLOYMENT_REF"
else
  npx convex deployment create "$DEPLOYMENT_REF" --select --expiration "in 7 days" --type dev < /dev/null
fi
npx convex deployment token create "$WT_NAME" --save-env < /dev/null

# Push env vars to the new deployment
if [ ! -s "$TEMP_ENV" ]; then
  rm -f "$TEMP_ENV"
  echo "Refusing to continue because no environment variables were copied from the source deployment." >&2
  exit 1
fi
npx convex env set --from-file "$TEMP_ENV" --force < /dev/null
echo "copied environment variables from $SOURCE_CONVEX_DIR to new deployment"
rm -f "$TEMP_ENV"

SHARED_AUTH_SITE_URL="${WORKTREE_SHARED_AUTH_SITE_URL:-}"
if [ -z "$SHARED_AUTH_SITE_URL" ]; then
  rm -f "$TEMP_ENV"
  echo "Set WORKTREE_SHARED_AUTH_SITE_URL before configuring shared worktree auth." >&2
  exit 1
fi
AUTH_METADATA="$(curl -fsS "$SHARED_AUTH_SITE_URL/api/auth/convex/.well-known/openid-configuration")"
SHARED_AUTH_JWT_ISSUER="$(printf '%s' "$AUTH_METADATA" | node -e 'let data = ""; process.stdin.on("data", (chunk) => data += chunk); process.stdin.on("end", () => process.stdout.write(JSON.parse(data).issuer));')"
SHARED_AUTH_JWKS_URI="$(printf '%s' "$AUTH_METADATA" | node -e 'let data = ""; process.stdin.on("data", (chunk) => data += chunk); process.stdin.on("end", () => process.stdout.write(JSON.parse(data).jwks_uri));')"

set_env_var ".env.local" "SHARED_AUTH_JWT_ISSUER" "$SHARED_AUTH_JWT_ISSUER"
set_env_var ".env.local" "SHARED_AUTH_JWKS_URI" "$SHARED_AUTH_JWKS_URI"
npx convex env set SHARED_AUTH_JWT_ISSUER "$SHARED_AUTH_JWT_ISSUER" < /dev/null
npx convex env set SHARED_AUTH_JWKS_URI "$SHARED_AUTH_JWKS_URI" < /dev/null
echo "trusted shared auth issuer ${SHARED_AUTH_JWT_ISSUER}"

npx convex dev --once --tail-logs disable < /dev/null
echo "pushed Convex functions to worktree deployment"

cd "$NEW_WT"

cat > shared/config/src/auth.ts <<EOF
export const sharedAuthIssuer: string | undefined = "${SHARED_AUTH_JWT_ISSUER}";
export const sharedAuthJwksUri: string | undefined = "${SHARED_AUTH_JWKS_URI}";
EOF
echo "generated auth.ts (sharedAuthIssuer=${SHARED_AUTH_JWT_ISSUER})"
git update-index --skip-worktree shared/config/src/auth.ts
echo "marked auth.ts as skip-worktree"

# Generate the config overrides with worktree-specific values
NEW_CONVEX_URL="$(grep '^CONVEX_URL=' services/convex/.env.local | cut -d= -f2-)"

cat > shared/config/src/overrides.ts <<EOF
export const convexCloudUrl: string | undefined = "${NEW_CONVEX_URL}";
export const worktreeId: string | undefined = "${PORTLESS_WORKTREE_ID}";
EOF
echo "generated overrides.ts (convexCloudUrl=${NEW_CONVEX_URL}, worktreeId=${PORTLESS_WORKTREE_ID})"
git update-index --skip-worktree shared/config/src/overrides.ts
echo "marked overrides.ts as skip-worktree"

cd "$NEW_WT"
