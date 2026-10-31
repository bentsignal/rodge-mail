#!/usr/bin/env bash
# Which Convex backend this worktree's app and functions use.
#
#   scripts/backend.sh status     the deployment this worktree talks to
#   scripts/backend.sh isolate    give this worktree its own dev deployment,
#                                 with a test owner and seeded fake mail
#   scripts/backend.sh push       push Convex functions to it again
#   scripts/backend.sh seed       replace its mail with a fresh seeded mailbox
#   scripts/backend.sh teardown   delete it and go back to the default
#
# Without `isolate`, a worktree's apps talk to dazzling-dog-633, the one
# production deployment with Shawn's real mail, and nothing here touches
# it. An isolated backend is a named Convex dev deployment (`dev/<branch>`)
# with only the settings the app needs to boot and sign in: a fresh
# BETTER_AUTH_SECRET, DEV_TOOLS=true, and harmless placeholders. No provider,
# AI, email, or AWS secret is copied, so syncing, sending, AI features, and
# notification delivery don't work there (docs/simulator-sign-in.md).
# `scripts/sim.sh signin` signs the simulator in as its test owner.
#
# The apps find it through shared/config/src/overrides.ts (skip-worktree),
# so Metro and the web dev server in this worktree pick it up on reload.
# Deployments expire after 14 days.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
CONVEX_DIR="$ROOT/services/convex"
CONVEX_ENV="$CONVEX_DIR/.env.local"
OVERRIDES="$ROOT/shared/config/src/overrides.ts"
STATE_DIR="$ROOT/.cache/backend"
STATE="$STATE_DIR/isolated"
SAVED_ENV="$STATE_DIR/convex-env-local.default"
PRODUCTION="dazzling-dog-633"
EXPIRATION="in 14 days"
mkdir -p "$STATE_DIR"

slug() {
  git -C "$ROOT" branch --show-current | sed 's|^t3/||' |
    tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//' |
    cut -c1-40 | sed -E 's/-+$//'
}

env_value() {
  [ -f "$2" ] || return 0
  grep -E "^$1=" "$2" | tail -1 | cut -d= -f2- | sed -E 's/[[:space:]]*#.*$//; s/^"//; s/"$//'
}

# Never with a deploy key: one in the shell would point the CLI at whatever
# deployment the key is for, whatever .env.local says.
convex() {
  (cd "$CONVEX_DIR" && env -u CONVEX_DEPLOY_KEY -u CONVEX_DEPLOYMENT npx convex "$@" </dev/null)
}

# Every command that writes refuses unless .env.local selects this
# worktree's isolated deployment.
require_isolated() {
  if [ ! -f "$STATE" ]; then
    echo "this worktree isn't isolated; run scripts/backend.sh isolate" >&2
    exit 1
  fi
  # shellcheck disable=SC1090
  . "$STATE"
  local selected
  selected="$(env_value CONVEX_DEPLOYMENT "$CONVEX_ENV")"
  if [ "${selected#*:}" != "$DEPLOYMENT" ] || [[ "$selected" == *"$PRODUCTION"* ]] ||
    grep -q '^CONVEX_DEPLOY_KEY=' "$CONVEX_ENV"; then
    echo "services/convex/.env.local doesn't select $DEPLOYMENT; refusing" >&2
    exit 1
  fi
}

write_overrides() {
  local worktree_id
  worktree_id="$("$ROOT/scripts/worktree-id.sh" 2>/dev/null || true)"
  [ -n "$worktree_id" ] && worktree_id="\"$worktree_id\""
  cat >"$OVERRIDES" <<EOF
export const convexCloudUrl: string | undefined = ${1:-undefined};
export const convexSiteUrl: string | undefined = ${2:-undefined};
export const worktreeId: string | undefined = ${worktree_id:-undefined};
EOF
  git -C "$ROOT" update-index --skip-worktree shared/config/src/overrides.ts
}

status() {
  if [ -f "$STATE" ]; then
    # shellcheck disable=SC1090
    . "$STATE"
    echo "isolated: dev/$SLUG ($DEPLOYMENT), expires $EXPIRES"
    echo "cloud: $CLOUD_URL"
    echo "site: $SITE_URL"
    echo "sign in the simulator: scripts/sim.sh signin"
  else
    echo "default: $PRODUCTION (production, Shawn's real mail); scripts/backend.sh isolate to test signed in"
  fi
}

isolate() {
  [ -f "$STATE" ] || create_deployment
  configure
}

create_deployment() {
  local name selected team project deployment cloud site
  name="$(slug)"
  if [ -z "$name" ] || [ "$name" = main ]; then
    echo "isolate needs a feature branch" >&2
    exit 1
  fi
  # The default deployment's line names its team and project:
  # `CONVEX_DEPLOYMENT=dev:<name> # team: <team>, project: <project>`.
  selected="$(grep -E '^CONVEX_DEPLOYMENT=' "$CONVEX_ENV" | tail -1 || true)"
  team="$(sed -nE 's/.*team: ([^,]+),.*/\1/p' <<<"$selected")"
  project="$(sed -nE 's/.*project: ([^[:space:]]+).*/\1/p' <<<"$selected")"
  if [ -z "$team" ] || [ -z "$project" ]; then
    echo "couldn't read the Convex team and project from services/convex/.env.local" >&2
    exit 1
  fi

  cp "$CONVEX_ENV" "$SAVED_ENV"
  # shellcheck disable=SC2064 # the paths now
  trap "[ -f '$STATE' ] || cp '$SAVED_ENV' '$CONVEX_ENV'" EXIT
  : >"$CONVEX_ENV"
  if ! convex deployment select "$team:$project:dev/$name" 2>/dev/null; then
    convex deployment create "$team:$project:dev/$name" --type dev --select --expiration "$EXPIRATION"
  fi
  deployment="$(env_value CONVEX_DEPLOYMENT "$CONVEX_ENV")"
  deployment="${deployment#*:}"
  cloud="$(env_value CONVEX_URL "$CONVEX_ENV")"
  site="$(env_value CONVEX_SITE_URL "$CONVEX_ENV")"
  if [ -z "$deployment" ] || [ "$deployment" = "$PRODUCTION" ] || [ -z "$cloud" ] || [ -z "$site" ]; then
    echo "the new deployment wasn't selected; restoring services/convex/.env.local" >&2
    exit 1
  fi
  printf 'SLUG=%s\nDEPLOYMENT=%s\nCLOUD_URL=%s\nSITE_URL=%s\nEXPIRES="%s"\n' \
    "$name" "$deployment" "$cloud" "$site" "$(date -v+14d '+%Y-%m-%d')" >"$STATE"
}

# Safe to run again: it keeps the auth secret and the test owner, and
# reseeds the mailbox.
configure() {
  require_isolated
  local web owner
  web="https://$("$ROOT/scripts/worktree-id.sh").www.rodge-mail.local"
  # What convex.env.ts declares (Convex checks the optional ones too, for
  # the auth config), plus DEV_TOOLS. Nothing that acts on the outside
  # world: RESEND_API_KEY is a placeholder Resend rejects.
  convex env set ENVIRONMENT development
  convex env set DEV_TOOLS true
  convex env set PASSKEY_RP_ID "${SITE_URL#https://}"
  convex env set WEB_URL "$web"
  convex env set DESKTOP_BROWSER_AUTH_URL "$web"
  convex env set AUTH_EMAIL_FROM "Rodge Mail <noreply@example.invalid>"
  convex env set RESEND_API_KEY isolated-backend-placeholder
  if [ -z "$(convex env get BETTER_AUTH_SECRET 2>/dev/null || true)" ]; then
    convex env set BETTER_AUTH_SECRET "$(openssl rand -hex 32)"
  fi
  if [ -z "$(convex env get AUTH_ALLOWED_USER_ID 2>/dev/null || true)" ]; then
    convex env set AUTH_ALLOWED_USER_ID pending
  fi
  push

  owner="$(convex run devTools:ensureOwner | tr -d '"[:space:]')"
  [ -n "$owner" ] || {
    echo "couldn't create the test owner" >&2
    exit 1
  }
  convex env set AUTH_ALLOWED_USER_ID "$owner"
  seed
  write_overrides "\"$CLOUD_URL\"" "\"$SITE_URL\""
  status
  echo "the apps in this worktree now use $DEPLOYMENT: scripts/sim.sh up (or relaunch), then scripts/sim.sh signin"
}

push() {
  require_isolated
  convex dev --once --tail-logs disable
}

seed() {
  require_isolated
  convex run devTools:seed
}

teardown() {
  if [ ! -f "$STATE" ]; then
    echo "not isolated"
    return
  fi
  require_isolated
  local token
  token="$(node -p 'require(require("os").homedir() + "/.convex/config.json").accessToken')"
  curl -fsS -X POST -H "Authorization: Bearer $token" \
    "https://api.convex.dev/v1/deployments/$DEPLOYMENT/delete" >/dev/null ||
    echo "warning: couldn't delete $DEPLOYMENT; it expires on its own" >&2

  if [ -f "$SAVED_ENV" ]; then
    cp "$SAVED_ENV" "$CONVEX_ENV"
  else
    local main
    main="$(dirname "$(git -C "$ROOT" rev-parse --path-format=absolute --git-common-dir)")"
    cp "$main/services/convex/.env.local" "$CONVEX_ENV"
  fi
  write_overrides
  rm -f "$STATE" "$SAVED_ENV"
  status
  echo "relaunch the app (scripts/sim.sh relaunch) so it drops the isolated session"
}

case "${1:-status}" in
  status) status ;;
  isolate) isolate ;;
  push) push ;;
  seed) seed ;;
  teardown) teardown ;;
  *)
    sed -n '2,22p' "$0" | sed 's/^# \{0,1\}//'
    exit 2
    ;;
esac
