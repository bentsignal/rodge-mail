# Development

## Prerequisites

- Node.js 22
- pnpm 9
- A Convex account and development deployment
- Xcode and Android Studio for native mobile builds

Run `pnpm install` from the repository root. The workspace uses Turbo, so root
scripts coordinate package tasks.

## Local apps

`pnpm dev` starts workspace development tasks through Portless. The web origin
uses the stable `www.rodge-mail.local` host shape so auth callbacks and future
passkey configuration do not depend on random ports.

The desktop app must receive `RODGE_WEB_URL`; use the stable local HTTPS web URL
in development and the deployed HTTPS URL in packaged builds.

## Secrets

Keep deployment values in ignored `.env` or `.env.local` files. Keep server
provider secrets in Convex environment variables. Never expose OAuth client
secrets, refresh tokens, iCloud app passwords, encryption keys, AI provider
keys, mailbox contents, or attachment data through `VITE_*` or Expo public
configuration.

## Native passkeys

The native client uses the iOS AuthenticationServices and Android Credential
Manager APIs through `expo-better-auth-passkey`. Production credentials use
`rodge-mail.vercel.app` as their relying-party ID.

- iOS expects the committed Apple app-site-association file to remain available
  at `https://rodge-mail.vercel.app/.well-known/apple-app-site-association`.
- Android requires an `assetlinks.json` file at the same host. Add the SHA-256
  fingerprints for the local debug certificate, EAS distribution certificate,
  and Google Play App Signing certificate after those credentials exist.
- Add every Android APK key hash to the Better Auth passkey origin allowlist
  before testing a signed Android build.

Passkeys require a development build or signed app; the native credential
module is not available in Expo Go.

## Validation

Run these commands in order after changes:

```sh
pnpm run lint
pnpm run typecheck
pnpm run format:fix
```

Add package-specific tests and smoke checks as each provider and client becomes
runnable.
