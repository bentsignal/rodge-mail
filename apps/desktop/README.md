# Rodge Mail desktop

This package is a hardened Electron shell for Rodge Mail. Packaged builds bundle the TanStack Start output and run it in an Electron utility process, while the renderer keeps the stable `https://www.rodge-mail.local` origin required by desktop passkeys. It exposes no Node.js APIs to web content.

## Development

Run `pnpm dev:desktop` from the repository root for normal desktop iteration. It
starts the Portless web/Vite runtime and the Electron development shell
together. Renderer changes use Vite HMR; Electron main and preload changes are
handled by electron-vite. `RODGE_WEB_URL` overrides the default
`https://www.rodge-mail.local` origin when intentionally testing another safe
development origin.

Do not launch an app under `apps/desktop/release` for source iteration. Those
apps are packaged snapshots: they ignore `RODGE_WEB_URL` and serve the web
output copied into the app at package time. Cmd-R only reloads that embedded
snapshot and cannot pick up Vite changes. The desktop-dev preflight fails with
the packaged process path when one is already running, avoiding Electron's
single-instance lock silently focusing stale UI.

Use `pnpm --filter @rodge-mail/desktop dev` only when the web dev server is
already running separately. Development accepts HTTPS URLs and loopback HTTP
URLs. Packaged builds intercept only the baked
`https://www.rodge-mail.local` origin, continue to use the Convex development
deployment, and do not require Vercel or Portless at runtime.

Desktop development completes authentication in the system browser. The
Electron renderer creates a five-minute request and keeps a PKCE verifier in its
own `sessionStorage`; only the request ID and verifier hash leave the app. After
normal web authentication, the browser authorizes that request and opens a
`rodge-mail://` callback containing the request ID and a fresh one-time
authorization code. Electron exchanges that code with the verifier in a POST
body, atomically consumes the request, and receives a new HTTP-only Better Auth
session cookie. The server stores only hashes of the verifier and authorization
code. Cancellation, expiry, a mismatched factor, and replay all fail closed.

Local development uses the Portless origin for both Electron and the system
browser. A packaged app's embedded `www.rodge-mail.local` origin is visible only
inside Electron. Until a real hosted authentication origin exists, packaged
builds perform the same Better Auth passkey sign-in and email-code registration
directly in that embedded renderer. This makes a fresh install usable without
Portless, but available passkeys and user-verification UI depend on the
platform authenticator and password managers exposed to Electron on that Mac or
Windows machine. A passkey stored only in a browser extension may not be
available inside the packaged app, so another registered passkey or account
registration may be required.

The intended long-term packaged flow remains browser-first. Build the web
bundle with `VITE_DESKTOP_BROWSER_AUTH_URL` set to a hosted HTTPS origin that is
different from the embedded origin, and configure the matching Convex
deployment with `DESKTOP_BROWSER_AUTH_URL`. Both values must be origin-only
HTTPS URLs. Packaged builds then use the same PKCE browser handoff as desktop
development.

The preload currently exposes no API. Keep it that way until a native feature needs a small, typed `contextBridge` contract.

On macOS, the signing identity must belong to Apple team `39K6A9FP99`, matching
the keychain access group in `resources/entitlements.mac.plist`. Direct packaged
authentication can use Electron's Touch ID credential store when the build has
the matching entitlement. Once a hosted browser-first origin is configured,
authentication instead uses authenticators available to the system browser.

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

For a local build on a registered Mac, use `dist:mac:development-profile`.
The plain `dist:mac` output is the release-signing path and still requires
notarization before macOS will treat it as a distributable application. The
Windows cross-package is suitable for transfer and local testing, but Windows
will warn about the unknown publisher until a Windows signing certificate is
configured.

Quit the development shell before opening a packaged build, and quit the
packaged build before returning to `pnpm dev:desktop`; both intentionally share
the app's single-instance identity.

The `rodge-mail://` protocol is registered in packaged builds and attempted in
the Electron development shell. macOS reliably resolves custom protocols only
when they are declared in a packaged app's Info.plist, so use a packaged
development-profile build for end-to-end macOS callback acceptance. Both
`rodge-mail:///inbox/thread-id` and `rodge-mail://inbox/thread-id` translate to
paths on the configured hosted origin.

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
