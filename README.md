# Rodge Mail

Rodge Mail is a focused, AI-native email client for web, desktop, and mobile.
It stores synchronized mail in Convex, connects Gmail, Microsoft 365, and
iCloud accounts, and learns which messages Shawn actually wants to see.

## Product shape

- TanStack Start web client
- Electron desktop client for macOS and Windows
- Expo React Native mobile client with native iOS and Android controls
- Convex mail store, provider sync, search, and background processing
- Better Auth account protected by email and passkeys
- Explainable Focused/Other classification and semantic search for important
  mail

The product implementation includes the shared focused inbox, owner-only
passkey auth, Gmail and Microsoft Graph OAuth providers, the iCloud IMAP/SMTP
bridge, transactional sending, private attachments, and explainable AI
classification and semantic search. Production provider credentials, the
iCloud bridge host, and the public web origin are deployment-time concerns.

## Development

```sh
pnpm install
pnpm dev
```

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
