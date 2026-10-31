# Isolated backends and simulator sign-in

Agents test signed-in screens on an **isolated backend**: a throwaway
Convex dev deployment for one branch, with a fake owner and seeded fake
mail. Nothing on it is Shawn's, so screenshots of it are safe to publish as
PR evidence. The production deployment, `dazzling-dog-633`, is never
touched.

```sh
scripts/backend.sh isolate    # create dev/<branch>, configure, push, make the test owner, seed
scripts/sim.sh up             # Metro serves the app pointed at it
scripts/sim.sh signin         # signed in as the test owner (alex.rivera@example.com)
scripts/backend.sh push       # after changing services/convex/src
scripts/backend.sh seed       # a fresh mailbox, dated now
scripts/backend.sh status     # which deployment this worktree talks to
scripts/backend.sh teardown   # delete it; the worktree goes back to the default
```

## What `isolate` does

1. Saves `services/convex/.env.local`, then creates (or reselects)
   `<team>:<project>:dev/<branch>` with `npx convex deployment create
--type dev --select --expiration "in 14 days"`. The CLI writes the new
   deployment into `.env.local`. Every later write checks that
   `.env.local` selects that deployment, not `dazzling-dog-633`, and that
   no `CONVEX_DEPLOY_KEY` is in play.
2. Sets only what `convex.env.ts` declares, plus `DEV_TOOLS=true`:
   `ENVIRONMENT=development`, a fresh random `BETTER_AUTH_SECRET`,
   `PASSKEY_RP_ID` (the deployment's `.convex.site` host), `WEB_URL` and
   `DESKTOP_BROWSER_AUTH_URL` (this worktree's Portless origin),
   `AUTH_EMAIL_FROM` (`noreply@example.invalid`), and a placeholder
   `RESEND_API_KEY`. No production setting is copied.
3. Pushes the functions (`convex dev --once`).
4. Runs `devTools:ensureOwner`, an internal mutation that creates the test
   user `alex.rivera@example.com` through Better Auth's raw adapter
   (registration stays closed in `privateAccountHooks`), and sets
   `AUTH_ALLOWED_USER_ID` to its id, so on this deployment the test user is
   the only allowed owner, exactly as Shawn is on production.
5. Runs `devTools:seed`: three accounts (Gmail, Microsoft 365, iCloud) and
   41 messages in 39 threads, with pinned, unread, and read mail,
   attachments, two multi-message threads, archived threads, and spam
   (`services/convex/src/devSeedMailbox.ts`). Every address uses a reserved
   domain (`example.com`, `.example`).
6. Writes the deployment's URLs into `shared/config/src/overrides.ts`
   (skip-worktree, like the worktree id), which `createUrls` reads, so the
   mobile app served by this worktree's Metro and the web dev server both
   talk to it. Relaunch the app after `isolate` or `teardown`.

The state lives in `.cache/backend/`. `teardown` deletes the deployment
through the Convex API, restores `.env.local`, and resets the overrides.
Deployments expire on their own after 14 days.

## How sign-in works, and why it can't reach production

`scripts/sim.sh signin` calls the debug-only `globalThis.rodgeDev.signIn()`
(`apps/mobile/src/features/dev/automation.ts`) over Metro's debugger
connection. It POSTs to `/api/mobile-auth/dev/sign-in` through the app's
own Better Auth client, so `@better-auth/expo` stores the session cookie in
SecureStore exactly as after a passkey sign-in.

That route is a Better Auth plugin (`services/convex/src/devSignIn.ts`)
that signs in the deployment's allowed owner without a passkey or code.
Several independent checks keep it off production:

- **It isn't installed on production.** `auth.ts` adds the plugin only when
  `devToolsEnabled()`: `DEV_TOOLS` is `"true"`, `ENVIRONMENT` is
  `development`, and neither `CONVEX_CLOUD_URL` nor `CONVEX_SITE_URL` is
  `dazzling-dog-633` (`devToolsPolicy.ts`, with tests). Production sets
  none of the first and is the last, so the route 404s there.
- **The handler checks again** and refuses unless the user it signs in is
  `AUTH_ALLOWED_USER_ID`, and `privateAccountHooks` still vets the session.
- **`ensureOwner` and `seed` are internal** (only callable with the
  deployment's admin credentials) and call `requireDevTools()` first.
- **The app refuses** to call the route when its Convex URLs point at
  `dazzling-dog-633`, and the hook exists only in `__DEV__` builds, never
  the phone's standalone build.
- **`sim.sh signin` refuses** unless `scripts/backend.sh isolate` has run.

## What doesn't work on an isolated backend

No provider, AI, email, push, or AWS secret is set there, on purpose:

- Connecting, syncing, or reconnecting Gmail, Microsoft 365, or iCloud
  (no OAuth clients or `PROVIDER_CREDENTIAL_KEYS`). The seeded accounts
  show as connected but never sync; "Try sync" fails.
- Sending mail (the outbox has no provider to send through).
- Classification, clean view, summaries, and semantic search
  (no `OPENAI_API_KEY`); lexical search over the seed works.
- Email codes and passkey recovery emails (placeholder `RESEND_API_KEY`).
- Push notifications (simulators can't register for them anyway).
- Passkeys on the simulator (the dev client isn't associated with the
  isolated `.convex.site` domain). Use `scripts/sim.sh signin`.
- Hosted mailboxes: this codebase has no hosted (SES) provider yet, so the
  seed has none.
