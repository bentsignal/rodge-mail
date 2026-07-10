# Mail providers

Rodge Mail's provider boundary keeps OAuth tokens out of public functions and
normalizes provider payloads before database writes. Gmail is the first complete
adapter; Microsoft Graph and iCloud adapters can implement the same interfaces in
`src/providers/types.ts` without changing the mail-domain tables.

## Gmail setup

1. Create a Google Cloud project, enable the Gmail API, and configure an OAuth
   consent screen.
2. Create a **Web application** OAuth client.
3. Add this exact authorized redirect URI:
   `https://<deployment>.convex.site/providers/gmail/oauth/callback`.
4. Configure these Convex deployment variables:

   ```sh
   pnpm --filter @rodge-mail/convex exec convex env set GOOGLE_OAUTH_CLIENT_ID '<client-id>'
   pnpm --filter @rodge-mail/convex exec convex env set GOOGLE_OAUTH_CLIENT_SECRET '<client-secret>'
   pnpm --filter @rodge-mail/convex exec convex env set PROVIDER_ACTIVE_CREDENTIAL_KEY_VERSION 'v1'
   pnpm --filter @rodge-mail/convex exec convex env set PROVIDER_CREDENTIAL_KEYS '{"v1":"<base64url-encoded-32-byte-key>"}'
   ```

   Generate a key locally with
   `openssl rand 32 | openssl base64 -A | tr '+/' '-_' | tr -d '='`. Never
   commit the keyring or OAuth
   client secret. Rotations add a new version to the JSON keyring and change the
   active version. Keep old keys until all stored envelopes have been refreshed or
   reconnected.

5. Deploy Convex, sign in to Rodge Mail, call
   `accounts/actions:connectGmail`, and navigate the browser to the returned
   authorization URL.

The OAuth request asks for offline access to `gmail.modify`, which is a Google
restricted scope. A public app that stores restricted-scope Gmail data requires
Google OAuth verification and may require a security assessment.

## Synchronization and send guarantees

- Initial sync snapshots up to 200 recent messages, labels, and a mailbox
  `historyId`. Incremental runs consume every `history.list` page and refetch
  messages affected by additions or label changes. An expired history cursor
  (`HTTP 404`) falls back to a full sync.
- Normalized message, content, attachment, folder, and thread writes are upserts
  keyed by provider IDs. Replayed history pages therefore converge instead of
  duplicating local records.
- `mail/mutations:enqueuePlainText` requires a caller-generated idempotency key.
  The transactional outbox returns the original row when the key is replayed,
  claims one sender at a time, and retries failures with bounded exponential
  delays. A stable RFC 2822 `Message-ID` is searched before each Gmail send to
  reconcile ambiguous network failures.
- Access and refresh tokens are stored in AES-256-GCM envelopes. The key version
  is stored with each envelope, while the keys remain deployment variables. GCM
  additional authenticated data binds credentials to owner, provider, and account.
- Message HTML and attachment bytes are not downloaded in this slice. Plain-text
  bodies and remote attachment metadata are normalized; attachment download and
  sanitized HTML rendering remain explicit follow-up work.
- Production should add Gmail `watch`/Pub/Sub notifications or a scheduled sync
  cadence. Manual sync is available through
  `accounts/mutations:syncGmailNow`, and sends trigger an incremental sync.

Primary references:

- [Google OAuth 2.0 for web server applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Gmail synchronization guide](https://developers.google.com/workspace/gmail/api/guides/sync)
- [Gmail `history.list`](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.history/list)
- [Gmail message sending](https://developers.google.com/workspace/gmail/api/guides/sending)
- [Gmail OAuth scopes](https://developers.google.com/workspace/gmail/api/auth/scopes)
- [Convex actions](https://docs.convex.dev/functions/actions)
- [Convex HTTP actions](https://docs.convex.dev/functions/http-actions)
