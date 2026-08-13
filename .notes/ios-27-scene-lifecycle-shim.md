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

## ExpoModulesJSI Xcode 27 Archive Patch

The app now patches `expo-modules-jsi@57.0.4` only for its nested xcframework build script. Xcode 27 beta 5 can classify diagnostics emitted on stderr by that nested `xcodebuild` as a failed archive phase even when the command exits successfully:

```text
the following command failed with exit code 0 but produced no further output
```

The patch redirects the CocoaPods phase and nested build's stderr into stdout, and suppresses warnings only inside that nested ExpoModulesJSI build. The older SDK 56 Swift source rewrite is no longer needed. Remove this narrow patch once ExpoModulesJSI archives cleanly with the stable Xcode 27 toolchain.

Keep the scene lifecycle shim independent until Expo's generated app delegate supplies equivalent lifecycle support.
