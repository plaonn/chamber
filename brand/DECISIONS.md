# Chamber Brand Decisions

This file preserves **durable design rationale**, not every exploratory draft.

## 2026-08-08 — Canonical standalone symbol remains immutable

Decision:

- Keep `chamber-symbol-v1` unchanged while evolving the wordmark.
- Derivatives must reconstruct the canonical geometry exactly rather than visually reinterpret it.

Why:

The standalone symbol geometry and Aurora relationship were already accepted. Reopening it during typography work would turn a wordmark decision into an uncontrolled symbol redesign.

## 2026-08-08 — Wordmark inherits the frame, not the wedge angle

Decision:

- 45° is the alphabet/frame bevel system.
- 34° belongs only to the entering wedge.

Why:

The alphabet should inherit the symbol's construction philosophy while keeping the wedge distinctive.

## 2026-08-08 — Use icon-derived inset geometry instead of uniform apparent stroke thickness

Decision:

- Orthogonal construction uses the scaled frame inset `T = 37.5`.
- 45° construction inherits the canonical outer/inner bevel offset `D = 61.5`.
- The resulting perpendicular diagonal thickness is about `43.487`, not 37.5.

Why:

Forcing every visible direction to the same numeric thickness contradicts the finalized symbol.

## 2026-08-08 — Canonical lowercase module is W = 116.5

Decision:

- `h`, `b`, `e`, `r` use one module `W = 116.5`.
- `a = W + T = 154`.
- `m = 2W - T = 195.5`, representing two W modules sharing one T stem.

Why:

The accepted `a` exposed a natural body width of `154 - 37.5 = 116.5`. The same value reconciles the independently balanced lowercase proportions.

## 2026-08-08 — `a` uses a symmetric counter and isosceles notch

Decision:

- Keep the counter square and symmetric about its lower-left → upper-right 45° axis.
- Keep the lower-right diagonal at the icon-derived bevel offset.
- Separate bowl and tail with an isosceles-right triangular notch whose two sides are ±45°.

Why:

The symmetric counter and notch preserve the 45° system and keep the bowl/tail separation intentional.

## 2026-08-08 — `r` uses the equal terminal member

Decision:

- Use `H = V = 30.75`.
- Preserve `H + V = D = 61.5`.
- Upper stem/diagonal split is y = 134.25 at the canonical 240-high scale.

Why:

The equal member was the most balanced of the horizontal-only, equal, and vertical-only members of the same construction family.

## 2026-08-08 — Lowercase faces are unified before Aurora paint

Decision:

- Emit each lowercase glyph as a unified contour/compound path.
- Do not construct final colored glyphs from overlapping independently painted rectangles.

Why:

Semi-transparent Aurora layers double-painted rectangle intersections and created darker join artifacts. Geometry composition and color composition must be separate: build the face first, paint it once per Aurora layer.

## 2026-08-08 — Canonical wordmark v2 uses symbol-as-C

Decision:

- Replace the separate geometric capital-C concept with the Chamber symbol geometry acting as the visual `C`.
- Scale the symbol derivative to 208 × 208 at y=32..240 so it aligns with the lowercase ascenders.
- Use a 31-unit gap from the symbol bounding box to `h`.
- Keep the standalone symbol independently usable and unchanged.

Why:

A standalone symbol placed next to a full `Chamber` wordmark produced two competing visual centers. Making the symbol itself the `C` gives the wordmark one clear identity hierarchy while preserving the symbol's recognizable construction.

## 2026-08-08 — Transparent wordmark wedge requires a cut frame

Decision:

- Remove the wedge region from the wordmark's chamber frame before painting the wedge.
- Paint the translucent wedge over that empty region rather than over a complete octagonal frame.

Why:

Once the wedge became translucent, leaving the full frame underneath made the octagon visible through the wedge and destroyed the intended opening/interface reading.

## 2026-08-08 — Wordmark frame and letters share one field; wedge keeps an independent field

Decision:

- Apply one broad continuous Aurora field across the cut-C frame and `hamber`.
- Apply a separately arranged wedge field using the same narrow Indigo/Violet/Orchid/Rose palette.
- Derive the wedge hotspot arrangement from the standalone wedge field through the symbol-as-C transform.

Why:

A continuous field ties the visual `C` to the letters. An independent wedge field preserves interface separation without making the wedge look like an unrelated color object.

## 2026-08-08 — Wedge uses normal 50% + overlay underlayer 15%

Decision:

- Render the wedge field once as an `overlay` underlayer at 15% opacity.
- Render the same wedge field again normally at 50% opacity.
- Keep this order: blend underlayer first, normal layer second.

Why:

Pure opacity gave the wedge too little adaptive value structure, while white-baked opaque color made the wedge dominate dark backgrounds. Applying overlay as the only blend result made the wedge collapse on extreme backgrounds. Keeping a normal translucent layer guarantees visibility; the low-contribution overlay layer adds backdrop-responsive value variation.

`overlay` and `soft-light` subtle variants were visually very close. `overlay` was selected as the tie-breaker because it is the simpler blend primitive, not because a material performance difference is expected for a static logo.

## 2026-08-08 — Do not use a redundant symbol + wordmark lockup

Decision:

- Canonical identity choices are the standalone symbol or the full symbol-as-C wordmark.
- Remove the separate horizontal `[standalone symbol] + [Chamber wordmark]` lockup from the canonical brand package.

Why:

The wordmark already contains the symbol as its `C`. Prepending the standalone symbol duplicates the same identity cue and creates ambiguous visual focus.

## 2026-08-08 — Preserve decisions, not draft proliferation

Decision:

Keep canonical assets, machine-readable geometry, generator, and durable rationale. Do not preserve every intermediate wordmark SVG as a canonical repo artifact.

Why:

The useful long-term information is the construction grammar and why the final branches were selected. Keeping every transient visual draft in the canonical brand tree would add noise and weaken source-of-truth boundaries.
