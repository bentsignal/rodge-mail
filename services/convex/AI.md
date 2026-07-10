# AI classification and semantic search

AI classification is deferred while Rodge Mail uses one chronological inbox.
New provider mail is not queued for classification. The existing pipeline and
stored classification rows remain temporarily available for migration and
experimentation, but the inbox API and clients do not depend on them.

If classification is re-enabled, message fields are bounded and normalized
before they are sent as untrusted JSON to the model. The model receives no
tools, URLs are not fetched, and its structured response is validated again
before storage.

## Provider setup

The first supported provider is OpenAI. Configure these values on each Convex
deployment:

```sh
pnpm --filter @rodge-mail/convex exec convex env set OPENAI_API_KEY
pnpm --filter @rodge-mail/convex exec convex env set AI_CLASSIFICATION_MODEL gpt-5-mini
pnpm --filter @rodge-mail/convex exec convex env set AI_EMBEDDING_MODEL text-embedding-3-small
```

The model variables are optional and use the values above by default. The API
key is optional for local fixture work: classification falls back to
deterministic rules, while embedding and semantic search report that AI is not
configured. Never put the API key in a client environment variable.

## Classification lifecycle

The dormant `classification/internal:queue` boundary creates one job per message revision and
prompt version. Re-queuing the same input is a no-op. Scheduled actions use a
per-owner rate limit, retry transient failures with bounded backoff, and reject
stale completions by job key. After the final model failure, deterministic
signals provide an explainable fallback instead of leaving the message stuck.

The stored record includes the input hash, prompt and output-schema versions,
model, attempts, signals, reason, and confidence. Legacy bucket fields are
optional so existing rows remain valid without requiring new messages to adopt
that product model.

## Selective embeddings

The retained experimental pipeline only embeds legacy-prioritized, pinned, or
explicitly selected messages. Vectors live in a separate table and use 512
dimensions to keep normal mail reads small. Removing the last selection reason
removes the vector.

`embedding/search:semanticSearch` is the only public vector-search boundary.
It authenticates and rate-limits the caller, filters the vector index by owner,
then rechecks owner, optional account, and inbox state while hydrating results.
The vector itself is never returned.

## Version changes

Change `CLASSIFICATION_PROMPT_VERSION` when normalization, signals, or prompt
policy changes enough to require reclassification. Change
`CLASSIFICATION_OUTPUT_SCHEMA_VERSION` when the model response shape changes.
Changing embedding model or dimensions requires a deliberate reindex; schema
and runtime dimensions must always match.
