# Chamber Brand Specification

Status: **canonical brand v2**

This directory is the source of truth for the Chamber standalone symbol and custom wordmark.

- standalone symbol: **chamber-symbol-v1** — unchanged
- wordmark: **chamber-wordmark-v2** — `symbol-as-C + hamber`
- brand package: **chamber-brand-v2**

## 1. Brand idea

Chamber represents a **controlled chamber** with an active interface entering from the right.

- outer soft octagon: containment, controlled environment, stability
- right-facing wedge: intervention, observation, conditioning, measurement
- custom wordmark: the same construction grammar extended into a readable alphabet
- design priority: **Chamber silhouette and wordmark first, wedge/interface second**

The intended reading is not a play button, Pac-Man, lock, prison, robot, AI brain, or sparkle.

## 2. Canonical standalone symbol

The standalone symbol remains `chamber-symbol-v1` and is not changed by the wordmark v2 decision.

- base canvas: 320 × 320
- outer soft-octagon chamfer: 54
- outer corner radius: 10
- frame width: 50
- inner chamfer: 36
- wedge apex: (160, 160)
- wedge half-angle: **34°**
- wedge base extends to x=380 and is clipped to the outer octagon
- the standalone outer chamber remains geometrically closed; its wedge is an overlaid color region

Do not redraw the canonical symbol by eye or with a generative image model.

## 3. Angle system

Chamber deliberately has **two angle families**:

- **45°** — frame chamfers and the custom alphabet construction
- **34°** — the entering wedge only

Do not propagate the 34° wedge angle into the lowercase alphabet.

## 4. Canonical wordmark: symbol-as-C + hamber

The canonical text is still **`Chamber`**, but the visual capital `C` is the Chamber symbol geometry itself rather than a separate letter placed after a standalone icon.

### Symbol-as-C

At the 240-high wordmark scale:

- top: 32
- baseline/bottom: 240
- symbol height/width: 208
- canonical-symbol scale: 0.65
- symbol → `h` gap: 31

The frame is the canonical chamber geometry **cut by the 34° wedge region first**. The wedge is then painted over the empty opening. This is necessary because the wedge is translucent; leaving the full frame underneath would show the octagon through the wedge.

The symbol-as-C derivative is wordmark-specific. It does not alter `chamber-symbol-v1`.

### Lowercase module

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

The lowercase glyphs are emitted as unified filled contours, not overlapping painted rectangles. Aurora layers therefore paint each glyph face once and do not create alpha-darkened joins.

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

### Tracking

- symbol-as-C → `h`: 31
- lowercase pairs: 31

## 5. Palette and Aurora fields

Palette:

| Token | Hex | Role |
|---|---|---|
| Indigo | `#5968F2` | cool endpoint |
| Violet | `#8058E8` | bridge |
| Orchid | `#B752D7` | warm-mid bridge |
| Rose | `#E45E9A` | warm endpoint |
| Frame base | `#58558F` | standalone-frame substrate |
| Wedge base | `#68578F` | standalone-wedge substrate |
| Wordmark base | `#7162B1` | wordmark substrate |

The palette is deliberately narrow. Prominent green is excluded.

The standalone symbol keeps its original independent frame and wedge fields.

The wordmark uses two field roles:

1. **cut-C frame + `hamber`** — one broad continuous wordmark-wide Aurora field
2. **wedge** — a separate field using the same palette, spatially derived from the standalone wedge field

This gives the wedge a distinct value relationship without turning it into a separate visual brand object.

## 6. Wedge transparency and blend behavior

Canonical full-color wordmark composition:

1. render the wedge field as an **overlay underlayer at 15% opacity**;
2. render the same wedge field again as a **normal layer at 50% opacity**.

The normal layer guarantees that the wedge remains visible on very light and very dark backgrounds. The low-contribution overlay layer lets the wedge value respond to the backdrop without allowing the blend effect to dominate the wordmark.

`mix-blend-mode: overlay` was selected over `soft-light` because the accepted subtle variants were visually near-equivalent and overlay is the simpler blend primitive. The choice is a tie-breaker, not a claim of material runtime performance improvement for a single static logo.

If a renderer ignores `mix-blend-mode`, both layers fall back to ordinary alpha compositing and remain usable. For strict constrained reproduction, use the monochrome wordmark assets.

## 7. Identity composition

Use **either**:

- the standalone Chamber symbol, or
- the full symbol-as-C `Chamber` wordmark.

Do **not** prepend the standalone symbol to the wordmark. A separate `[symbol] + Chamber` horizontal lockup is intentionally not part of brand v2 because it duplicates the visual `C` identity and creates competing focal points.

## 8. Reproduction

Run from the repository root:

```bash
python3 brand/scripts/generate_wordmark_assets.py
```

`brand-spec.json` is the machine-readable design contract. `generate_wordmark_assets.py` imports the standalone symbol generator first, then emits the wordmark and presentation previews. The generators use only the Python standard library.

## 9. Asset roles

Canonical:

- `assets/chamber-mark.svg` — full-color standalone symbol
- `assets/chamber-wordmark.svg` — full-color symbol-as-C wordmark
- `assets/*-monochrome-dark.svg` — dark-ink constrained variants
- `assets/*-monochrome-light.svg` — light-ink constrained variants

Derived:

- `assets/chamber-app-icon-*.svg` — standalone-symbol app-icon presentations
- `assets/previews/*` — non-canonical presentation previews using the canonical wordmark

Removed from brand v2:

- `chamber-lockup-horizontal*.svg` — redundant separate-symbol + wordmark lockups

## 10. Usage

Preferred:

- neutral light, mid, or dark background
- at least 1/8 asset height of clear space
- Aurora assets at normal UI/logo sizes
- below roughly 24 px, test the monochrome asset if Aurora/blend behavior becomes muddy

Avoid:

- changing the 34° wedge geometry
- treating 34° as the alphabet angle
- introducing strong green
- merging the standalone frame/wedge fields
- baking the wordmark wedge to a white-only appearance
- using large fixed frame/wedge brightness separation
- prepending the standalone symbol to the symbol-as-C wordmark
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
