# Passkey authentication

Rodge Mail uses Better Auth passkeys backed by a locally installed Convex
component. Configure these variables on each Convex deployment:

- `BETTER_AUTH_SECRET`: a random Better Auth signing secret.
- `AUTH_EMAIL_FROM`: a verified Resend sender, such as
  `Rodge Mail <auth@example.com>`.
- `PASSKEY_RP_ID`: the WebAuthn relying-party domain, without a scheme or path.
- `RESEND_API_KEY`: the Resend API key used for registration verification codes.
- `DESKTOP_BROWSER_AUTH_URL`: optional origin-only HTTPS URL for the public web
  app that handles packaged desktop authentication. It must match the web
  bundle's `VITE_DESKTOP_BROWSER_AUTH_URL`.
- `ANDROID_PASSKEY_ORIGINS`: optional comma-separated
  `android:apk-key-hash:<BASE64_SHA256>` origins for every debug, EAS, and Play
  signing certificate that may authenticate on Android versions where
  Credential Manager cannot forward the HTTPS origin.

`CONVEX_CLOUD_URL` and `CONVEX_SITE_URL` are supplied by Convex. The auth
server uses `CONVEX_SITE_URL` as its base URL rather than the placeholder URLs
in shared app configuration.

Registration verifies the email address with a single-use, five-minute Better
Auth email OTP before issuing passkey registration options. OTP verification
creates an email-verified user and authenticated session; the client then adds a
passkey through the same authenticated flow used by existing users. Email OTPs
are stored hashed and allow three attempts. To keep OTP from becoming an
alternate sign-in method, the server silently skips delivery for users who
already have a passkey. Users with no passkeys can request another code to
resume interrupted onboarding. Passkey sign-in remains usernameless and selects
the account from the credential.

Desktop browser authentication uses a five-minute, PKCE-bound handoff stored in
Better Auth's verification table. The system-browser URL contains a random
request ID. After explicit browser approval, the `rodge-mail://` callback adds a
fresh one-time authorization code. The verifier remains in Electron session
storage, and both factors are submitted in the final POST. The server stores
only their hashes and atomically consumes the verification record before a
separate desktop session is issued, preventing interception and replay.

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
