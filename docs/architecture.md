# Rodge Mail architecture

Rodge Mail treats Convex as the canonical local mailbox and provider APIs as
eventually consistent transports. Every client reads the same normalized mail
model instead of rendering Gmail, Microsoft, or IMAP payloads directly.

## Runtime shape

```text
Gmail API + Pub/Sub ─┐
Microsoft Graph ─────┼─> provider adapters ─> Convex mail model
iCloud IMAP/SMTP ────┘                          │
                                               ├─> focused inbox classifier
                                               ├─> selective embeddings
                                               └─> text/vector search

TanStack Start web ──┐
Electron host ───────┼─> Convex queries, mutations, and auth
Expo mobile ─────────┘
```

The Electron application loads the same HTTPS web origin as the browser:
Portless during development and the hosted origin in packaged builds. That
keeps one web implementation and one stable WebAuthn relying-party origin per
environment. It must not expose Node, filesystem, shell, or generic IPC access
to remote renderer content.

## Identity and mailbox access

Rodge Mail authentication and mailbox authorization are separate concerns.

- Better Auth protects the Rodge Mail account with email identity and passkeys.
- Gmail uses delegated Google OAuth with offline access.
- Microsoft 365 uses delegated Microsoft Graph OAuth with offline access.
- iCloud uses an app-specific password for IMAP and SMTP.

Provider credentials are encrypted at rest with a versioned server-side key.
They are never returned by Convex queries or written to logs.

Passkey registration is closed to a signed, single-use owner bootstrap flow.
The owner should register at least two passkeys before bootstrap is disabled.

## Mail model

List queries stay lean. Accounts, folders, threads, messages, large message
content, attachments, drafts, outbox intents, sync state, classification, and
embeddings are stored separately. Provider writes are idempotent by account and
remote identifier.

Remote state changes enter an outbox before an action calls a provider. This
provides retry visibility and prevents a client retry from sending twice.

## Synchronization

Webhooks are wake-up hints; provider cursors are the source of truth.

- Gmail uses history IDs and renews `watch` subscriptions. A periodic repair
  sync covers delayed or dropped Pub/Sub notifications.
- Microsoft uses an Inbox delta link with immutable Outlook message IDs. A
  scheduled repair follows opaque next/delta URLs; change notifications can be
  added later as wake-up hints without replacing cursor reconciliation.
- iCloud uses Convex Node actions to make bounded TLS connections to Apple's
  IMAP and SMTP servers. Encrypted app-specific credentials, imported IMAP
  identifiers, sync runs, and outbox reconciliation all remain in Convex.

All adapters normalize into one internal mutation and use leases, bounded
batches, exponential backoff, and periodic reconciliation.

## Focused inbox

Classification is an idempotent structured workflow, not a tool-using chat
agent. Message bodies are untrusted input and the classifier has no tools.

Deterministic signals run before the model: conversation direction, list and
automated headers, action and transactional language, attachments, pin state,
and manual overrides. The model returns a versioned bucket, category,
importance, confidence, short reason, and summary.

The result records the content hash, prompt/schema/model versions, attempts,
and timestamp. A mutation only accepts it if the source revision still matches.
Pinned messages and explicit Focused/Other feedback always win.

Embeddings are generated only for focused, pinned, or manually selected mail.
Header search remains available for every message.

## Privacy boundaries

- Raw mail and credentials never enter client logs, AI telemetry, or analytics.
- The classifier receives bounded, normalized plain text with control
  characters, excess whitespace, and unneeded headers removed.
- HTML is sanitized before display. Remote images are blocked or proxied by
  default to avoid tracking pixels.
- Attachments remain private and require an authorization check before access.
- Provider disconnect revokes tokens where supported and makes encrypted local
  credentials unusable before deletion.
