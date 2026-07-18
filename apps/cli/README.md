# Rodge Mail CLI

The `rodge` command is the local, agent-friendly interface to Rodge Mail. It
uses the system browser for authentication, stores the resulting session in a
user-only local file, and calls authenticated Convex functions directly.

```sh
pnpm --filter @rodge-mail/cli start -- help
pnpm --filter @rodge-mail/cli start -- auth login
pnpm --filter @rodge-mail/cli start -- mail list
pnpm --filter @rodge-mail/cli start -- mail search "flight receipt"
pnpm --filter @rodge-mail/cli start -- mail get THREAD_ID
```

For a directly runnable development command, link the workspace package with
`pnpm --filter @rodge-mail/cli link --global` and then run `rodge help`.

The development deployment URLs are used by default. Override them together
with `RODGE_MAIL_WEB_URL`, `RODGE_MAIL_CONVEX_SITE_URL`, and
`RODGE_MAIL_CONVEX_CLOUD_URL`.
