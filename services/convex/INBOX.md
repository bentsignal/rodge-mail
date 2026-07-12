# Thread-level inbox pagination

`mail.queries.listInbox` and `mail.queries.listPinned` paginate `threads`, not
`messages`. The main inbox uses thread indexes ordered by `isPinned` and then
`latestInboxMessageAt`, so every pinned page precedes every unpinned page while
each group remains newest-first. Each returned row keeps the existing enriched
message shape for client compatibility, but its `_id` is selected dynamically
from the newest message that is still in the inbox. `threadId` is the stable
list identity.

The thread projection stores:

- `inInbox`, so removed or archived-only conversations do not consume pages.
- `latestInboxMessageId` and `latestInboxMessageAt`, which select the current
  message route and preserve descending received order.
- `isPinned`, which is true when any inbox message in the thread is pinned.
- `unreadCount`, which remains the source of truth for the row's `isRead` value.

Provider upserts and deletes recalculate this projection. Thread pin, single
message pin, removal, demo seed, and malformed-message repair paths update it as
well. Header search remains message-indexed; clients retain their compatibility
dedupe so lexical and semantic search ordering does not change.

## Existing thread migration

Projection fields are optional in the schema so deployment is safe before
existing rows are migrated. Queries treat a missing `inInbox` or `isPinned`
field as a legacy candidate and verify its representative message at read time.
This prevents disappearing mail during rollout, though legacy removed or
unpinned threads can make pages sparse until backfill completes.

Run the internal mutation in bounded pages and pass each returned cursor into
the next call until `isDone` is true:

```sh
pnpm --filter @rodge-mail/convex exec convex run mail/maintenance:backfillThreadInboxProjection '{"paginationOpts":{"cursor":null,"numItems":100}}'
```

The backfill is idempotent and recomputes projection state from messages.
Zero-message orphan threads are explicitly marked outside the inbox so they do
not consume pagination cursor slots before row enrichment.
