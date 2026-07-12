# Warm Paper image assets — v2

Generated with the built-in image generation workflow using
`docs/rebrand-lab/generated-v2/05-warm-paper-desk.png` as a style reference.
These are source candidates, not runtime wiring.

## Recommendation

- **Paper:** `final/paper-texture-selected.png` (candidate C). It is the quietest
  option and has the smallest measured edge mismatch: roughly 1–2 RGB values.
  Use at low visual prominence; avoid contrast or blend-mode amplification.
- **Corner:** `final/folded-corner-selected.png` (candidate A). It has the cleanest
  silhouette and most restrained material treatment of the isolated options.
  The alpha PNG intentionally retains only the paper and stamp object.
- **Dark mode:** omit the corner/stamp ornament. A light-paper curl on a dark
  surface reads as pasted decoration, while recoloring it removes the material
  credibility that makes the light treatment work.

`index.html` shows all paper and corner candidates on representative surfaces.
The `raw/` directory retains the untouched generated images and chroma-key
sources. The `final/` directory contains the usable paper PNGs and alpha-matted
corner PNGs.

## Prompts

### Paper candidates

All three asked for a uniform, warm ivory cotton/laid-paper surface based on the
reference's light reading pane. Prompts explicitly prohibited diagonal banding,
gradients, stains, wrinkles, visible fibers, directional lighting, obvious
noise, and any feature that would interfere with dense interface text.

- **A:** fine natural tooth, warm ivory near `#f5f0e3`.
- **B:** slightly warmer laid-paper stock near `#f2ecde`.
- **C:** quiet cotton-rag paper near `#f7f2e7`, with texture visible only under
  close inspection.

### Folded corner candidates

All corner prompts requested an isolated bottom-right warm-ivory paper curl with
a small coral perforated stamp, matching concept 05's restrained 3D material
feel. Prompts prohibited cartoons, outlines, clip art, sticker treatment, CSS
triangle geometry, lettering, emblems, and external shadows. They were generated
on a flat green chroma key and converted to alpha with the imagegen skill's
`remove_chroma_key.py` helper using soft matte and despill.

- **A:** strongest balanced production candidate; clean curl and readable stamp.
- **B:** smallest and quietest, but materially too flat.
- **C:** most convincing page curl, but includes too much of the base sheet.
- **D:** additional iteration with stronger curl depth; more assertive than A.

