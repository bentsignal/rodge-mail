# Mail providers

Rodge Mail's provider boundary keeps OAuth tokens out of public functions and
normalizes provider payloads before database writes. Gmail and Microsoft Graph
implement the same interfaces in `src/providers/types.ts` without changing the
mail-domain tables.

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

## Microsoft 365 setup

1. In Microsoft Entra, create an app registration that supports organizational
   directories and personal Microsoft accounts. Add a **Web** redirect URI with
   this exact value:
   `https://<deployment>.convex.site/providers/microsoft/oauth/callback`.
2. Add delegated Microsoft Graph permissions `User.Read`, `Mail.ReadWrite`, and
   `Mail.Send`. Rodge Mail also requests `openid`, `profile`, and
   `offline_access` during authorization. Tenant policy may require an
   administrator to grant consent.
3. Create a client secret and configure the Convex deployment. The tenant is
   optional and defaults to `common`; set it to a tenant ID or verified tenant
   domain to restrict authorization to one organization.

   ```sh
   pnpm --filter @rodge-mail/convex exec convex env set MICROSOFT_OAUTH_CLIENT_ID '<application-client-id>'
   pnpm --filter @rodge-mail/convex exec convex env set MICROSOFT_OAUTH_CLIENT_SECRET '<client-secret-value>'
   pnpm --filter @rodge-mail/convex exec convex env set MICROSOFT_OAUTH_TENANT 'common'
   ```

   The Microsoft connector uses the same `PROVIDER_CREDENTIAL_KEYS` keyring as
   Gmail. Do not put the secret, keyring, access token, or refresh token in a
   client-visible environment variable.

4. Deploy Convex, sign in to Rodge Mail, and choose **Connect Microsoft 365** in
   the account rail. The callback discovers the mailbox through `/me`, stores
   encrypted offline credentials, and schedules the initial Inbox sync.

The initial Graph delta round covers the most recent 90 days of Inbox mail and
then persists the opaque `@odata.deltaLink`. Every five minutes, Rodge Mail
follows that exact URL until Graph returns a new delta link. `@removed` entries
delete messages that were deleted or moved out of Inbox. A `410` or invalid
delta token starts a fresh delta round and reconciles the bounded local Inbox.
Requests opt into immutable Outlook IDs so moves within the mailbox do not
change canonical message identifiers.

Microsoft sends use a draft-first flow. Rodge Mail stores the immutable draft
ID under the outbox lease before calling `send`, so a timeout can check whether
the same draft is still a draft or already exists in Sent Items before retrying.
Graph returns `202 Accepted`; that confirms Exchange accepted the send request,
not final recipient delivery. Attachment bytes are not uploaded by this slice.

## Synchronization and send guarantees

- Gmail initial sync snapshots up to 200 recent messages, labels, and a mailbox
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
- The shared cron schedules Gmail history and Microsoft Inbox delta repair every
  five minutes and recovers expired outbox leases. Gmail `watch`/Pub/Sub and
  Microsoft Graph change notifications can later reduce latency; cursor-based
  reconciliation remains authoritative. Manual sync is available through the
  provider-specific account mutations, and sends trigger an incremental pass.

Primary references:

- [Google OAuth 2.0 for web server applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Gmail synchronization guide](https://developers.google.com/workspace/gmail/api/guides/sync)
- [Gmail `history.list`](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.history/list)
- [Gmail message sending](https://developers.google.com/workspace/gmail/api/guides/sending)
- [Gmail OAuth scopes](https://developers.google.com/workspace/gmail/api/auth/scopes)
- [Microsoft authorization code flow with PKCE](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow)
- [Microsoft Graph message delta query](https://learn.microsoft.com/en-us/graph/delta-query-messages)
- [Immutable Outlook identifiers](https://learn.microsoft.com/en-us/graph/outlook-immutable-id)
- [Microsoft Graph `sendMail`](https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0)
- [Microsoft Graph message attachments](https://learn.microsoft.com/en-us/graph/api/message-list-attachments?view=graph-rest-1.0)
- [Convex actions](https://docs.convex.dev/functions/actions)
- [Convex HTTP actions](https://docs.convex.dev/functions/http-actions)
