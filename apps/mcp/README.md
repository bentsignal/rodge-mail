# Rodge Mail MCP

Local, read-only stdio adapter for Rodge Mail. It exposes only
`list_accounts`, `search_mail`, and `get_thread`; it has no send or mutation
tool.

Set `RODGE_MAIL_AGENT_ENDPOINT` to the HTTPS Convex agent tool endpoint. Supply
the scoped credential with exactly one of:

- `RODGE_MAIL_AGENT_TOKEN`
- `RODGE_MAIL_AGENT_TOKEN_FILE`, an absolute path to a regular, non-symlink
  file with mode `0600`

Run the server with:

```sh
pnpm --filter @rodge-mail/mcp start
```

The credential is never a tool argument. The adapter writes MCP protocol data
only to stdout and emits bounded, redacted diagnostic metadata to stderr.
