# Rodge Mail desktop

This package is a hardened Electron shell for Rodge Mail. Packaged builds bundle the TanStack Start output and run it in an Electron utility process. It exposes no Node.js APIs to web content.

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
deployment, and do not require Portless or a hosted web app at runtime.
The embedded transport synchronizes response cookies into Electron's cookie
store, forwards stored cookies back to the bundled server on each request, and
preserves same-origin request semantics for server-function CSRF validation.

Desktop authentication is always completed in the system browser. The
Electron renderer creates a five-minute request and keeps a PKCE verifier in its
own `sessionStorage`; only the request ID and verifier hash leave the app. After
normal web authentication, the browser authorizes that request and opens a
random-port callback bound exclusively to `127.0.0.1`. The callback contains
the request ID and a fresh one-time authorization code. Electron exchanges that
code with the verifier in a POST body, atomically consumes the request, and
receives a new HTTP-only Better Auth session cookie. The server stores only
hashes of the verifier and authorization code. Cancellation, expiry, a
mismatched factor, and replay all fail closed.

Local development uses the Portless origin for both Electron and the system
browser. A development packaged app therefore needs the Portless web runtime
available at `https://www.rodge-mail.local` while signing in. A future
standalone release can instead build the web bundle with
`VITE_DESKTOP_BROWSER_AUTH_URL` set to a hosted HTTPS origin and configure the
matching Convex deployment with `DESKTOP_BROWSER_AUTH_URL`. Both values must be
origin-only HTTPS URLs.

The begin, authorize, exchange, and cancel endpoints form a client-neutral
handoff boundary. A future TUI or other non-browser client can retain the PKCE
verifier locally, open the same browser authorization page, receive the
one-time authorization code through its own callback transport, and exchange
the code for a Better Auth session without implementing WebAuthn itself.

The preload exposes only the non-secret loopback callback URL through document
metadata. Do not expose Node.js or Electron APIs to web content.

Authentication uses the passkeys and password managers available to the system
browser; Electron never invokes WebAuthn directly.

## Packaging

Run these package scripts from the repository root with
`pnpm --filter @rodge-mail/desktop <script>`:

- `build:web` creates the bundled TanStack Start runtime against the Convex
  development deployment.
- `build` compiles main and preload bundles.
- `package` creates an unpacked application for local verification.
- `dist` creates the configured installers for the current host.
- `dist:mac` creates Apple-silicon DMG and ZIP artifacts.
- `package:mac:development-profile` and `dist:mac:development-profile` opt into
  the local Apple development provisioning profile for Touch ID passkey
  testing.
- `install:mac:development-profile` builds the signed local app, installs the
  verified bundle at `/Applications/Rodge Mail.app`, registers it with
  LaunchServices, and opens it. Use this for the searchable, canonical local
  desktop install.
- `dist:win` creates the Windows x64 NSIS installer, including when run on
  macOS.

For a local build on a registered Mac, use `dist:mac:development-profile`.
The plain `dist:mac` output is the release-signing path and still requires
notarization before macOS will treat it as a distributable application. The
Windows cross-package is suitable for transfer and local testing, but Windows
will warn about the unknown publisher until a Windows signing certificate is
configured.

The current personal-use artifacts land in `apps/desktop/release`:

- `Rodge Mail-<version>-mac-arm64.dmg` and `.zip` contain the Apple
  Development-signed app for the registered Mac.
- `Rodge Mail-<version>-win-x64.exe` is the transferable Windows installer.

The Apple Development build is intentionally local: it is code-signed and can
use the registered provisioning profile, but it is not notarized for arbitrary
Macs. Verify its sealed app before opening it with
`codesign --verify --deep --strict --verbose=2 "apps/desktop/release/mac-arm64/Rodge Mail.app"`.

Quit the development shell before opening a packaged build, and quit the
packaged build before returning to `pnpm dev:desktop`; both intentionally share
the app's single-instance identity.

The `rodge-mail://` protocol remains registered for ordinary deep links in
packaged builds and attempted in the Electron development shell. Desktop
authentication uses the loopback callback because not every macOS browser
reliably launches a custom protocol. Both
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

The checked-in macOS, Windows, and Linux icons are generated from the locked
Mail Slot master with `node scripts/generate-brand-assets.mjs`; do not replace
them independently. CI should build and sign macOS artifacts on macOS and
Windows artifacts on Windows. The current configuration intentionally contains
no private keys, credentials, or auto-update publisher.
