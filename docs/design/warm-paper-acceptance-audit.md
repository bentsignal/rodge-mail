# Warm Paper acceptance audit

## Scope

Compared the Concept 05 Warm Paper Desk reference with the current Electron
light/dark captures, the mobile composer capture, and the dimensions encoded in
the current components. This is an acceptance audit, not a request for more
decoration. Measurements below are either visible pixels in the supplied
captures or explicit values in the implementation.

## Highest-impact issues

### Web and Electron

1. **Electron still renders as an app inside an app.** The desktop runtime adds
   `16px` padding around the entire shell, then gives the inner frame a `20px`
   radius and floating shadow. In the `1171 × 768` proofs this creates a dark
   gutter around all four edges and reduces the working area by about `31px` in
   each dimension. Concept 05 reads as one full-bleed workspace. Acceptance:
   the workspace reaches the window edges; only the content planes have seams.

2. **The responsive account rail has an abrupt, lossy width cliff.** It is
   `76px` from the medium breakpoint through `1279px`, then jumps to `216px` at
   `1280px`. Labels, account identity, and counts disappear across that entire
   `512px` range. Acceptance: use a deliberate compact rail at constrained
   widths and a labeled rail when the message list and reader can retain their
   minimum usable widths; do not switch based on a single unrelated viewport
   breakpoint.

3. **Message text receives only about 65% of the already-narrow row width.** The
   list is `340–385px`; at the common `360px` width, each link reserves `20px`
   left padding, `56px` right padding, a `36px` avatar, and a `12px` gap. That
   leaves roughly `236px` before the time and other inline content, which
   matches the premature subject truncation in both proofs. Acceptance: retain
   at least `280px` of text measure at a `360px` pane, or move the pin action
   into the metadata line/reveal state so it does not reserve `56px` permanently.

4. **Row separation is visually noisy instead of paper-like.** Every message
   has both top and bottom borders, a resting shadow, and a `4px` gap; the
   selected row adds translation, stronger borders, another shadow, and a `3px`
   red marker. At six visible rows, this produces more than twenty horizontal
   edge/shadow cues. Acceptance: one stable separator rhythm for ordinary rows
   and one unambiguous selected treatment, without changing row geometry.

5. **The inbox count is below a practical reading size.** The count is `10px`
   and its “shown” label is `7px`, while the adjacent Inbox title is `32–34px`.
   The badge is visibly decorative rather than useful in the light proof.
   Acceptance: remove the redundant word or set all informative text to at
   least `11–12px`; the badge must remain readable at 100% scale.

6. **Dark mode loses plane hierarchy.** Dark canvas `#171b17` and paper
   `#242720` have only a `1.15:1` contrast ratio; paper borders against paper are
   `1.54:1`. Shadows cannot carry structure reliably on different displays.
   The dark proof consequently reads as one muddy plane. Acceptance: separate
   rail, list, reader, and raised controls with a repeatable luminance step or a
   clear seam, while keeping text contrast (currently strong) intact.

7. **The dark red action color misses normal-text AA.** `#d56a59` on dark paper
   `#242720` is approximately `4.35:1`, below the `4.5:1` threshold for normal
   text. It is used for semantic links and active marks. Acceptance: reserve it
   for non-text accents/large marks or adjust the token to reach `4.5:1`.

### Mobile

8. **The mobile dark composer does not own the top safe area.** The supplied
   `368 × 800` proof has a white system area from approximately `y=0–59`, then
   the dark composer begins at `y=60`. This is a full-width theme discontinuity,
   not a minor color mismatch. Acceptance: the navigation/status-bar background
   matches the composer in both themes, including first paint and tab switches.

9. **The composer page and its cards are the same surface.** Both
   `PostalPaperBackground` and `PostalSurface` use `bg-paper`; in dark mode that
   is `#242720`, and in light mode it is `#fffdf6`. The cards therefore depend
   on a `1.54:1` border and a low-opacity shadow for all hierarchy, explaining
   the blank white slab reported in light mode and the outline-only dark proof.
   Acceptance: use canvas/well/paper as distinct functional planes, or simplify
   the fields into one native grouped form instead of stacking identical cards.

10. **The empty message well dominates the initial compose state.** The body
    input has a fixed minimum height of `256px`, or 32% of the entire supplied
    screen. With the `59px` header, `58px` tab bar, fields, gaps, and attachment
    control, the initial form is forced into a long mostly-empty slab. Acceptance:
    let the body flex into remaining space with a sensible lower bound, and show
    a clear account-recovery action when the current “No sending account” state
    disables Send.

## Concept details to omit or defer

- Omit overlapping and tilted message cards. They reduce scan alignment, make
  virtualization geometry unstable, and add no mail task value.
- Keep Expo's native tab bar. Do not reproduce the concept's custom five-item
  mobile tab bar or bake faux Liquid Glass into app content.
- Do not reproduce desktop traffic lights or a title bar inside the web app.
  Electron should integrate with native window controls; web should remain
  full-bleed.
- Defer the folded corner and postage stamp until a production asset can pass a
  content-obstruction check at every reader size. The current evidence supports
  paper hierarchy and depth, not an unconditional decorative overlay.
- Do not copy image-generated microtype or invented controls. The concept is a
  composition reference; labels, counts, focus states, and hit targets must
  remain real and accessible.

## Proof limitations

The supplied mobile proof covers only the composer. It cannot accept the inbox
header, search, thread reader, gestures, reply placement, or pull-to-refresh.
The visible `scroll:0,0 402x743` string may be capture instrumentation; require a
clean proof before treating it as a product defect. Final acceptance needs clean
light/dark captures at the compact rail breakpoint, the labeled rail breakpoint,
and one physical or simulator mobile inbox/reader/composer sequence.
