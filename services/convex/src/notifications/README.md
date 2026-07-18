# Push delivery lifecycle

New-mail notification deduplication remains keyed by message in
`notificationDeliveries`. Sync policy stages a delivery before any Expo work
begins; full, manual, reconciliation, backfill, and stale imports remain
suppressed. Every fresh incoming inbox message advances to Expo delivery when
the user's resolved notification preference is enabled. AI importance
classification does not suppress a setting labeled `New mail`.

Expo accepts at most 100 messages per request, so a delivery is split into
bounded batches. Every returned push ticket is persisted in
`notificationPushTickets` with its originating token. Delivery statuses mean:

- `queued`: legacy staged delivery waiting to be resolved.
- `ready`: fresh mail waiting for the send action.
- `sending`: claimed by the send action.
- `accepted`: every active token was accepted by Expo and receipts are pending.
- `sent`: every accepted ticket has a successful delivery receipt.
- `partial`: at least one token failed while another is accepted or delivered.
- `failed`: every token failed, or no accepted ticket produced a successful
  receipt.
- `skipped`: notifications are disabled or there are no active tokens.

Known permanent Expo errors are stored as `permanent`; rate limits, server
errors, missing receipts, and unknown provider errors are stored as `transient`.
An HTTP 200 response alone never marks a delivery as sent. Error summaries and
accepted, delivered, and failed counts are stored on the delivery row.

`DeviceNotRegistered` disables the matching `mobilePushTokens` row immediately,
whether it appears in a push ticket or receipt. Registering that Expo token again
re-enables the row.

Accepted tickets schedule a Convex action after 15 minutes. The action requests
up to 1,000 receipts and retries missing or transient receipt requests at most
three times. Permanent receipt HTTP failures stop immediately. This provides a
bounded follow-up without an always-on process and does not resend a notification
whose final device outcome is unknown.

Every five minutes, maintenance also finalizes `sending` deliveries whose
15-minute send lease expired. Persisted tickets are summarized and their receipt
checks resume. A delivery with no persisted ticket is marked failed with an
unknown outcome and is never resent, because the Expo request may have reached a
device before the action was interrupted.
