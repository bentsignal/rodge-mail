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

## Validation

Run these commands in order after changes:

```sh
pnpm run lint
pnpm run typecheck
pnpm run format:fix
```

Add package-specific tests and smoke checks as each provider and client becomes
runnable.
