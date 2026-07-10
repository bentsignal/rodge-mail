# Portless Mobile Dev Servers

## Intent

We wanted mobile development to have the same stable URL behavior as web development: start a dev server without caring which random port it chose, then connect from iOS and Android using a predictable Portless hostname.

The desired mobile URL was a stable `mobile.rodge-mail.local` style address rather than manually copying a local IP plus whatever port Expo/Metro picked for that run.

## What Worked

Portless LAN mode can expose routes as `.local` hostnames that simulators and devices can reach over the local network. That solved the discovery/name part of the problem.

For iOS, once the Portless local CA was trusted by the simulator, the app could load through the stable Portless URL. Physical iOS devices need the same CA installed and fully trusted: install `~/.portless/ca.pem` on the device, then enable it in Settings -> General -> About -> Certificate Trust Settings. Installing the profile alone is not enough.

For Android, the app also needed to trust the Portless local CA. Android does not generally trust user-installed certificates for app network traffic unless the app opts into that in its network security config, so the Android development build needed a config plugin that allows user certificate authorities.

## Why Expo Needed Extra Handling

Expo dev client does not only use the URL you type in. It fetches a native manifest, and that manifest points to the JavaScript bundle and assets. When Expo runs behind Portless directly, parts of the native manifest can leak the internal Metro port or local host information.

That defeated the purpose of Portless: the first URL was stable, but the dev client still tried to connect to the internal dynamic port.

To fix that, we introduced a small bridge process between Portless and Expo:

- Portless owns the public stable hostname.
- The bridge starts Expo/Metro on a random internal port.
- The bridge proxies requests to Metro.
- The bridge rewrites native manifest, bundle, asset, and host references so the device only sees the stable Portless URL.

One important detail: Expo dev client may request manifests using an Expo-specific JSON content type, not just plain `application/json`. Any future rewrite logic needs to treat `+json` responses as JSON-like and rewrite them too.

Another important detail: native bundle requests should not rely on Metro split-bundle loading while running through this bridge. OAuth sign-in can trigger dynamic imports during the auth callback path, and failures in that split-bundle path can be reported as misleading missing-package errors. The bridge forces native Metro bundle requests to use non-lazy bundles so dynamic imports resolve from the already-loaded bundle instead of fetching secondary chunks through the proxy.

## Android Certificate Trust

The Android development build must be generated with a network security config that trusts both system and user certificate authorities. That allows an emulator or device to trust the Portless local CA after the CA is installed by the developer.

This is intentionally a development-client concern. Do not carry broad user-CA trust into production builds unless there is a clear production reason.

After this config changes, Android needs a rebuilt development client. Merely restarting Metro is not enough because Android network security config is part of the native app.

## Future Agent Notes

If mobile Portless loading breaks again, check these areas first:

- Is the Portless proxy running in LAN mode so `.local` names are active?
- Does the device or simulator trust the Portless local CA? On physical iOS, confirm full trust is enabled in Certificate Trust Settings, not just that the profile is installed.
- For Android, was the dev client rebuilt after any network security config change?
- Does the Expo manifest shown to the device contain only the stable Portless hostname, or does it leak an internal Metro port?
- Are Expo-specific JSON responses being rewritten, including content types ending in `+json`?
- Are native bundle requests being sent to Metro as non-lazy bundles, so auth-time dynamic imports do not depend on secondary split-bundle fetches?
- Is the bridge still proxying WebSocket upgrades as well as normal HTTP requests?

Avoid solving this by assigning fixed Metro ports. The goal of this setup is to preserve Portless's dynamic-port behavior while giving mobile clients a stable URL.
