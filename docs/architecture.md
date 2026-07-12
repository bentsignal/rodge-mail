# Rodge Mail architecture

Rodge Mail treats Convex as the canonical local mailbox and provider APIs as
eventually consistent transports. Every client reads the same normalized mail
model instead of rendering Gmail, Microsoft, or IMAP payloads directly.

## Runtime shape

```text
Gmail API + Pub/Sub ─┐
Microsoft Graph ─────┼─> provider adapters ─> Convex mail model
iCloud IMAP/SMTP ────┘                          │
                                               ├─> importance classifier
                                               ├─> selective embeddings
                                               └─> text/vector search

TanStack Start web ──┐
Electron host ───────┼─> Convex queries, mutations, and auth
Expo mobile ─────────┘
```

The Electron application uses the same TanStack implementation as the browser.
Development loads the Portless HTTPS origin. Packaged builds bundle the web
output, run it in a sandboxed Electron utility process, and intercept only the
baked `https://www.rodge-mail.local` origin so the renderer retains a stable
WebAuthn relying-party origin without requiring Portless or Vercel at runtime.
It exposes no Node, filesystem, shell, or generic IPC access to renderer
content.

## Identity and mailbox access

Rodge Mail authentication and mailbox authorization are separate concerns.

- Better Auth protects the Rodge Mail account with email identity and passkeys.
- Gmail uses delegated Google OAuth with offline access.
- Microsoft 365 uses delegated Microsoft Graph OAuth with offline access.
- iCloud uses an app-specific password for IMAP and SMTP.

Provider credentials are encrypted at rest with a versioned server-side key.
They are never returned by Convex queries or written to logs.

Registration verifies email ownership with a single-use code before issuing
WebAuthn options. Passkey creation then requires the verified Better Auth
session, and email codes are not delivered for accounts that already have a
passkey. Every mailbox query and mutation remains scoped to the authenticated
user.

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

## Importance classification

Classification is an idempotent structured workflow, not a tool-using chat
agent. Message bodies are untrusted input and the classifier has no tools.

Deterministic signals run before the model: conversation direction, list and
automated headers, action and transactional language, attachments, pin state,
and manual overrides. The model returns versioned scalar importance, category,
confidence, a short reason, and a summary.

The result records the content hash, prompt/schema/model versions, attempts,
and timestamp. A mutation only accepts it if the source revision still matches.
Pinned messages and explicit importance feedback always win. Optional historical
bucket fields are compatibility data, not the product abstraction.

Stored category, importance, reason, and summary are always present. Pending
reclassification retains the previous completed payload; a message without a
prior result uses a neutral `unclassified` category until classification
finishes.

Embeddings are generated only for important, pinned, or manually selected mail.
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
