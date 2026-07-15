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
auth, and the installed macOS desktop app. Production URLs and deployment are
intentionally not configured.

Local provider credentials and Convex deployment values belong in ignored env
files. Never commit mailbox credentials, OAuth secrets, app passwords, or mail
content.

## Validation

```sh
pnpm run lint
pnpm run typecheck
pnpm run format:fix
```

## License

GPL-3.0. See [LICENSE](./LICENSE).
