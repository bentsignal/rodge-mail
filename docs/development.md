# Development

## Prerequisites

- Node.js 22
- pnpm 9
- A Convex account and development deployment
- Xcode and Android Studio for native mobile builds

Run `pnpm install` from the repository root. The workspace uses Turbo, so root
scripts coordinate package tasks.

## Local apps

Portless HTTPS is the primary development environment. Production hosting is
not required to exercise the application locally.

`pnpm dev:web` starts the development Convex functions and TanStack web client.
`pnpm dev` adds the Expo development process. Both commands
start Portless explicitly in LAN mode, making the stable origins available on
this Mac and other devices on the same Wi-Fi network:

- Web: `https://www.rodge-mail.local`
- Expo/Metro: `https://mobile.rodge-mail.local`

The local `rodge` CLI uses the web origin for browser-handoff authentication,
so keep the web development server and Portless proxy running when signing in.
See `apps/cli/README.md` for commands and URL overrides.

On first use, allow Portless to install its local certificate authority. If the
certificate was removed or is not trusted, run `pnpm exec portless trust` and
restart the development command. A physical phone must also trust that local CA
before it can load the HTTPS Metro origin.

The Expo bridge sets Expo's packager proxy URL to the Portless origin, so the
development-client QR code and generated manifest use
`https://mobile.rodge-mail.local` instead of Metro's random internal port.

The Convex development auth deployment trusts `https://www.rodge-mail.local`,
and its passkey relying-party ID is `rodge-mail.local`. Worktree-specific hosts
remain subdomains of the same relying-party ID.

CLI authentication opens `/desktop-auth` in the system browser. After explicit
approval, the web app redirects to the CLI's random-port loopback callback at
`http://127.0.0.1:<port>/auth/desktop-complete`. The `desktop` path names are
kept for compatibility with installed CLIs.

## Secrets

Keep deployment values in ignored `.env` or `.env.local` files. Keep server
provider secrets in Convex environment variables. Never expose OAuth client
secrets, refresh tokens, iCloud app passwords, encryption keys, AI provider
keys, mailbox contents, or attachment data through `VITE_*` or Expo public
configuration.

## Native passkeys

The native client uses the iOS AuthenticationServices and Android Credential
Manager APIs through `expo-better-auth-passkey`. Development credentials use
`rodge-mail.local` as their relying-party ID while authentication requests go
to the Convex development deployment.

- iOS fetches the Apple app-site-association file from the local Portless web
  origin. Physical-device builds must use Apple Development signing,
  `get-task-allow=true`, and
  `webcredentials:rodge-mail.local?mode=developer`.
- Android requires an `assetlinks.json` file at the same local host. Add the
  SHA-256 fingerprints for each development signing certificate used for
  testing.
- Add every Android APK key hash to the Better Auth passkey origin allowlist
  before testing a signed Android build.

Passkeys require a development build or signed app; the native credential
module is not available in Expo Go.

Production URLs, passkey domains, hosting, and build profiles are intentionally
not configured. They must be designed and added explicitly before any future
production work; development builds must never infer a production destination.

## Mail intelligence

See [`services/convex/AI.md`](../services/convex/AI.md) for model variables,
fallback behavior, and the selective semantic-indexing boundary.

## Validation

Run these commands in order after changes:

```sh
pnpm run lint
pnpm run typecheck
pnpm run format:fix
```

Add package-specific tests and smoke checks as each provider and client becomes
runnable.
