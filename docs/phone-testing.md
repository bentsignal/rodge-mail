# Testing a worktree on Shawn's phone (planned)

Vera serves each worktree to Shawn's phone with `scripts/phone.sh`: a
separate **Vera Dev** app (its own bundle ID) runs a dev client that loads
the worktree's JavaScript from its Metro over Wi-Fi or Tailscale, so he can
test every PR on the phone before it merges. Rodge doesn't have that yet,
and `scripts/phone.sh` isn't ported.

## Why not now

Rodge Mail has one app ID, `com.bentsignal.rodgemail`, and the phone runs
it as a standalone `development` build with its JavaScript embedded. That
is Shawn's everyday mail app. A dev client with the same ID would replace
it, and his mail would then only open while a Mac's Metro is reachable.
Doing this well needs a second app beside it.

## Plan: Rodge Dev

TODO(Shawn): needs Apple provisioning, so it's a separate PR.

1. **A variant in `app.config.ts`**: `APP_VARIANT=development` gives name
   "Rodge Dev", bundle ID and package `com.bentsignal.rodgemail.dev`, scheme
   `rodge-mail-dev`, and a distinct icon. Without the variant the config is
   unchanged, so the everyday app's fingerprint doesn't move.
2. **Apple setup**: register the bundle ID, enable Push Notifications and
   Associated Domains for it, and an ad hoc profile with Shawn's iPhone
   (`eas credentials`). Add `webcredentials:dazzling-dog-633.convex.site`
   for it to the Apple app-site association the Convex HTTP router serves,
   so native passkeys work in Rodge Dev too.
3. **Android**: add the dev package's signing certificate to
   `ANDROID_PASSKEY_ORIGINS` and `assetlinks.json` (services/convex/AUTH.md).
4. **An EAS profile** for the phone dev client (`development:client` with
   `APP_VARIANT=development`).
5. **Port `scripts/phone.sh`** from Vera: build that profile once per
   native fingerprint (cached in `~/Library/Caches/rodge-mail`, under the
   shared heavy-work lock), upload an install page
   (`scripts/install-page.sh`, to `vera-evidence/rodge-mail/dev-client/`),
   start the worktree's Metro (`scripts/lib/metro.sh` already counts
   `phone-ios` and `phone-android` users), put `tailscale serve` in front of
   it, and print the open links (an https page that opens
   `rodge-mail-dev://expo-development-client/?url=…`). Then the Stop hook
   runs `phone.sh sweep` to stop phone servers idle for a day, as Vera's
   does.
6. **Workflow**: the `rodge-feature` skill gains Vera's step 4b (serve the
   worktree to the phone when the PR is ready to test, and keep it up
   through feedback), and the `merge` skill brings it down.

Sign-in on Rodge Dev is Shawn's own passkey, so no session minting is
needed there.
