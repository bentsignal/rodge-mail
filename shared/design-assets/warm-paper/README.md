# Warm Paper design system

This is the measured implementation system for the selected **Warm Paper Desk**
direction in `docs/rebrand-lab/generated-v2/05-warm-paper-desk.png`. It preserves
the concept's paper, forest-green furniture, and brass hardware without copying
the image model's incidental spacing or sacrificing native platform behavior.

## Design principle

The interface is a writing desk, not a pile of decorative cards. Paper is the
content surface, forest green is structural furniture, and brass is hardware.
Use material depth to clarify hierarchy. Do not add texture, borders, shadows,
or overlap when they do not communicate that hierarchy.

On iOS, keep native navigation, sheets, controls, and Liquid Glass tabs. Warm
Paper should appear in content surfaces and restrained accents around those
native elements, not as a replacement for them.

## Color system

The light palette holds neutral hues around 85–94 degrees in OKLCH; its surface
steps are separated primarily by lightness. The structural green stays around
161 degrees and the brass around 81 degrees. That intentional hue separation
makes the accent read as hardware rather than another beige surface.

| Role          | Light     | OKLCH               | Dark      | OKLCH               |
| ------------- | --------- | ------------------- | --------- | ------------------- |
| Canvas        | `#F5F0E5` | `95.6% 0.016 86.4`  | `#171B17` | `21.6% 0.010 145.2` |
| Paper         | `#FFFDF6` | `99.4% 0.009 93.6`  | `#242720` | `26.7% 0.013 126.2` |
| Muted paper   | `#EEE5D3` | `92.4% 0.026 84.6`  | `#2D3029` | `30.4% 0.013 126.1` |
| Primary ink   | `#2B2924` | `28.1% 0.009 88.8`  | `#F3EBDD` | `94.3% 0.021 81.8`  |
| Muted ink     | `#686158` | `49.6% 0.017 74.3`  | `#BEB8AA` | `78.4% 0.021 87.5`  |
| Forest        | `#173C2B` | `32.3% 0.053 161.4` | `#173C2B` | `32.3% 0.053 161.4` |
| Raised forest | `#214A36` | `37.3% 0.058 160.4` | `#214A36` | `37.3% 0.058 160.4` |
| Brass         | `#C99B43` | `71.6% 0.118 81.0`  | `#C89A42` | `71.3% 0.118 80.9`  |
| Danger        | `#A83F32` | `51.1% 0.141 29.8`  | `#D56A59` | —                   |

Brass is the only primary accent. Use it for the New/Send action, active pin,
small counts, and tactile hardware details. Forest is for navigation structure
and secondary actions. Coral/red is reserved for destructive state and tiny
mail-status marks.

### Verified contrast pairs

| Foreground on background |   Ratio | WCAG result |
| ------------------------ | ------: | ----------- |
| `#2B2924` on `#FFFDF6`   | 14.28:1 | AAA         |
| `#686158` on `#FFFDF6`   |  6.00:1 | AA          |
| `#756E63` on `#FFFDF6`   |  4.95:1 | AA          |
| `#2B2924` on `#F5F0E5`   | 12.78:1 | AAA         |
| `#F7F0DF` on `#173C2B`   | 10.76:1 | AAA         |
| `#C8D6C9` on `#173C2B`   |  8.10:1 | AAA         |
| `#251C0E` on `#C99B43`   |  6.60:1 | AA          |
| `#FFFFFF` on `#A83F32`   |  6.14:1 | AA          |
| `#F3EBDD` on `#242720`   | 12.80:1 | AAA         |
| `#BEB8AA` on `#242720`   |  7.67:1 | AAA         |
| `#E7DDCB` on `#171B17`   | 12.94:1 | AAA         |
| `#D4A64B` on `#242720`   |  6.75:1 | AA          |
| `#21190C` on `#C89A42`   |  6.75:1 | AA          |

Never place white text on brass. Use the specified dark brown button ink.
Texture is decorative and must not be relied upon to create contrast.

## Spacing and geometry

The system uses a 4px rhythm with 2px and 6px optical corrections:

`2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64`

- Compact controls: 8px vertical / 12px horizontal padding.
- Standard controls: 10–12px vertical / 16px horizontal padding.
- Message rows: 16px horizontal padding on mobile, 20px on desktop; never let
  sender, subject, preview, or metadata touch a container edge.
- Main panes: 24px inner padding at desktop widths, 16px on mobile.
- Adjacent primary controls: 8px minimum gap. Separate navigation groups by
  24px; separate page sections by 32px.
- Minimum touch target: 44x44pt on iOS and 44x44px elsewhere.

Radii are deliberately restrained: 8px controls, 12px cards, 16px paper
sheets, and 22px dialogs. Avoid pill shapes except native platform controls or
compact filters. A paper surface may use one folded corner; never use that
motif on every card.

## Borders and elevation

Use 1px `#D8CFBC` light / `#41453B` dark borders. Use the strong border only
for focused inputs, dividers against similar surfaces, or pressed hardware.

1. **Resting:** message row, input, or inset control. One faint contact shadow.
2. **Raised:** paper reader, attachment, popover trigger. Visible contact plus
   soft ambient shadow.
3. **Floating:** modal, menu, or drag item only. Never use floating elevation
   for every pane.

Apply the inset highlight token to brass controls and small attachment tiles.
Do not stack an opaque border, a heavy shadow, and a strong texture on the same
surface. Overlap is allowed only for paper metaphors such as an attachment or a
single selected message, and must not change hit targets or reading order.

## Texture assets

The three 128px seamless PNGs are deterministic, low-frequency material
textures generated by `generate-textures.mjs`:

- `paper-light.png`: primary light paper surface.
- `paper-muted.png`: secondary stationery and attachment surface.
- `paper-dark.png`: dark reader/list paper surface.

Regenerate after `pnpm install` with:

```sh
node shared/design-assets/warm-paper/generate-textures.mjs
```

### Web

Use the texture only on a paper surface, never as a translucent full-window
overlay:

```css
.paper-surface {
  background-color: var(--warm-paper);
  background-image: url("/design-assets/warm-paper/paper-light.png");
  background-repeat: repeat;
  background-size: 128px 128px;
}
```

The bitmap already includes the target base color. Do not raise opacity or add
`mix-blend-mode`; both make text rendering look dirty. In forced-colors mode,
remove background images and use system colors.

### React Native

Bundle the matching PNG with `require()` and render it through one
`ImageBackground` per major paper surface. Do not create an image view for each
mail row; use a single textured list background and opaque/transparent row
states above it. Set `resizeMode="repeat"` where supported, or use the 128px
asset as the source for a bounded surface.

Keep native tab bars, navigation bars, keyboards, and sheets texture-free.
Respect Reduce Transparency by falling back to the solid token color, and
avoid texture on low-power list-scrolling paths if it causes dropped frames.

## Typography and motion

Use the platform UI family for body, controls, and message metadata. A serif
display face may be used only for large page/message titles; prefer New York on
Apple platforms and a licensed web serif with Georgia as fallback. Body text
must remain at least 14px/pt, metadata 12px/pt, and line height 1.4–1.6.

Depth transitions may change shadow and translate by at most 1px over
120–180ms. Paper must not wobble, rotate, or continuously float. Disable
nonessential motion under reduced-motion settings.
