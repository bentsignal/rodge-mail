# Rodge Mail

Rodge Mail is a unified email client for web, desktop, and mobile. It stores
synchronized mail in Convex and connects Gmail, Microsoft 365, and iCloud
accounts without requiring a separate mail database or worker.

## Product shape

- TanStack Start web client
- Electron desktop client for macOS and Windows
- Expo React Native mobile client with native iOS and Android controls
- Convex mail store, provider sync, search, and background processing
- Better Auth account protected by email and passkeys
- Semantic search across synchronized mail, backed by selective embeddings

The product implementation includes a unified and per-account inbox,
user-scoped passkey auth, Gmail and Microsoft Graph OAuth providers, the iCloud
IMAP/SMTP connector, transactional sending, private attachments, classification
metadata, and semantic search. Classification does not currently split the
product into Focused and Other views; the UI intentionally presents one feed
while a future filtering model is evaluated. Development uses Portless HTTPS
origins and a Convex development deployment.

## Development

```sh
pnpm install
pnpm dev
pnpm run readiness:dev
```

`readiness:dev` checks the Portless web and Expo origins, development Convex
auth, and the installed macOS desktop app.

Local provider credentials and Convex deployment values belong in ignored env
files. Never commit mailbox credentials, OAuth secrets, app passwords, or mail
content.

## Hosted web app

The Vercel project `bsx-sh/rodge-mail` serves `https://mail.rodgers.dev` from
`apps/web`, using Node 22, `VITE_NODE_ENV=production`, and
`NITRO_PRESET=vercel`. Deploy from the repository root with
`vercel deploy --prod`. `.vercelignore` excludes credentials and local build
artifacts from CLI uploads.

The website intentionally shares the `dazzling-dog-633` Convex development
deployment with the iPhone app. Deploy backend changes from `services/convex`
with `pnpm exec convex dev --once`; Vercel builds only the web client.

Registration is closed. Convex's `AUTH_ALLOWED_USER_ID` must identify the
existing owner account; session creation and authenticated functions reject
all other users. `WEB_URL=https://mail.rodgers.dev` and
`PASSKEY_RP_ID=mail.rodgers.dev` configure web authentication. Native passkeys
continue to use `dazzling-dog-633.convex.site`. Sign in with email on the new
website before adding its domain-specific passkey.

## Validation

```sh
pnpm run lint
pnpm run typecheck
pnpm run format:fix
```

## License

GPL-3.0. See [LICENSE](./LICENSE).
