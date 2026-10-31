# App icon

One Liquid Glass icon, `rodge-mail.icon`, made as an Icon Composer document:
a folded paper plane. The near wing and the far wing are separate glass
layers, so the fold between them reads in every appearance. The concepts it
was chosen from are in PR #9's description.

Appearances:

- Light: a graphite plane on white.
- Dark: a white plane, its far wing in gray, on near-black.
- Clear and tinted: a white and a gray wing on near-black, which iOS turns
  into glass or tints.

## Geometry

The plane is four points on a 100-unit design grid (`build-icons.py`):
nose, near wing tip, far wing tip, and the notch where the fold meets the
back edge. Each wing is a triangle sharing the nose-to-notch fold, with
every corner rounded by an arc tangent to both edges. The plane is scaled
so its larger side is 640 of the canvas's 1024 pixels and centered
optically, halfway between its bounding box's center and its centroid,
because the nose carries most of the area.

## Files

- `rodge-mail.icon`: the Icon Composer bundle (`ios.icon` in `app.config.ts`).
- `previews/`: 180px light and dark renders.
- `rodge-mail-android-foreground.png`, `-background.png`, `-monochrome.png`:
  Android adaptive icon layers.
- `rodge-mail-android-notification.png`: Android's notification small icon.
- `../icon.png`: square, opaque, flat icon (the Expo fallback and the in-app
  logo). `../splash-icon.png` and `../splash-icon-dark.png`: the splash plane.
- `apps/web/public`: touch, PWA, and favicon PNGs. `favicon.ico` comes from
  the 32px PNG: `sips -s format ico favicon-32x32.png --out favicon.ico`.

## Editing

Change the design in `build-icons.py`, not in Icon Composer, then run it.
It writes the bundle, runs `render-flat.swift` for the flat assets, and
renders the previews. Check every iOS appearance with Apple's renderer:

```sh
python3 build-icons.py --check /tmp/rodge-icons   # Default, Dark, Clear*, Tinted*
```

A layer's light fill must be the unqualified entry in its
`fill-specializations`. If it is a plain `fill` instead, `ictool` and iOS
ignore the dark fill. `ictool` cannot open documents inside a sandbox; run
it from a normal shell.
