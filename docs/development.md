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
`pnpm dev` adds the Expo and Electron development processes. Both commands
start Portless explicitly in LAN mode, making the stable origins available on
this Mac and other devices on the same Wi-Fi network:

- Web: `https://www.rodge-mail.local`
- Expo/Metro: `https://mobile.rodge-mail.local`

For desktop-only iteration, use `pnpm dev:desktop`. This starts the web/Vite
runtime and Electron development shell together without starting Expo. The
renderer receives Vite HMR updates. An app launched from
`apps/desktop/release` is a packaged snapshot instead: Cmd-R only reloads its
embedded web bundle. The desktop command detects that stale packaged process
and asks you to quit it before development starts.

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

The desktop app defaults to the Portless web origin in development. Set
`RODGE_WEB_URL` only when intentionally testing another safe development
origin. Packaged builds ignore that override and serve the bundled TanStack
output through Electron's intercepted `https://www.rodge-mail.local` origin.

Desktop authentication opens `/desktop-auth` in the system browser and returns
through `rodge-mail://`. Local development can use the Portless origin. For a
packaged build, set the public web bundle's
`VITE_DESKTOP_BROWSER_AUTH_URL=https://<host>` and the matching Convex variable
`DESKTOP_BROWSER_AUTH_URL=https://<host>`. A packaged app cannot expose its
Electron-intercepted `www.rodge-mail.local` runtime to an external browser, so
the hosted route must be deployed before release acceptance on macOS or
Windows.

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

## Mail intelligence

See [`services/convex/AI.md`](../services/convex/AI.md) for model variables,
fallback behavior, and the selective semantic-indexing boundary.

## Web deployment

This is a release step, not a prerequisite for local development or web
passkey testing.

The Vercel project root must be `apps/web`, with “Include source files outside
of the Root Directory” enabled so pnpm workspace packages are available. The
web build selects Nitro's Vercel preset when `VERCEL=1` and writes the Build
Output API bundle under `apps/web/.vercel/output`.

From the repository root, authenticate and deploy with:

```sh
pnpm dlx vercel@latest login
pnpm dlx vercel@latest link --cwd apps/web
pnpm dlx vercel@latest deploy --cwd apps/web --prod
```

Assign `rodge-mail.vercel.app` to the production project before registering
passkeys or provider OAuth callbacks.

## Validation

Run these commands in order after changes:

```sh
pnpm run lint
pnpm run typecheck
pnpm run format:fix
```

Add package-specific tests and smoke checks as each provider and client becomes
runnable.
