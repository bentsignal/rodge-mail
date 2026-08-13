---
name: rodge-expo-build
description: Build, install, and test the Rodge Mail Expo React Native app through local EAS development-client workflows. Use for iOS Simulator builds, physical iPhone development builds, Android development builds, Expo dev-client/Portless iteration, native passkey testing, signing or provisioning diagnostics, and any task that might otherwise run Xcode or generated native projects directly. Always use local EAS builds unless the user explicitly requests a cloud build.
---

# Rodge Expo Build

## Core rule

Treat `apps/mobile` as an Expo-managed app. Build and install native binaries through Expo and local EAS.

Do not use `expo run:ios`, `expo run:android`, Xcode, Gradle, or direct `xcodebuild` as the primary build workflow. Do not edit `apps/mobile/ios` or `apps/mobile/android` as source. Those folders are generated artifacts for inspection and temporary diagnostics only. Make native behavior changes through `app.config.ts`, Expo config plugins, `eas.json`, or package source.

Use XcodeBuildMCP after installing the local EAS simulator artifact to launch the app, inspect UI, collect logs, and interact with Simulator.

## App facts

- App directory: `apps/mobile`
- Expo config: `apps/mobile/app.config.ts`
- EAS config: `apps/mobile/eas.json`
- Slug and scheme: `rodge-mail`
- iOS bundle identifier: `com.bentsignal.rodgemail`
- Android package: `com.bentsignal.rodgemail`
- Simulator profile: `development:client:sim`
- Standalone physical-device profile: `development`
- Development-client physical-device profile: `development:client`

## Standard checks

Run from the repository root before or after meaningful build-facing changes:

```bash
pnpm --filter @rodge-mail/mobile lint
pnpm --filter @rodge-mail/mobile typecheck
```

Follow the repository `AGENTS.md` validation sequence after source changes.

## iOS Simulator workflow

Build the development client locally:

```bash
cd apps/mobile
pnpm exec eas build --local --platform ios --profile development:client:sim --output ./build/rodge-mail-development-client-simulator.tar.gz
```

Extract the artifact, boot or select the requested Simulator through XcodeBuildMCP, install the `.app`, and launch it. Do not substitute a direct Xcode build for this EAS build.

Start Metro through the repository's Portless wrapper for JS iteration:

```bash
pnpm --filter @rodge-mail/mobile dev
```

The installed development client must connect to `https://mobile.rodge-mail.local`. Use Expo dev-client mode; Expo Go cannot test Rodge Mail's native passkeys.

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

## Android workflow

Use the existing `development:client:sim` profile for a local development-client APK unless another profile is explicitly requested:

```bash
cd apps/mobile
pnpm exec eas build --local --platform android --profile development:client:sim --output ./build/rodge-mail-development-client.apk
```

Install the APK with Android tooling, then run Metro through the same Portless-backed mobile dev command.

## Reporting

Always report:

- Local or cloud EAS build
- EAS profile
- Artifact path and type (`.app` archive, `.ipa`, or `.apk`)
- Simulator or physical-device identifier used for installation
- Whether Metro used `https://mobile.rodge-mail.local`
- `aps-environment` value and APNs credential readiness
- Whether the Convex token registration and remote receipt gates passed
- Exact signing, provisioning, passkey, or device blocker
