# Mail search and indexing

Exact search uses the Convex `messages.search_headers` index. Provider sync
indexes normalized sender and recipient addresses, subject, snippet, and up to
20,000 characters of plain-text body content. Search also recognizes these
deterministic operators and phrases:

- `from:alex@example.com` and `from Alex`
- `subject:"launch plan"` and `subject launch`
- `after:2026-07-01`, `before:2026-07-10`, and `on:2026-07-09`
- `today`, `yesterday`, `this week`, `last week`, and `last 7 days`

Relative calendar boundaries are evaluated in UTC because the backend does not
receive the user's timezone. Provider messages without a downloaded plain-text
body remain searchable by headers and snippet only. Gmail, Microsoft, and
iCloud normally include body content during the existing full-message sync,
but provider truncation and MIME parsing still limit what can be indexed.

Web and mobile keep the paginated exact-search query as the immediate result
source. A debounced semantic action runs alongside it, hydrates only
owner-scoped inbox messages, and appends unique semantic matches after lexical
matches. Semantic failure, missing AI configuration, or rate limiting does not
hide or delay lexical results.

New inbox messages queue a baseline inbox embedding during provider upsert.
Embeddings cover the unified inbox without running or writing Focused/Other
classification. The dormant classification infrastructure remains available
for a future product iteration, but search ingestion and backfill do not invoke
it.

Rows synced before unified indexing need a one-time backfill. Call the
authenticated `embedding/mutations:backfillInboxIndexing` mutation with
`{"apply": false, "cursor": null}` to preview the first batch. If its counts
look reasonable, call the same cursor with `apply: true`, then repeat preview
and apply with each returned `continueCursor` until the desired recent window
is covered. The traversal is newest-first; Rodge Mail currently backfills only
the latest 200 inbox messages rather than polluting search with an unlimited
archive. Each call is owner-scoped and processes at most 25 messages, so it can
be driven from authenticated maintenance tooling without an unbounded
transaction or scheduler fan-out. No client launches this workflow
automatically. Embedding jobs will finish only when `OPENAI_API_KEY` is
configured; exact body/header/date search does not depend on OpenAI.

The backfill also rebuilds exact-search text from stored message content. Job
creation is idempotent: embedding content/model job keys reuse current work,
while action rate limits cap execution at 60 embedding attempts per owner per
minute. The 200-message repair therefore runs as eight explicit 25-message
transactions rather than one unbounded mutation.

Convex search indexes cannot combine a full-text match with a received-date
range. Combined lexical and structured searches therefore paginate the
full-text index and apply sender/subject/date constraints to each page. Such a
page can be sparse or empty while `isDone` remains false and later pages still
exist; maintenance clients must continue pagination until `isDone`. Date-only
searches use the received-date database index directly and do not have this
limitation.

Semantic search embeds the parsed lexical portion and then applies the same
sender/subject/date constraints while hydrating its top 50 vector candidates.
It is therefore a relevance aid rather than an exhaustive structured-query
engine: a constrained match outside those 50 candidates is not returned. The
deterministic exact-search query remains the exhaustive path exposed to the
current clients.
