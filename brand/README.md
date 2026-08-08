# Chamber Brand Specification

Status: **canonical brand v1**

This directory is the source of truth for the Chamber symbol, custom wordmark, and horizontal lockup.

The symbol remains **chamber-symbol-v1**. The wordmark and lockup are now canonical as **chamber-wordmark-v1** / **chamber-brand-v1**.

## 1. Brand idea

Chamber represents a **controlled chamber** with an active interface entering from the right.

- outer soft octagon: containment, controlled environment, stability
- right-facing wedge: intervention, observation, conditioning, measurement
- custom wordmark: the same construction grammar extended into a readable alphabet
- design priority: **Chamber silhouette first, interface second**

The intended reading is not a play button, Pac-Man, lock, prison, robot, AI brain, or sparkle.

## 2. Canonical symbol geometry

The symbol is deterministic and regenerated from `brand-spec.json`.

- base canvas: 320 × 320
- outer soft-octagon chamfer: 54
- outer corner radius: 10
- frame width: 50
- inner chamfer: 36
- wedge apex: (160, 160)
- wedge half-angle: **34°**
- wedge base extends to x=380 and is clipped to the outer octagon
- the outer chamber remains geometrically closed; the wedge is an overlaid color region, not a physical cut-out

Do not redraw the canonical symbol by eye or with a generative image model.

## 3. Angle system

Chamber deliberately has **two angle families**:

- **45°** — frame chamfers and the custom wordmark construction
- **34°** — the symbol's entering wedge only

Do not propagate the 34° wedge angle into the alphabet.

## 4. Custom wordmark

The canonical text is **`Chamber`**: capital `C`, lowercase `hamber`.

No font is used. The letters are deterministic vector constructions.

### Capital C

The `C` is the canonical chamber frame with the 34° wedge region removed, scaled to a height of 240.

### Lowercase module

At a 240-high wordmark scale:

| Token | Value | Meaning |
|---|---:|---|
| `W` | 116.5 | basic lowercase module width |
| `T` | 37.5 | orthogonal frame/stem inset |
| outer 45° chamfer | 40.5 | scaled from symbol outer chamfer 54 |
| inner 45° chamfer | 27.0 | scaled from symbol inner chamfer 36 |
| diagonal line delta | 61.5 | inherited outer/inner bevel offset |
| diagonal normal thickness | 43.487 | perpendicular thickness implied by the icon geometry |

Widths:

- `h`, `b`, `e`, `r` = `W` = 116.5
- `a` = `W + T` = 154
- `m` = `2W - T` = 195.5

This modular interpretation was selected because it simultaneously explains the accepted `a` and the independently balanced proportions of `h/b/e/m/r`.

### `a`

- width: 154
- square counter
- counter is symmetric about the lower-left → upper-right 45° axis
- lower-right diagonal inherits the icon's 45° outer/inner offset
- bowl and tail are separated by a **45° / 45° isosceles-right triangular notch**

### `r`

The selected terminal is the **equal** construction:

- horizontal component: 30.75
- vertical component: 30.75
- `H + V = 61.5`
- upper split y: 134.25
- diagonal thickness remains inherited from the canonical icon geometry

The equal terminal was selected after comparing horizontal-only, equal, and vertical-only members of the same construction family.

### Tracking

- visual `C` → `h`: 41
- lowercase pairs: 31

## 5. Palette

| Token | Hex | Role |
|---|---|---|
| Indigo | `#5968F2` | cool endpoint |
| Violet | `#8058E8` | bridge |
| Orchid | `#B752D7` | warm-mid bridge |
| Rose | `#E45E9A` | warm endpoint |
| Frame base | `#58558F` | frame substrate |
| Wedge base | `#68578F` | wedge substrate |
| Wordmark base | `#7162B1` | wordmark substrate |

The palette is deliberately narrow. Prominent green is excluded.

## 6. Aurora fields

The symbol frame and wedge share the same palette but use **two independently arranged fields**. This preserves structural separation without making them look like unrelated pieces.

The wordmark uses a **third, independent, broader and calmer field** using the same narrow palette. It is not a continuation of the symbol field.

Exact hotspot coordinates and ratios live in `brand-spec.json`.

## 7. Horizontal lockup

The canonical horizontal lockup uses:

- symbol height: 240
- wordmark height: 240
- symbol → wordmark gap: 55

The symbol is not reinterpreted for the lockup.

## 8. Reproduction

Run from the repository root:

```bash
python3 brand/scripts/generate_wordmark_assets.py
```

`brand-spec.json` is the machine-readable design contract. `generate_wordmark_assets.py` imports and runs the existing symbol generator first, then emits the canonical wordmark, lockups, and updated previews. Both generators use only the Python standard library.

## 9. Asset roles

Canonical:

- `assets/chamber-mark.svg` — full-color symbol
- `assets/chamber-wordmark.svg` — full-color custom wordmark
- `assets/chamber-lockup-horizontal.svg` — full-color horizontal lockup
- `assets/*-monochrome-dark.svg` — dark-ink constrained variants
- `assets/*-monochrome-light.svg` — light-ink constrained variants

Derived:

- `assets/chamber-app-icon-*.svg` — app-icon presentations; symbol geometry unchanged
- `assets/previews/*` — non-canonical presentation previews using the real custom wordmark

## 10. Usage

Preferred:

- neutral light or dark background
- at least 1/8 asset height of clear space
- Aurora assets at normal UI/logo sizes
- below roughly 24 px, test the monochrome asset if the Aurora field becomes muddy

Avoid:

- changing the 34° wedge geometry
- treating 34° as the alphabet angle
- introducing strong green
- merging symbol frame/wedge into one Aurora field
- using large frame/wedge brightness separation
- replacing the custom wordmark with a font
- redrawing the canonical symbol generatively
- generic AI-brain, circuit, robot-head, prison-bar, padlock, or sparkle motifs

## 11. Change policy

Any intentional visual change should update, in the same change:

1. `brand-spec.json`
2. affected generator(s)
3. affected canonical SVG exports
4. this document when the design rule changes
5. `DECISIONS.md` when a durable design rationale changes

Do not manually tweak exported SVGs without reflecting the change in the spec/generator.

## 12. License and brand-use boundary

Repository contents are licensed under the Apache License, Version 2.0 unless otherwise noted. That copyright license does not grant permission to use the Chamber name, symbol, logo, wordmark, or other source-identifying marks as branding for another product or distribution.

The canonical symbol and wordmark are project identifiers. This document does not claim that the Chamber name, symbol, or wordmark is a registered trademark.

Truthful descriptive use is welcome: referring to Chamber, linking to the project, documenting compatibility, showing the marks in documentation or commentary, or describing an unofficial fork as a fork of Chamber. Modified distributions should use a distinct product identity and must not imply official status, sponsorship, endorsement, or certification.

See [`../TRADEMARKS.md`](../TRADEMARKS.md) for the lightweight project-wide brand policy.
