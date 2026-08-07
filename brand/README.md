# Chamber Brand / Symbol Specification

Status: **canonical symbol v1**

This directory is the source of truth for the Chamber symbol.
The wordmark and typography are intentionally **not specified yet**.

## 1. Brand idea

The symbol represents a **controlled chamber** with an active interface entering from the right.

- outer soft octagon: containment, controlled environment, stability
- right-facing wedge: intervention, observation, conditioning, measurement
- two coordinated Aurora fields: one visual system with two distinct functional regions
- design priority: **Chamber silhouette first, interface second**

The intended reading is not a play button, Pac-Man, lock, prison, robot, AI brain, or sparkle.

## 2. Canonical geometry

The canonical geometry is deterministic and should be regenerated from `brand-spec.json`.

- base canvas: 320 × 320
- outer soft-octagon chamfer: 54
- outer corner radius: 10
- frame width: 50
- inner chamfer: 36
- wedge apex: (160, 160)
- wedge half-angle: **34°**
- wedge base extends to x=380 and is clipped to the outer octagon
- the outer chamber remains geometrically closed; the wedge is an overlaid color region, not a physical cut-out

Do not redraw the mark by eye if the generator is available.

## 3. Canonical palette

| Token | Hex | Role |
|---|---|---|
| Indigo | `#5968F2` | cool endpoint |
| Violet | `#8058E8` | bridge |
| Orchid | `#B752D7` | warm-mid bridge |
| Rose | `#E45E9A` | warm endpoint |
| Frame base | `#58558F` | frame substrate |
| Wedge base | `#68578F` | wedge substrate |

The palette is deliberately narrow. Prominent green is excluded.

## 4. Aurora field model

The frame and wedge **share the same palette but do not share one continuous field**.

That distinction is intentional:

- one continuous field made the mark lose structural separation
- large luminance differences made the two regions look like unrelated pieces
- the selected solution uses two independently arranged fields with similar brightness

Each hotspot is a radial gradient:

- 0%: peak opacity
- 56%: 42% of peak opacity
- 100%: 0 opacity

Exact hotspot coordinates, radii, and peak opacities live in `brand-spec.json`.

### Canonical frame field — Micro Balance

| Color | cx | cy | radius | peak |
|---|---:|---:|---:|---:|
| Indigo | 245 | 62 | 180 | 0.72 |
| Orchid | 120 | 270 | 216 | 0.71 |
| Rose | 36 | 165 | 195 | 0.56 |
| Violet | 166 | 168 | 210 | 0.69 |

### Canonical wedge field

| Color | cx | cy | radius | peak |
|---|---:|---:|---:|---:|
| Rose | 292 | 92 | 150 | 0.76 |
| Orchid | 232 | 108 | 165 | 0.70 |
| Indigo | 286 | 236 | 160 | 0.72 |
| Violet | 220 | 205 | 185 | 0.66 |

## 5. Reproduction

Run from the repository root (assuming this directory is `brand/`):

```bash
python3 brand/scripts/generate_brand_assets.py
```

`brand-spec.json` is the machine-readable design contract.
The generator is the reproducible source for exported SVGs.

## 6. Usage

Preferred:
- neutral light or dark background
- at least 1/8 mark width of clear space
- Aurora mark at normal UI/logo sizes
- below ~24 px, test the monochrome mark if the Aurora field becomes muddy

Avoid:
- changing the 34° wedge geometry
- introducing strong green
- merging frame/wedge into one Aurora field
- using large frame/wedge brightness separation
- moving all warm color mass to the right merely to force edge contrast
- adding a central sparkle/diamond
- adding AI-brain, circuit, robot-head, prison-bar, or padlock motifs

## 7. Asset roles

- `assets/chamber-mark.svg` — **canonical full-color symbol**
- `assets/chamber-mark-monochrome-dark.svg` — constrained/small-size dark mark
- `assets/chamber-mark-monochrome-light.svg` — constrained/small-size light mark
- `assets/chamber-app-icon-*.svg` — derived app-icon presentations; symbol geometry unchanged
- `assets/previews/*` — non-canonical presentation previews

## 8. Change policy

Any intentional visual change should update, in the same change:

1. `brand-spec.json`
2. generator
3. canonical SVG exports
4. this document if the design rule changed

Do not manually tweak exported SVGs without reflecting the change in the spec/generator.
