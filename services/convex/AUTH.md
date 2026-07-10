# Passkey authentication

Rodge Mail uses Better Auth passkeys backed by a locally installed Convex
component. Configure these variables on each Convex deployment:

- `BETTER_AUTH_SECRET`: a random Better Auth signing secret.
- `OWNER_EMAIL`: the single Rodge Mail owner's normalized email address.
- `OWNER_NAME`: the owner's display name.
- `PASSKEY_RP_ID`: the WebAuthn relying-party domain, without a scheme or path.
- `OWNER_BOOTSTRAP_TOKEN`: a temporary, high-entropy secret used as the
  passkey-first registration `context`. Use at least 32 random characters.

`CONVEX_CLOUD_URL` and `CONVEX_SITE_URL` are supplied by Convex. The auth
server uses `CONVEX_SITE_URL` as its base URL rather than the placeholder URLs
in shared app configuration.

Pre-auth passkey registration is closed when `OWNER_BOOTSTRAP_TOKEN` is not
set. Configure it only while bootstrapping, register at least two independent
passkeys, then remove it from the Convex deployment. An authenticated owner can
still add or manage passkeys after the bootstrap token is removed.

After changing Better Auth plugins or options that affect its schema, regenerate
the local component schema from `services/convex/src/betterAuth`:

```sh
pnpm dlx @better-auth/cli@1.4.22 generate --yes \
  --config ./auth.ts --output ./generatedSchema.ts
```

After the Convex project is configured, run `pnpm exec convex codegen` from
`services/convex` so the app and local component declarations are refreshed.
