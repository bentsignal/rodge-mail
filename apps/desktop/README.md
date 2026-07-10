# Rodge Mail desktop

This package is a hardened Electron shell for Rodge Mail. Packaged builds bundle the TanStack Start output and run it in an Electron utility process, while the renderer keeps the stable `https://www.rodge-mail.local` origin required by desktop passkeys. It exposes no Node.js APIs to web content.

## Development

`pnpm dev` loads `RODGE_WEB_URL` when provided, otherwise it loads `https://www.rodge-mail.local`. Development accepts HTTPS URLs and loopback HTTP URLs. Packaged builds ignore `RODGE_WEB_URL`, serve the bundled web runtime internally, and intercept only the baked `https://www.rodge-mail.local` origin. They continue to use the Convex development deployment and do not require Vercel or Portless at runtime.

The preload currently exposes no API. Keep it that way until a native feature needs a small, typed `contextBridge` contract.

On macOS, the main process configures Electron's device-bound Touch ID WebAuthn
authenticator. The signing identity must belong to Apple team `39K6A9FP99`,
matching the keychain access group in `resources/entitlements.mac.plist`.
Desktop Touch ID passkeys are local to that Mac and Electron session. New users
can register from the shared web login screen, while signed-in users can add a
passkey for another device from account settings.

## Packaging

- `pnpm build:web` creates the bundled TanStack Start runtime against the Convex development deployment.
- `pnpm build` compiles main and preload bundles.
- `pnpm package` creates an unpacked application for local verification.
- `pnpm dist` creates distributable installers.
- `pnpm dist:mac` creates Apple-silicon DMG and ZIP artifacts.
- `pnpm package:mac:development-profile` and
  `pnpm dist:mac:development-profile` opt into the local Apple development
  provisioning profile for Touch ID passkey testing.
- `pnpm dist:win` creates the Windows x64 NSIS installer, including when run on
  macOS.

The `rodge-mail://` protocol is registered in packaged builds. Both `rodge-mail:///inbox/thread-id` and `rodge-mail://inbox/thread-id` translate to paths on the configured hosted origin.

## Signing and notarization

Keep credentials in CI secrets, never in `VITE_` variables or committed files.
The personal macOS development build scripts expect
`resources/Rodge_Mail_Desktop_Development.provisionprofile`; the file is ignored
by Git and can be downloaded from the Apple Developer portal after registering
this Mac and the `com.bentsignal.rodge-mail` App ID. Electron Builder discovers
signing identities from its standard environment variables:

- macOS signing: `CSC_LINK` and `CSC_KEY_PASSWORD`.
- macOS notarization: App Store Connect API credentials (`APPLE_API_KEY`, `APPLE_API_KEY_ID`, and `APPLE_API_ISSUER`) or the supported Apple ID credentials for the CI environment.
- Windows signing: `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD`.

Add production icons under an Electron Builder resource directory before
release. CI should build and sign macOS artifacts on macOS and Windows artifacts
on Windows. The current configuration intentionally contains no private keys,
credentials, or auto-update publisher.
