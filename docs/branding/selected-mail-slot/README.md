# Selected Rodge Mail mark: Mail Slot

The selected Rodge Mail identity is concept **#08 — Mail Slot** from logo
exploration round three.

## Locked source

- Selected master: `rodge-mail-mail-slot-source.png`
- Exploration source: `../../branding-lab/logo-round-3/08-mail-slot.png`
- Dimensions: 1254 × 1254 pixels
- Color mode: RGB
- SHA-256: `6e90be38916cb180846b5072dccf5b37ddf42d30bb57d2831457596215a07e5c`

The selected master is an unchanged copy of the approved concept. Shipping web,
desktop, and mobile assets are generated from it by
`node scripts/generate-brand-assets.mjs`.

## Production outputs

- Expo iOS and Android icon: `apps/mobile/assets/rounded-icon.png`
- Expo splash image: `apps/mobile/assets/splash-icon.png`
- macOS application icon: `apps/desktop/resources/icon.icns`
- Windows application icon: `apps/desktop/resources/icon.ico`
- Linux application icon: `apps/desktop/resources/icon.png`
- Web favicon and touch icons: `apps/web/public/`

Android deliberately uses the full selected artwork as its application icon
instead of fabricating a transparent adaptive foreground. The selected image
already contains its rounded housing and surrounding dark field, so treating it
as an adaptive foreground would shrink or double-mask the approved composition.

## Identity cues to preserve

- A tightly cropped, front-facing brass mail slot mounted in a deep green
  painted-metal housing.
- A cream envelope visibly emerging from the slot, with its triangular flap
  readable at small sizes.
- A small muted-red postage stamp in the lower-right corner of the envelope.
- Tactile cast-metal and paper surfaces with controlled depth; premium and
  physical, without becoming photorealistic clutter.
- Rounded housing corners and a near-square centered composition suitable for
  platform icon masks.

## Integration palette targets

These are the named production targets for preserving the selected image's
color relationships during platform integration:

| Role            | Target                         |
| --------------- | ------------------------------ |
| Painted housing | British racing green `#0F2A1C` |
| Mail-slot metal | Aged brass `#A7762E`           |
| Slot recess     | Near-black umber `#140F08`     |
| Envelope        | Warm parchment `#E9D0A0`       |
| Postage stamp   | Muted postal red `#B65B47`     |

The raster source remains the visual authority. Any vector redraw, small-size
optical adjustment, monochrome derivative, or platform-specific crop should be
reviewed against it rather than replacing its material character with a generic
flat envelope icon.
