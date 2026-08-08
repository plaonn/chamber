# Chamber Brand Decisions

This file preserves **durable design rationale**, not every exploratory draft.

## 2026-08-08 — Canonical symbol remains immutable

Decision:

- Keep `chamber-symbol-v1` unchanged while developing the wordmark.
- Derivatives must embed or reconstruct the canonical geometry exactly rather than visually reinterpret it.

Why:

The symbol geometry and Aurora relationship were already accepted. Reopening it during typography work would make the wordmark iteration an uncontrolled symbol redesign.

## 2026-08-08 — Wordmark inherits the frame, not the wedge angle

Decision:

- 45° is the alphabet/frame bevel system.
- 34° belongs only to the symbol's entering wedge.

Why:

The capital `C` comes directly from the chamber frame. Using 45° on the alphabet makes the relationship legible and structurally stable while keeping the 34° wedge distinctive.

## 2026-08-08 — Use icon-derived inset geometry instead of uniform apparent stroke thickness

Decision:

- Orthogonal construction uses the scaled frame inset `T = 37.5`.
- 45° construction inherits the canonical outer/inner bevel offset `D = 61.5`.
- The resulting perpendicular diagonal thickness is about `43.487`, not 37.5.

Why:

Forcing every visible direction to the same numeric thickness contradicts the finalized symbol. The wordmark should inherit the symbol's construction philosophy, not normalize away its bevel geometry.

## 2026-08-08 — Canonical lowercase module is W = 116.5

Decision:

- `h`, `b`, `e`, `r` use one module `W = 116.5`.
- `a = W + T = 154`.
- `m = 2W - T = 195.5`, representing two W modules sharing one T stem.

Why:

The accepted `a` exposed a natural body width of `154 - 37.5 = 116.5`. The same value also reconciles the independently balanced earlier widths and returns `m` almost exactly to its visually selected width.

## 2026-08-08 — `a` uses a symmetric counter and isosceles notch

Decision:

- Keep the counter square and symmetric about its lower-left → upper-right 45° axis.
- Keep the lower-right diagonal at the icon-derived bevel offset.
- Separate bowl and tail with an isosceles-right triangular notch whose two sides are ±45°.

Why:

The symmetric counter gave the glyph substantially more stability. A right-triangle notch forced unrelated edge lengths and made the separator feel attached rather than designed. The isosceles notch preserves the 45° system and clearly separates the bowl from the tail.

## 2026-08-08 — `r` uses the equal terminal member

Decision:

- Use `H = V = 30.75`.
- Preserve `H + V = D = 61.5`.
- Upper stem/diagonal split is y = 134.25 at the canonical 240-high scale.

Why:

Three members were compared with the same width, stem, diagonal offset, and construction:

1. horizontal-only: `H=61.5, V=0`
2. equal: `H=30.75, V=30.75`
3. vertical-only: `H=0, V=61.5`

The equal member reads as the most balanced and intentional terminal while remaining part of the same geometric family.

## 2026-08-08 — Preserve decisions, not draft proliferation

Decision:

Keep canonical assets, machine-readable geometry, generator, and durable rationale. Do not preserve every intermediate wordmark SVG as a canonical repo artifact.

Why:

The useful long-term information is the construction grammar and why the final branches were selected. Keeping every transient visual draft in the canonical brand tree would add noise and make source-of-truth boundaries less clear.
