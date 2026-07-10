# Rodge Mail iCloud bridge

This service is the network boundary between Rodge Mail's Convex backend and
iCloud Mail's IMAP/SMTP servers. Convex actions cannot open arbitrary raw TCP
sockets, so iCloud support runs in a long-lived Node.js process with outbound TCP
access to Apple.

The bridge is not a mock adapter. It verifies the user's iCloud app-specific
password against both IMAP and SMTP, stores it encrypted in PostgreSQL, pulls
leased work from Convex, incrementally imports mail, and delivers the existing
Rodge Mail outbox.

See [PROVIDERS.md](../convex/PROVIDERS.md#icloud-mail-bridge) for the full
protocol, security, and deployment contract.

## Local commands

```sh
cp .env.example .env
pnpm --filter @rodge-mail/icloud-bridge dev
pnpm --filter @rodge-mail/icloud-bridge test
```

The service applies its idempotent PostgreSQL schema migrations at startup.
`GET /health` reports process health without exposing account state.
