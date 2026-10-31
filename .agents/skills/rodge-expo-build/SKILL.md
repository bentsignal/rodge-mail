---
name: rodge-expo-build
description: Build and install Rodge Mail's native binaries through local EAS. Use for physical iPhone development builds (the standalone IPA on Shawn's phone, its entitlement and push-notification checks), dev client build failures, native passkey testing, signing or provisioning diagnostics, and any task that might otherwise run Xcode or generated native projects directly. Simulators and emulators go through scripts/sim.sh and the rodge-simulator skill, never this skill's commands. Always use local EAS builds unless the user explicitly requests a cloud build.
---

# Rodge Expo Build

## Core rule

Treat `apps/mobile` as an Expo-managed app. Build and install native binaries through Expo and local EAS.

Do not use `expo run:ios`, `expo run:android`, Xcode, Gradle, or direct `xcodebuild` as the primary build workflow. Do not edit `apps/mobile/ios` or `apps/mobile/android` as source. Those folders are generated artifacts for inspection and temporary diagnostics only. Make native behavior changes through `app.config.ts`, Expo config plugins, `eas.json`, or package source.

**Simulators and emulators start only through `scripts/sim.sh`** and the
system-wide queue it shares with every repo on Shawn's Mac (the
`rodge-simulator` skill). Never boot, create, or install onto a simulator or
emulator yourself: no `xcrun simctl boot`, no XcodeBuildMCP `boot_sim` or
`build_run_sim`, no `expo run:*`, no `pnpm ios`/`dev:ios`/`dev:android`, no
`emulator -avd`.

## App facts

- App directory: `apps/mobile`
- Expo config: `apps/mobile/app.config.ts`
- EAS config: `apps/mobile/eas.json`
- Slug and scheme: `rodge-mail`
- iOS bundle identifier: `com.bentsignal.rodgemail`
- Android package: `com.bentsignal.rodgemail`
- Simulator profile: `development:client:sim`
- Standalone physical-device profile: `development`
- Development-client physical-device profile: `development:client`. Don't
  install it on Shawn's phone unless he asks: it has the same bundle ID, so
  it replaces his everyday standalone app with one that needs Metro
  ([docs/phone-testing.md](../../../docs/phone-testing.md)).

## Standard checks

Run from the repository root before or after meaningful build-facing changes:

```bash
pnpm --filter @rodge-mail/mobile lint
pnpm --filter @rodge-mail/mobile typecheck
```

Follow the repository `AGENTS.md` validation sequence after source changes.

## Simulator and emulator dev clients

`scripts/sim.sh up` builds the dev client itself, with the
`development:client:sim` profile, once per native fingerprint:

```bash
eas build --local --non-interactive --profile development:client:sim --platform ios --output <tmp>/client.tar.gz
```

It extracts `RodgeMail.app` into `~/Library/Caches/rodge-mail/dev-client-ios/<fingerprint>/`
(the Android APK goes to `dev-client-android/`), under the heavy-work lock
every repo shares, then installs it on this worktree's queued simulator and
starts the worktree's own Metro on a plain port. `scripts/sim.sh build`
runs only the build. Debug a failing build by reading that EAS output; don't
replace it with a direct Xcode build.

## Physical iPhone workflow

Confirm the paired device:

```bash
xcrun devicectl list devices
```

Build a standalone local EAS development `.ipa` with its JavaScript bundle
embedded:

```bash
cd apps/mobile
pnpm exec eas build --local --platform ios --profile development --output ./build/rodge-mail-development.ipa
```

Verify the embedded provisioning profile and app entitlement before
installation:

```bash
security cms -D -i Payload/RodgeMail.app/embedded.mobileprovision
codesign -d --entitlements :- Payload/RodgeMail.app
```

Do not install an IPA unless both the profile and signed app contain an
`aps-environment` entitlement and the signed app contains
`webcredentials:dazzling-dog-633.convex.site`. Confirm that EAS reports push
notifications as configured during the build. That public domain serves its
Apple app-site association from Convex, so the installed standalone app does
not require Metro, Portless, or access to the development machine.

Install the verified IPA:

```bash
xcrun devicectl device install app --device <device-uuid> ./build/rodge-mail-development.ipa
```

Launch the installed app, keep the authenticated session active, and complete
the notification acceptance gate for every physical-iPhone build:

1. Confirm iOS notification permission is authorized and Rodge Mail's `New
   mail` setting reports the device as ready. A denied permission is a device
   blocker, not a successful build result.
2. Inspect the active Convex deployment's `mobilePushTokens` table and confirm
   the current installation registered an enabled token after launch. Do not
   print or report the token value.
3. Trigger one remote notification through the real Convex → Expo → APNs path.
   A local notification preview does not satisfy this gate.
4. Confirm the delivery has a nonzero token count and its Expo push receipt
   reaches `delivered`. Treat missing tokens, `skipped` delivery, failed
   tickets, and missing receipts as blockers to diagnose before handoff.

When the phone is reachable only through Tailscale, verify CoreDevice
availability separately. Tailscale ping success does not prove that Apple's
trusted developer connection or service discovery is available; use USB or the
same local network when CoreDevice reports the phone as unavailable.

For every other signing or provisioning issue, use EAS credentials, Expo
config, and EAS profiles. Never patch generated Xcode signing settings as the
solution.

## Android

The emulator dev client is `scripts/sim.sh --android up` (the same
`development:client:sim` profile, an APK). A physical Android device isn't
part of Shawn's setup yet.

## Reporting

Always report:

- Local or cloud EAS build
- EAS profile
- Artifact path and type (`.app` archive, `.ipa`, or `.apk`)
- Physical-device identifier used for installation
- `aps-environment` value and APNs credential readiness
- Whether the Convex token registration and remote receipt gates passed
- Exact signing, provisioning, passkey, or device blocker
