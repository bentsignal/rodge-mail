# iOS 27 Scene Lifecycle Shim

## Status

The mobile app currently needs a local Expo config plugin that adds iOS scene lifecycle support during prebuild. This is in place because development builds on the iOS 27 beta were crashing immediately on launch before React Native or app JavaScript could run.

The crash was an iOS runtime trap related to missing scene lifecycle adoption. The generated Expo native project did not include `UIApplicationSceneManifest` or a `SceneDelegate`, and iOS 27 beta appears to enforce that more aggressively.

Current local workaround:

- `apps/mobile/expo-plugins/with-ios-scene-lifecycle.cjs`
- registered from `apps/mobile/app.config.ts`

This should be treated as temporary beta compatibility code.

## Why It Works

The plugin adds a `UIApplicationSceneManifest` entry to the generated `Info.plist` and creates a minimal `SceneDelegate.swift`.

The scene delegate attaches the existing `AppDelegate.window` to the incoming `UIWindowScene`, makes it visible, and forwards URL/universal link events through `RCTLinkingManager`. It intentionally leaves Expo's generated `AppDelegate.swift` alone, which avoids breaking Expo Dev Client / Dev Launcher initialization.

In short: iOS gets the scene lifecycle objects it now expects, while Expo still owns the normal React Native startup path.

## What To Watch For

Look for an upstream Expo fix in any of these places:

- Expo SDK patch releases for the app's current SDK line.
- `expo` native template changes that add `UIApplicationSceneManifest`.
- `expo` native template changes that add `SceneDelegate.swift`.
- `@expo/prebuild-config` changes that generate iOS scene lifecycle support.
- Expo release notes or GitHub issues mentioning iOS 27, scene lifecycle adoption, `UIApplicationSceneManifest`, `SceneDelegate`, or `NoSceneLifecycleAdoption`.

As of June 9, 2026, the latest stable Expo package and native template checked did not appear to include this fix.

## Removal Plan

Remove this shim as soon as Expo ships native scene lifecycle support that works with iOS 27 beta builds.

Before removing it, verify with a clean prebuild/build/install cycle on an iOS 27 device:

1. Remove `with-ios-scene-lifecycle.cjs` from `app.config.ts`.
2. Rebuild a fresh development client.
3. Install it on the iOS 27 device.
4. Confirm the app launches repeatedly without an immediate pre-JS crash.
5. Confirm deep links / universal links still work.

If Expo's generated native project includes equivalent scene lifecycle support, delete the local plugin file too.

Commit where we added this stuff: 2a1a3dfadda7dd973ae7d860342bfdc09f5b3167

## ExpoModulesJSI Swift Compiler Patch

The repo also currently patches `expo-modules-jsi@56.0.8` through pnpm:

- `patches/expo-modules-jsi@56.0.8.patch`
- registered in `pnpm-lock.yaml` under `patchedDependencies`

This patch is separate from the scene lifecycle shim. It exists because local EAS iOS builds with the Xcode beta / iOS 27 SDK hit two ExpoModulesJSI-specific issues.

The first issue was a Swift compiler failure. The failing code passed a ternary expression directly into a C++ interop initializer:

```swift
set == nil ? nil : setter
```

The patch rewrites that as an explicit `if set == nil { ... } else { ... }` initializer call. The behavior is intended to be equivalent; it only gives the newer Swift compiler a clearer type boundary.

The second issue affected physical-device archives. Xcode 27 beta treated diagnostics emitted by ExpoModulesJSI's nested xcframework build script as a `PhaseScriptExecution` archive failure even though the script exited successfully:

```text
the following command failed with exit code 0 but produced no further output
```

The patch redirects the ExpoModulesJSI CocoaPods script phase stderr into stdout and suppresses Swift/Clang warnings only for the nested `xcodebuild` that creates the ExpoModulesJSI xcframework. This is intentionally scoped to ExpoModulesJSI rather than all app or pod builds.

As of June 10, 2026, `expo-modules-jsi@56.0.8` was the latest stable SDK 56 package checked, so there was no stable package update available to replace the patch.

Remove this patch once Expo ships a stable SDK 56 patch release, or a later SDK upgrade, where ExpoModulesJSI builds cleanly with the Xcode beta / iOS 27 SDK without the local Swift rewrite or nested build warning suppression. Before removing it, delete the `patchedDependencies` entry, run a fresh install, and verify both a clean local iOS simulator build and a local physical-device `development:client` archive.
