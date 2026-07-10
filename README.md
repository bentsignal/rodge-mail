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

The first vertical slice is in place: all three clients share a focused inbox
experience, Convex owns the normalized mail model, and owner-only passkey auth
is deployed. Provider sync and production AI credentials are the next runtime
milestones.

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
