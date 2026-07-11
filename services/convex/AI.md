# AI classification and semantic search

New provider inbox mail is classified asynchronously while Rodge Mail keeps one
chronological inbox. Message fields are bounded and normalized before they are
sent as untrusted JSON to the model. The model receives no tools, URLs are not
fetched, and its structured response is validated again before storage.

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

The `classification/internal:queue` boundary creates one job per message
revision and prompt version. Re-queuing the same input is a no-op. Scheduled actions use a
per-owner rate limit, retry transient failures with bounded backoff, and reject
stale completions by job key. After the final model failure, deterministic
signals provide an explainable fallback instead of leaving the message stuck.

The stored record includes the input hash, prompt and output-schema versions,
model, attempts, signals, reason, and confidence. Legacy bucket fields are
optional so existing rows remain valid. New model, rule, manual, and seed
classifications do not write them.

Category, scalar importance, reason, and summary are required on every stored
classification. A brand-new pending job uses the neutral `unclassified`
category; reclassifying an existing message preserves its last completed
payload until the replacement result commits, so an abandoned job cannot
silently discard importance or a valid embedding.

## Selective embeddings

The pipeline embeds messages above the shared scalar importance threshold,
plus pinned or explicitly selected messages. Vectors live in a separate table and use 512
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
