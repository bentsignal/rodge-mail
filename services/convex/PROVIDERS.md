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
not final recipient delivery. File attachments are uploaded with the draft;
the current simple Graph attachment path limits each Microsoft file to 3 MB.

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
- Plain-text bodies and remote attachment metadata are normalized. Gmail and
  Microsoft attachment bytes are fetched only after an authorized download
  request, cached in private Convex storage, and served through short-lived
  storage URLs. Compose uploads allow five files, 10 MB per file, and 18 MB
  total; Microsoft additionally applies its 3 MB per-file send limit. iCloud
  binary attachment transfer remains a separate bridge storage flow.
- Read/unread changes are written locally first and propagated to Gmail and
  Microsoft with bounded retries. iCloud read-state propagation is not part of
  protocol version 1.
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

## iCloud Mail bridge

Apple exposes iCloud Mail to third-party clients through IMAP and SMTP, not a
mail REST API that a Convex action can call. Apple's current documented settings
are `imap.mail.me.com:993` with TLS and `smtp.mail.me.com:587` with authenticated
STARTTLS. Apple requires an app-specific password for manual third-party client
access; the user's primary Apple Account password must never be collected.

Rodge Mail therefore uses `@rodge-mail/icloud-bridge`, a long-running Node.js
service with raw TCP egress. It is a deliberate credential and network boundary:

1. `accounts/actions:connectICloud` creates a ten-minute, owner-scoped,
   single-use setup challenge and returns the bridge's `/connect/icloud` URL.
2. The setup form is served by the bridge. The iCloud address and app-specific
   password travel directly from the browser to the bridge over HTTPS. Neither
   the Rodge Mail web client nor Convex receives the password.
3. The bridge proves both IMAP read access and SMTP send access, encrypts the
   password using AES-256-GCM with account-bound additional data, and stores the
   envelope in PostgreSQL. It then completes the signed challenge with Convex.
4. Convex creates an `icloud` mail account and queues a leased initial-sync job.
   The bridge polls for work, normalizes IMAP messages into the existing provider
   contract, and submits bounded batches to signed HTTP actions.
5. iCloud outbox rows become leased bridge send jobs. The bridge uses a stable
   RFC 5322 Message-ID, durably records completed outbox IDs before acknowledging
   Convex, and searches the Sent mailbox as an additional retry reconciliation
   path. A lost acknowledgement therefore does not blindly send a duplicate.

### Signed protocol

All bridge-to-Convex requests are HTTPS `POST`s with these headers:

- `x-rodge-timestamp`: Unix epoch milliseconds
- `x-rodge-request-id`: a unique UUID
- `x-rodge-signature`: base64url HMAC-SHA256

The signed value is
`timestamp.requestId.METHOD.pathname.base64url(sha256(rawBody))`. Convex rejects
timestamps outside five minutes and transactionally records request IDs for
replay protection. The shared secret must contain at least 32 random characters.
Requests are capped at 900 KB; sync payloads contain at most 50 messages and the
bridge additionally chunks on serialized size.

Protocol version 1 has four endpoints:

| Endpoint                                        | Purpose                                                                                 |
| ----------------------------------------------- | --------------------------------------------------------------------------------------- |
| `/providers/icloud/bridge/connections/complete` | Consume a signed setup challenge and bind the verified bridge account.                  |
| `/providers/icloud/bridge/jobs/claim`           | Lease up to ten owner/account-scoped sync or send jobs for ten minutes.                 |
| `/providers/icloud/bridge/sync`                 | Upsert normalized folders/messages, apply confirmed deletions, and finish a sync lease. |
| `/providers/icloud/bridge/jobs/ack`             | Reconcile a leased outbox row as sent or failed.                                        |

Leases make bridge restarts safe. A lost response is reclaimed after expiry.
Connection completion and reconnect are idempotent because the bridge account
UUID is derived from the signed owner identity and normalized mail address.
Authentication failures transition the account to `reauthorization_required`;
the account rail then offers reconnect.

### Incremental IMAP behavior

The bridge stores mailbox UIDVALIDITY and known UIDs in PostgreSQL. For each
selectable mailbox it compares the current UID set with this durable state:

- New UIDs are fetched and normalized in bounded batches.
- Missing known UIDs become deletions only after the server returned a complete
  UID snapshot, avoiding false deletes from a capped history window.
- A UIDVALIDITY change retires the previous generation and imports the current
  generation again.
- Folder special-use flags determine inbox, sent, drafts, archive, trash, and
  junk semantics. Other selectable mailboxes remain custom folders.

The source fetch is capped by `MAX_MESSAGE_BYTES`, and normalized plain text is
capped at 100 KB. Attachment metadata is retained, but binary attachment transfer
remains a separate storage flow. The bridge does not store message bodies.

### Production deployment contract

The bridge requires a continuously running Node.js 22+ container or VM, a
durable PostgreSQL database, public HTTPS for the setup page, and outbound TCP
access to `imap.mail.me.com:993` and `smtp.mail.me.com:587`. A request-only
serverless function is not suitable because the worker polls leased jobs and must
open IMAP/SMTP sockets.

Generate independent secrets locally:

```sh
openssl rand -base64 48 # shared signing secret
openssl rand -base64 32 # bridge credential-encryption key
```

Configure the bridge from `services/icloud-bridge/.env.example`. In particular:

- `DATABASE_URL`: TLS-protected PostgreSQL connection string
- `RODGE_CONVEX_SITE_URL`: the deployed `https://*.convex.site` origin
- `ICLOUD_BRIDGE_SIGNING_SECRET`: shared only with the Convex deployment
- `BRIDGE_ACTIVE_CREDENTIAL_KEY_VERSION`: active keyring entry, for example `v1`
- `BRIDGE_CREDENTIAL_KEYS`: JSON map of versions to base64-encoded 32-byte keys

Configure the same boundary in each Convex deployment:

```sh
pnpm --filter @rodge-mail/convex exec convex env set ICLOUD_BRIDGE_URL 'https://icloud-bridge.example.com'
pnpm --filter @rodge-mail/convex exec convex env set ICLOUD_BRIDGE_SIGNING_SECRET '<same-shared-secret>'
```

Deploy Convex after setting its variables, deploy the bridge, verify
`GET https://icloud-bridge.example.com/health`, then use **Connect iCloud** in
Rodge Mail. Rotate encryption keys by adding a new keyring version and changing
the active version; retain old keys until every credential has been reconnected
or re-encrypted. Rotate the signing secret atomically across both services during
a maintenance window because protocol requests cannot use two secrets at once.

The unavoidable user steps are provisioning the bridge/PostgreSQL deployment,
setting these secrets, enabling two-factor authentication on the Apple Account,
and generating a dedicated Rodge Mail app-specific password at
`account.apple.com`. Changing the primary Apple Account password revokes every
app-specific password, so Rodge Mail will request reconnection afterward.

Primary Apple references:

- [iCloud Mail server settings](https://support.apple.com/en-us/102525)
- [Sign in with app-specific passwords](https://support.apple.com/en-us/102654)
