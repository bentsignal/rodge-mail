# Signing in on a simulator (not built yet)

`scripts/sim.sh up` gives an agent a signed-out Rodge Mail. Vera solves
this with throwaway accounts on an isolated dev backend; Rodge can't,
because:

- There is one Convex deployment, `dazzling-dog-633`, and it holds Shawn's
  real mail.
- Auth is owner-only. `privateAccountHooks` (`services/convex/src/authAccess.ts`)
  rejects every new user and every session not for `AUTH_ALLOWED_USER_ID`,
  so a test account can't exist.
- Signing in takes a passkey or an email code sent to Shawn. Agents must
  not do either.

So any signed-in simulator is signed in **as Shawn, with his real
mailbox**. That is a decision for Shawn, not a technical detail, which is
why nothing below is implemented or deployed.

## Proposal: an admin-minted, short-lived session

Who can run it doesn't widen: an internal Convex function can only be
called with the deployment's admin credentials (`npx convex run` with the
CLI login or `CONVEX_DEPLOY_KEY`), and anyone holding those can already
read every table with `npx convex data`.

1. **`services/convex/src/devSession.ts`, `internalMutation` `mint`.**
   Arguments: `{ minutes?: number }`, capped at 60. It builds the native
   auth instance (`createNativeAuth(ctx)`), creates a session for
   `env.AUTH_ALLOWED_USER_ID` through `$context.internalAdapter.createSession`
   (so `privateAccountHooks` still runs and still rejects anyone else), with
   `expiresAt` = now + minutes and `userAgent: "rodge-agent-simulator"`, and
   returns the signed session-cookie value (`<token>.<HMAC-SHA256 with
   BETTER_AUTH_SECRET>`, as Better Auth's `setSignedCookie` signs it). Nothing
   public calls it; it is not exported through `http.ts`.
2. **`internalMutation` `revoke`** deletes every session with that user
   agent. `scripts/sim.sh down` calls it.
3. **App, Debug builds only:** `globalThis.rodgeDev.importSession(value)` in
   `apps/mobile/src/features/dev/automation.ts` writes the cookie where
   `@better-auth/expo` reads it (SecureStore key `rodge-mail_cookie`, JSON
   `{"better-auth.session_token":{"value":"…","expires":"<ISO>"}}`, per
   `storagePrefix: "rodge-mail"` and `cookiePrefix: "better-auth"` in
   `features/auth/client.ts`), then reloads. `__DEV__` is false in the
   phone's standalone build, so the hook isn't there.
4. **`scripts/sim.sh signin`** runs
   `npx convex run devSession:mint '{"minutes":30}'` from `services/convex`
   and pipes the value straight into `importSession`, so the token never
   shows up in agent output or logs.

Production auth is unchanged: no new HTTP route, no new client-callable
function, no change to `privateAccountHooks`, and sessions still only for
the owner.

## Risks Shawn would be accepting

- An agent driving the simulator can read, send, archive, and delete his
  real mail, and connected providers act on it (Gmail, Microsoft 365,
  iCloud, SES). Agents would need a rule: read-only unless the change
  under test is about sending or changing mail, and then only to his own
  addresses.
- A live session sits in a simulator's keychain until it expires or
  `down` deletes the simulator and revokes it.

## Deploying it

It ships like any backend change: a PR with "Convex deploy needed: yes",
then a release (`pnpm exec convex dev --once` from `services/convex`,
docs/releasing.md). Before that, `npx convex run devSession:mint` fails
with "Could not find function". No environment variables are needed;
`BETTER_AUTH_SECRET` and `AUTH_ALLOWED_USER_ID` are already set.

The alternative that avoids all of this is a second, isolated deployment
with seeded demo mail (`devSeed.ts` already has fixtures) and its own
allowed user, which `scripts/worktree-db.sh` could grow into. It costs a
deployment and a separate test login, but no agent touches real mail.
