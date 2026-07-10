# Rodge Mail desktop

This package is a hardened Electron shell for the hosted Rodge Mail web app. It does not bundle a separate renderer or expose Node.js APIs to web content.

## Development

`pnpm dev` loads `RODGE_WEB_URL` when provided, otherwise it loads `https://www.rodge-mail.local`. Development accepts HTTPS URLs and loopback HTTP URLs. Packaged builds always load the baked, validated `https://rodge-mail.vercel.app` origin so normal GUI launches do not depend on shell environment variables and cannot be redirected to an arbitrary renderer.

The preload currently exposes no API. Keep it that way until a native feature needs a small, typed `contextBridge` contract.

On macOS, the main process configures Electron's device-bound Touch ID WebAuthn
authenticator. The signing identity must belong to Apple team `39K6A9FP99`,
matching the keychain access group in `resources/entitlements.mac.plist`.
Desktop Touch ID passkeys are local to that Mac and Electron session; register
one from an authenticated desktop session after the initial browser or security
key sign-in.

## Packaging

- `pnpm build` compiles main and preload bundles.
- `pnpm package` creates an unpacked application for local verification.
- `pnpm dist` creates distributable installers.

The `rodge-mail://` protocol is registered in packaged builds. Both `rodge-mail:///inbox/thread-id` and `rodge-mail://inbox/thread-id` translate to paths on the configured hosted origin.

## Signing and notarization

Keep credentials in CI secrets, never in `VITE_` variables or committed files. Electron Builder discovers platform credentials from its standard environment variables:

- macOS signing: `CSC_LINK` and `CSC_KEY_PASSWORD`.
- macOS notarization: App Store Connect API credentials (`APPLE_API_KEY`, `APPLE_API_KEY_ID`, and `APPLE_API_ISSUER`) or the supported Apple ID credentials for the CI environment.
- Windows signing: `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD`.

Add production icons under an Electron Builder resource directory before release. CI should build and sign macOS artifacts on macOS and Windows artifacts on Windows. The current configuration intentionally contains no certificate paths, credentials, or auto-update publisher.
