#!/usr/bin/env python3
from pathlib import Path
import json, math

ROOT = Path(__file__).resolve().parents[1]
SPEC = json.loads((ROOT / "brand-spec.json").read_text(encoding="utf-8"))
OUT = ROOT / "assets"
PREVIEWS = OUT / "previews"
OUT.mkdir(exist_ok=True)
PREVIEWS.mkdir(exist_ok=True)

def rounded_polygon_path(points, radius):
    n = len(points)
    starts, ends = [], []
    for i, p in enumerate(points):
        px, py = points[(i - 1) % n]
        x, y = p
        nx, ny = points[(i + 1) % n]
        v1x, v1y = px - x, py - y
        l1 = math.hypot(v1x, v1y)
        v1x, v1y = v1x / l1, v1y / l1
        v2x, v2y = nx - x, ny - y
        l2 = math.hypot(v2x, v2y)
        v2x, v2y = v2x / l2, v2y / l2
        r = min(radius, l1 / 3, l2 / 3)
        starts.append((x + v1x * r, y + v1y * r))
        ends.append((x + v2x * r, y + v2y * r))
    d = [f"M {starts[0][0]:.2f},{starts[0][1]:.2f}"]
    for i, p in enumerate(points):
        x, y = p
        ex, ey = ends[i]
        d.append(f"Q {x:.2f},{y:.2f} {ex:.2f},{ey:.2f}")
        nsx, nsy = starts[(i + 1) % n]
        d.append(f"L {nsx:.2f},{nsy:.2f}")
    d.append("Z")
    return " ".join(d)

g = SPEC["geometry"]
pal = SPEC["palette"]
outer = [tuple(p) for p in g["outer_octagon"]["points"]]
outer_path = rounded_polygon_path(outer, g["outer_octagon"]["corner_radius"])

ins = g["inner_octagon"]["inset"]
iw = g["canvas"]["width"] - 2 * ins
ih = g["canvas"]["height"] - 2 * ins
ich = g["inner_octagon"]["chamfer"]
inner = [
    (ins + ich, ins),
    (ins + iw - ich, ins),
    (ins + iw, ins + ich),
    (ins + iw, ins + ih - ich),
    (ins + iw - ich, ins + ih),
    (ins + ich, ins + ih),
    (ins, ins + ih - ich),
    (ins, ins + ich),
]
inner_path = rounded_polygon_path(inner, g["inner_octagon"]["corner_radius"])

apex_x, apex_y = g["wedge"]["apex"]
base_x = g["wedge"]["base_x"]
half_h = math.tan(math.radians(g["wedge"]["half_angle_degrees"])) * (base_x - apex_x)
tri = [(apex_x, apex_y), (base_x, apex_y - half_h), (base_x, apex_y + half_h)]
tri_str = " ".join(f"{x:.2f},{y:.2f}" for x, y in tri)

def radial_defs(prefix, field):
    parts = []
    for i, hs in enumerate(field):
        color = pal[hs["color"]]
        peak = hs["peak_opacity"]
        parts.append(
            f'<radialGradient id="{prefix}{i}" gradientUnits="userSpaceOnUse" '
            f'cx="{hs["cx"]}" cy="{hs["cy"]}" r="{hs["r"]}">'
            f'<stop offset="0%" stop-color="{color}" stop-opacity="{peak}"/>'
            f'<stop offset="56%" stop-color="{color}" stop-opacity="{peak * 0.42:.3f}"/>'
            f'<stop offset="100%" stop-color="{color}" stop-opacity="0"/>'
            f'</radialGradient>'
        )
    return "\n".join(parts)

def canonical_inner(prefix="c"):
    ff = SPEC["aurora"]["frame_field"]
    wf = SPEC["aurora"]["wedge_field"]
    defs = radial_defs(prefix + "f", ff) + "\n" + radial_defs(prefix + "w", wf)
    clip_id = prefix + "OuterClip"
    frame_layers = "\n".join(
        f'<path d="{outer_path} {inner_path}" fill="url(#{prefix}f{i})" fill-rule="evenodd"/>'
        for i in range(len(ff))
    )
    wedge_layers = "\n".join(
        f'<polygon points="{tri_str}" fill="url(#{prefix}w{i})" clip-path="url(#{clip_id})"/>'
        for i in range(len(wf))
    )
    return (
        f'<defs>{defs}<clipPath id="{clip_id}"><path d="{outer_path}"/></clipPath></defs>'
        f'<path d="{outer_path} {inner_path}" fill="{pal["frame_base"]}" fill-rule="evenodd"/>'
        f'{frame_layers}'
        f'<polygon points="{tri_str}" fill="{pal["wedge_base"]}" clip-path="url(#{clip_id})"/>'
        f'{wedge_layers}'
    )

def canonical_svg():
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-18 -18 356 356" role="img" aria-labelledby="title desc">'
        '<title id="title">Chamber symbol</title>'
        '<desc id="desc">A closed soft-octagonal chamber with a centered right-facing wedge, using two coordinated aurora color fields.</desc>'
        + canonical_inner("c") + '</svg>\n'
    )

def mono_svg(fill):
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-18 -18 356 356" role="img" aria-labelledby="title desc">'
        '<title id="title">Chamber monochrome symbol</title>'
        '<desc id="desc">Monochrome Chamber symbol for small sizes and constrained reproduction.</desc>'
        f'<defs><clipPath id="monoClip"><path d="{outer_path}"/></clipPath></defs>'
        f'<path d="{outer_path} {inner_path}" fill="{fill}" fill-rule="evenodd"/>'
        f'<polygon points="{tri_str}" fill="{fill}" opacity="0.72" clip-path="url(#monoClip)"/>'
        '</svg>\n'
    )

def app_icon_svg(background):
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-labelledby="title desc">'
        '<title id="title">Chamber app icon</title>'
        '<desc id="desc">Chamber symbol centered on a neutral rounded-square app icon field.</desc>'
        f'<rect width="512" height="512" rx="112" fill="{background}"/>'
        '<svg x="88" y="88" width="336" height="336" viewBox="-18 -18 356 356">'
        + canonical_inner("app") + '</svg></svg>\n'
    )

(OUT / "chamber-mark.svg").write_text(canonical_svg(), encoding="utf-8")
(OUT / "chamber-mark-monochrome-dark.svg").write_text(mono_svg(pal["monochrome_dark"]), encoding="utf-8")
(OUT / "chamber-mark-monochrome-light.svg").write_text(mono_svg(pal["monochrome_light"]), encoding="utf-8")
(OUT / "chamber-app-icon-dark.svg").write_text(app_icon_svg(pal["dark_background"]), encoding="utf-8")
(OUT / "chamber-app-icon-light.svg").write_text(app_icon_svg("#F4F3FA"), encoding="utf-8")
print("Generated Chamber symbol assets.")
