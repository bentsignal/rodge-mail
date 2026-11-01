# App icon

One Liquid Glass icon, `rodge-mail.icon`, made as an Icon Composer document:
a folded paper plane. One rounded silhouette is cut along the fold into a
near wing and a far wing, two glass layers that share a single rounded nose.
The far wing is the near wing's color in shadow. The concepts it was chosen
from are in PR #9's description.

Appearances:

- Light: a graphite plane on white, its far wing at 0.68 of the near wing's
  color.
- Dark: a white plane on near-black, its far wing at 0.74.
- Clear and tinted: a white near wing and a `#bdbdbd` far wing on near-black,
  which iOS turns into glass or tints.

## Geometry

The plane is four points on a 100-unit design grid (`build-icons.py`): nose,
far wing tip, notch, and near wing tip. The outline grows by 3.5 units with
round corners, matching the approved design's 7-unit round-join stroke: each
edge moves out and each convex corner becomes an arc around its original
vertex. The notch is a reflex corner and gets a 1-unit concave arc.

The silhouette is then clipped against the fold, the line through the
original nose and notch. The near wing ends exactly on the fold; the far wing,
behind it, reaches 1.5 px past it, because Icon Composer antialiases each
layer on its own and wings that only touch show the background through a
hairline. The silhouette is scaled so its larger side is 640 of the canvas's
1024 pixels and centered optically, halfway between its bounding box's center
and its centroid, because the nose carries most of the area.

The flat renders fill each wing together with the wings in front of it, so
they have no seam either. The white Android icons shade the far wing with
alpha instead of gray.

## Files

- `rodge-mail.icon`: the Icon Composer bundle (`ios.icon` in `app.config.ts`).
- `previews/`: 180px light and dark renders.
- `rodge-mail-android-foreground.png`, `-background.png`, `-monochrome.png`:
  Android adaptive icon layers.
- `rodge-mail-android-notification.png`: Android's notification small icon.
- `../icon.png`: square, opaque, flat icon (the Expo fallback and the in-app
  logo). The splash has no logo: `../splash-blank.png` is a transparent pixel.
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
