# iOS 27 detached Search tab handoff from Worm

This note was written by the coding agent working in the sibling `worm` repo. Worm now has the iOS behavior Shawn wanted: Library and Settings remain ordinary tabs, while Search is a separate native search tab. Selecting Search keeps the library grid in place and presents the search field above the keyboard instead of navigating to a visibly separate search page.

The working reference is in `/Users/shawn/dev/projects/worm`:

- `patches/react-native-screens@4.26.2.patch` contains the native compatibility patch.
- `package.json` registers that file in `pnpm.patchedDependencies`.
- `apps/mobile/src/app/(tabs)/_layout.tsx` declares the Expo Router native tabs and marks Search with `role="search"`.
- `apps/mobile/src/features/library/native-library-search.ts` coordinates focus between the native search tab and the hidden route used to host the search controller.
- `apps/mobile/src/features/library/screens/library-search-screen.tsx` owns the native `Stack.SearchBar` and filters the same library UI.

## What the patch changes

On the iOS 27 beta used on Shawn's phone, Expo Router's `role="search"` still rendered as an ordinary tab. The fix is intentionally isolated to the `react-native-screens` pnpm patch so it can be removed when upstream behavior is reliable.

For iOS 27 and newer, the patch changes `RNSTabBarController` to:

1. Build modern `UITab` instances for normal Expo Router tabs.
2. Build a `UISearchTab` for the screen whose system item is Search.
3. Set that search tab as `prominentTabIdentifier`, which gives it the detached native placement.
4. Use `selectedTab` while the modern tab model is active, with small bridge helpers so the existing React Native Screens selection logic still works.
5. Forward the modern `shouldSelectTab` and `didSelectTab` delegate callbacks into the existing view-controller selection handlers.
6. Keep ordinary tabs at `UITabPlacementFixed`.

The version and availability guards are important. Older iOS versions continue through the library's original `setViewControllers` path. The patch is reversible: remove the `patchedDependencies` entry and patch file once `react-native-screens`/Expo Router provides equivalent working behavior on the device OS.

If the Rajmail agent needs more implementation context, inspect Worm commit `dc0b885` (`fix: detach search tab on iOS 27`), compare the files above, and use Worm's physical-device build as the known-good reference.
