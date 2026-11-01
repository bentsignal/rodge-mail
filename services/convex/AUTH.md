# Passkey authentication

Rodge Mail uses Better Auth passkeys backed by a locally installed Convex
component. Configure these variables on each Convex deployment:

- `BETTER_AUTH_SECRET`: a random Better Auth signing secret.
- `AUTH_EMAIL_FROM`: a verified Resend sender, such as
  `Rodge Mail <auth@example.com>`.
- `PASSKEY_RP_ID`: the browser WebAuthn relying-party domain, without a scheme
  or path. Local web development keeps its `.local` relying party.
- `RESEND_API_KEY`: the Resend API key used for registration verification codes.
- `ANDROID_PASSKEY_ORIGINS`: optional comma-separated
  `android:apk-key-hash:<BASE64_SHA256>` origins for every debug, EAS, and Play
  signing certificate that may authenticate on Android versions where
  Credential Manager cannot forward the HTTPS origin.

`CONVEX_CLOUD_URL` and `CONVEX_SITE_URL` are supplied by Convex. The auth
server uses `CONVEX_SITE_URL` as its base URL rather than the placeholder URLs
in shared app configuration. Native clients use a separate `/api/mobile-auth`
base path whose relying party is the public Convex site hostname. The Convex
HTTP router serves its Apple app-site association at
`https://<CONVEX_SITE_URL>/.well-known/apple-app-site-association`, so a
standalone mobile build never depends on a workstation-hosted server. Browser
clients continue using `/api/auth` and `PASSKEY_RP_ID`.

Passkeys are cryptographically scoped to their relying-party ID. Changing
`PASSKEY_RP_ID` requires users to authenticate through account recovery and
register a new passkey; credentials created for the previous ID cannot migrate.

Registration verifies the email address with a single-use, five-minute Better
Auth email OTP before issuing passkey registration options. OTP verification
creates an email-verified user and authenticated session; the client then adds a
passkey through the same authenticated flow used by existing users. Email OTPs
are stored hashed and allow three attempts. To keep registration OTP from
becoming an alternate sign-in method, the server silently skips delivery for
users who already have a passkey. Users with no passkeys can request another
registration code to resume interrupted onboarding. Passkey sign-in remains
usernameless and selects the account from the credential.

Both sign-in screens, web and mobile, offer only **Sign in with passkey**.
Passkeys are listed, added, and removed in Settings under **Rodge Mail
account**, through Better Auth's passkey client
(`/passkey/list-user-passkeys`, `/passkey/delete-passkey`).

## Website and app passkeys

Website passkeys and app passkeys belong to different relying parties:
`PASSKEY_RP_ID` for the website, the Convex site host for the app. A website
passkey can't sign the app in, and the reverse. Better Auth doesn't store a
passkey's relying party, so `passkeyRpIds` (`src/passkeyRpIds.ts`) adds an
`rpId` field to the passkey row and fills it in:

- when a passkey is registered, with the relying party of the auth instance
  that verified it (`/api/auth` or `/api/mobile-auth`);
- on every successful passkey sign-in, since the signature proves which
  relying party the passkey belongs to. Passkeys registered before `rpId`
  existed get theirs the next time they sign in.

Settings groups passkeys by where they sign in: Website, iPhone app, and
Other for those with no `rpId` yet. Each platform keeps its last passkey: the
apps disable Remove on it, and the delete endpoint refuses it with a message
the apps show (a `before` hook, so a stale client can't remove it either).
Passkeys without an `rpId` never count as a platform's spare, and one can only
be removed once both platforms have a passkey with a known `rpId`. A passkey
whose `rpId` matches neither current relying party (after `PASSKEY_RP_ID`
changed) signs in nowhere and can be removed.

The rules live in `@rodge-mail/std/passkey-sign-in`, shared by the server and
both apps.

## Recovery: `/recover`

When no passkey works (a new device, a lost phone, a changed `PASSKEY_RP_ID`),
open `https://mail.rodgers.dev/recover`. Nothing links to it. It sends a
five-minute, three-attempt code to an existing account's address, without
revealing whether an address exists (`/passkey-recovery/request`). A valid code
(`/passkey-recovery/verify`) verifies ownership of that address, atomically
consumes the hashed code, and creates a normal authenticated session. It
neither replaces nor adds a passkey: after it signs you in, open Settings →
Rodge Mail account → **Add passkey**. Both recovery endpoints are rate limited
to three requests per minute.

The mobile app has no recovery screen, and `/recover` can't sign the app in.
Only the signed-in app can add an app passkey, which is why the app's last
passkey can't be removed from either platform.

## CLI sign-in

CLI authentication uses a five-minute, PKCE-bound handoff stored in Better
Auth's verification table under the `/desktop-auth/*` endpoints. The
system-browser URL contains a random request ID. After explicit browser
approval, the web app redirects to the CLI's random-port loopback callback with
a fresh one-time authorization code. The verifier remains in the CLI, and both
factors are submitted in the final POST. The server stores only their
hashes and atomically consumes the verification record before a separate
client session is issued, preventing interception and replay.

## Android

Android also requires `https://<PASSKEY_RP_ID>/.well-known/assetlinks.json`
with the package `com.bentsignal.rodgemail` and each signing certificate's raw
SHA-256 fingerprint. The same certificates must be converted to base64 and
listed in `ANDROID_PASSKEY_ORIGINS`; the server rejects malformed entries.

## Schema changes

After changing Better Auth plugins or options that affect its schema, regenerate
the local component schema from `services/convex/src/betterAuth`. Its
`auth.ts` and `adapter.ts` list the schema-only `passkeyRpIdPlugin` next to
`passkey()` so the `rpId` field stays in the component schema:

```sh
pnpm dlx @better-auth/cli@1.4.22 generate --yes \
  --config ./auth.ts --output ./generatedSchema.ts
```

After the Convex project is configured, run `pnpm exec convex codegen` from
`services/convex` so the app and local component declarations are refreshed.
