# Passkey authentication

Rodge Mail uses Better Auth passkeys backed by a locally installed Convex
component. Configure these variables on each Convex deployment:

- `BETTER_AUTH_SECRET`: a random Better Auth signing secret.
- `PASSKEY_RP_ID`: the WebAuthn relying-party domain, without a scheme or path.
- `ANDROID_PASSKEY_ORIGINS`: optional comma-separated
  `android:apk-key-hash:<BASE64_SHA256>` origins for every debug, EAS, and Play
  signing certificate that may authenticate on Android versions where
  Credential Manager cannot forward the HTTPS origin.

`CONVEX_CLOUD_URL` and `CONVEX_SITE_URL` are supplied by Convex. The auth
server uses `CONVEX_SITE_URL` as its base URL rather than the placeholder URLs
in shared app configuration.

Signed-out registration sends normalized name and email fields in the passkey
registration context. The server rejects malformed input and existing email
addresses, then creates the Better Auth user only after WebAuthn verification
succeeds. Authenticated users can add passkeys to their existing account
without registration context. Passkey sign-in remains usernameless and selects
the account from the credential.

Android also requires `https://<PASSKEY_RP_ID>/.well-known/assetlinks.json`
with the package `com.bentsignal.rodgemail` and each signing certificate's raw
SHA-256 fingerprint. The same certificates must be converted to base64 and
listed in `ANDROID_PASSKEY_ORIGINS`; the server rejects malformed entries.

After changing Better Auth plugins or options that affect its schema, regenerate
the local component schema from `services/convex/src/betterAuth`:

```sh
pnpm dlx @better-auth/cli@1.4.22 generate --yes \
  --config ./auth.ts --output ./generatedSchema.ts
```

After the Convex project is configured, run `pnpm exec convex codegen` from
`services/convex` so the app and local component declarations are refreshed.
