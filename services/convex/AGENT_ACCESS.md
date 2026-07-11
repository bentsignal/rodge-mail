# Read-only agent access

Rodge Mail exposes one authenticated Convex HTTP action at
`POST /agent/v1/tools`. It is intentionally separate from browser sessions and
accepts only a dedicated bearer credential created by an authenticated Rodge
Mail user.

Credentials have an expiry, an explicit scope list, and either access to every
mail account owned by that user or an account allowlist. The plaintext token is
returned only when it is created. Convex stores a domain-separated SHA-256 hash,
and revocation takes effect immediately.

The endpoint dispatches exactly three tools:

- `list_accounts` requires `accounts:read`.
- `search_mail` requires `mail:search`.
- `get_thread` requires `threads:read`.

There are no mutation, send, delete, credential-management, or attachment-body
tools at this boundary. Every query rechecks the credential owner and account
access. A credential restricted to multiple accounts must provide `accountId`
when searching, avoiding hidden cross-account fanout.

Mail content is projected into strict public DTOs. Provider tokens, remote IDs,
raw HTML, storage IDs, internal jobs, and classification internals are never
returned. Bodies, recipients, attachments, search results, requests, and
responses all have explicit caps. Returned mail is marked as untrusted content
so callers do not treat email text as instructions.

Successful reads are fail-closed on audit persistence: mail is returned only
after the terminal `succeeded` audit event is stored. Denied and internal-error
audits are best-effort because no mail is returned. Audit records contain only a
server request ID, credential fingerprint, credential-bound argument hash,
tool, outcome, duration, result count, and safe error code. They never contain
the bearer token, request body, arguments, or mail content. Audits are retained
for 90 days. Expired credentials are removed after a further 90-day retention
window; both cleanups are bounded and self-scheduling.
