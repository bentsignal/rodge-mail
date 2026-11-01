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
  reads and sends attachment bytes through bounded Convex Node actions.
- Read/unread changes are written locally first and propagated to Gmail and
  Microsoft with bounded retries. iCloud applies the same write-through model
  using IMAP `\\Seen` flags.
- The shared cron schedules Gmail history, Microsoft Inbox delta, and iCloud
  IMAP repair every five minutes and recovers expired outbox leases. Gmail
  `watch`/Pub/Sub and Microsoft Graph change notifications can later reduce
  latency; cursor-based reconciliation remains authoritative. Manual sync is
  available through the provider-specific account mutations, and sends trigger
  an incremental pass.

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

## Removing an account

`accounts/mutations:remove` takes an account out of Rodge Mail: Settings → an
account → Remove Account on the phone, or Remove on an account card in the web
account manager. Nothing is deleted at the provider and the OAuth grant isn't
revoked. Rodge Mail only drops its own copy and its stored tokens. To revoke
access too, remove Rodge Mail at the provider (Google account permissions,
Microsoft "My Apps", or delete the iCloud app-specific password).

Removal happens in two steps:

1. The mutation sets `deletingAt` on the account. From then on the account is
   hidden everywhere: `accounts/queries:list` skips it, list queries drop its
   threads and messages, per-account list queries return empty pages, and
   `getThread` returns `null`. Sync crons, sync actions, provider writes
   (`upsertProviderMessage` and friends), token refreshes, and outbox
   delivery treat it as missing, so an in-flight sync stops at its next
   write. For a hosted account the same mutation deletes its
   `hostedAddresses` rows (aliases included) and clears it as a domain's
   catch-all, so later inbound mail for those addresses is dropped. The
   hosted domain stays registered.
2. `accounts/removal:removeAccountBatch` deletes the rows, one bounded batch
   per run, and reschedules itself until nothing is left: messages with their
   contents, attachments, classifications, clean views, embedding jobs,
   embeddings, notification deliveries and push tickets (20 messages a run,
   including their cached files in Convex storage), then threads, folders,
   archive tombstones, mailing-list suppressions, outbox rows with their
   draft attachments and SES delivery events, sync runs, provider
   credentials, and per-account notification preferences. It takes the
   account out of agent credential allowlists and finally deletes the
   `mailAccounts` row.

Reconnecting the same mailbox while a removal is still running creates a new
account; the account upserts ignore rows with `deletingAt`.

## iCloud Mail

Apple exposes iCloud Mail through IMAP and SMTP rather than a mail REST API.
Apple's documented settings are `imap.mail.me.com:993` with TLS and
`smtp.mail.me.com:587` with authenticated STARTTLS. Rodge Mail runs these
connections in Convex's opt-in Node.js action runtime; an empirical deployment
probe confirmed TLS 1.3 IMAP and SMTP connectivity from the hosted development
runtime.

The connection dialog accepts only an iCloud, me.com, or mac.com address and a
dedicated Apple app-specific password. The Node action verifies both IMAP and
SMTP before creating the account. The password and selected IMAP username are
then stored in the same AES-256-GCM, key-versioned, account-bound envelope used
for other provider credentials. The primary Apple Account password is never
requested.

### Incremental behavior and recovery

- Canonical IMAP identifiers encode mailbox, UIDVALIDITY, and UID. The imported
  Convex message rows are therefore the durable UID state; no second database is
  needed.
- Each run compares Apple's complete UID snapshot with imported identifiers,
  removes confirmed deletions, and imports at most 200 missing messages per
  mailbox in 25-message fetch batches. Repeated repair runs backfill older mail.
- A UIDVALIDITY change retires identifiers from the previous generation and
  imports the current one.
- Source reads are capped at 5 MB per message and normalized plain text at
  100 KB. Attachment bytes are fetched on demand and cached in private Convex
  storage.
- SMTP sends use a deterministic RFC 5322 Message-ID. Before every retry, Rodge
  Mail searches the Sent mailbox for that ID, preventing a lost acknowledgement
  from blindly sending a duplicate.
- Sync runs and outbox leases already live in Convex. Scheduled actions repair
  sync every five minutes and recover expired sends without a persistent worker.

The only unavoidable user step is enabling two-factor authentication and
generating a dedicated Rodge Mail app-specific password at
`account.apple.com`. Changing the primary Apple Account password revokes
app-specific passwords, after which Rodge Mail marks the account for
reconnection.

Primary Apple references:

- [iCloud Mail server settings](https://support.apple.com/en-us/102525)
- [Sign in with app-specific passwords](https://support.apple.com/en-us/102654)

## Hosted mail (Amazon SES)

Hosted accounts are mailboxes on domains you own. Amazon SES handles SMTP,
spam and virus scanning, DKIM signing, and delivery; Convex is the mailbox.

```text
MX ─> SES receipt rule ─> S3 inbound/<id> + SNS ─> /providers/hosted/sns
  ─> SNS signature check ─> ingest action ─> upsertProviderMessage
outbox ─> hosted/outbox:deliver ─> SES SendEmail (raw) ─> S3 sent/<id>
SES configuration-set events ─> SNS ─> hostedDeliveryEvents
```

- One active receipt rule with no recipient filter accepts mail for every
  SES-verified domain. Convex routes envelope recipients through
  `hostedAddresses`; unknown recipients are dropped unless the domain has a
  catch-all account.
- Raw MIME is kept in the private S3 bucket under `inbound/` and `sent/`.
  Attachments are parsed from it on demand.
- Virus failures are dropped. Spam failures and DMARC failures with a
  `quarantine`/`reject` policy are stored outside the inbox with a `junk` label.
- SES replaces the outgoing `Message-ID`; the sent copy records
  `<sesMessageId@email.amazonses.com>` so replies thread correctly.
- Read state and archive are local-only; there is no provider to synchronize.
- Convex uses the `rodge-mail-convex` IAM user, limited to the mail bucket and
  sending from verified identities.

Provisioning is idempotent and lives in `scripts/hosted-mail.mjs`:

```sh
node scripts/hosted-mail.mjs bootstrap                 # AWS resources + Convex env
node scripts/hosted-mail.mjs connect                   # subscribe SNS after deploy
node scripts/hosted-mail.mjs add-domain example.com    # SES identity, DNS, registration
node scripts/hosted-mail.mjs add-address me@example.com --name "Me"
node scripts/hosted-mail.mjs add-address hi@example.com --alias-of me@example.com
node scripts/hosted-mail.mjs send-test me@example.com me@example.com
node scripts/hosted-mail.mjs status
```

`add-domain` writes DNS records directly for domains on Vercel DNS (DKIM
CNAMEs, root MX and SPF, `bounce.` MAIL FROM MX and SPF, and DMARC) and prints
them for other DNS hosts. It refuses to replace existing MX, SPF, or DMARC
records without `--force`; with it, the old records are deleted on Vercel
before the new ones are added (moving a domain off another mail host stops
its mail there, so create its addresses right after). The SES account has
production access, so it sends to anyone.

### Importing a connected account's mail

Moving a domain to hosted mail leaves its old mail with the previous provider.
`import` copies that mail into a hosted address as real raw messages, so it
survives removing the old account:

```sh
node scripts/hosted-mail.mjs import me@example.com me@example.com   # source, then hosted address
node scripts/hosted-mail.mjs import-status [me@example.com]
```

The source is the connected (non-hosted) account with that address; only
Microsoft 365 is supported so far. Sources implement `MailImportSource` in
`src/providers/types.ts` (list messages with folder, read state, and date,
then fetch raw MIME), so Gmail (`format=raw`) or iCloud (IMAP `BODY[]`) can be
added without touching the hosted side. Microsoft reads every folder except
Deleted Items, Drafts, Outbox, Conversation History, and Sync Issues, and
downloads each message from `/me/messages/{id}/$value`.

Each message is stored in S3 under `import/<hosted account id>/<sha256 of
source account and message id>`, parsed like inbound SES mail, and written
through `upsertProviderMessage`, so Message-ID threading, attachments (read
from S3 on demand), and search work as they do for other hosted mail:

| Source folder | Hosted copy                                           |
| ------------- | ----------------------------------------------------- |
| Inbox         | Inbox, original read state, queued for classification |
| Sent Items    | Outgoing, read, label `sent`                          |
| Archive       | Out of the inbox, label `archive`                     |
| Junk Email    | Out of the inbox, label `junk`                        |
| Other folders | Out of the inbox, label `folder:<path>`               |

Dates come from the source (`receivedDateTime`, or `sentDateTime` for sent
mail). Archived mail doesn't get Rodge's `archivedAt`, which deletes mail
after 30 days. Rodge has no folder or label views yet and search covers inbox
mail only, so imported mail outside the inbox shows up only inside threads
that also have inbox mail, until those views exist. Imports never notify, never request a clean view, and never
send. Inbox mail is still classified, so batches wait 2 s per inbox message to
stay under half the classification rate limit.

`importer:run` handles 25 messages per batch and schedules the next one. The
`mailImports` row keeps the cursor and the imported, skipped, and failed
counts, plus the last 100 failures with their reasons. Graph throttling and
5xx errors retry the same page with backoff and fail the import after five in
a row; a missing or oversized (over 40 MB) message is recorded as a failure
and skipped. Running `import` again resumes a failed or stalled import from
its cursor, and restarts a completed one from the beginning: messages already
imported (by source account and message ID) are skipped without being
downloaded, which retries only the failures. A message received from a day
before the hosted account existed onward is skipped when SES already delivered
the same Message-ID, which covers mail both providers got during the DNS move.
The source account is never changed.
