#!/usr/bin/env python3
from copy import deepcopy
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
PRESENTATION = ASSETS / "presentation"
WORDMARK = ASSETS / "chamber-wordmark.svg"

SVG_NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG_NS)
Q = lambda tag: f"{{{SVG_NS}}}{tag}"

PRESENTATION.mkdir(exist_ok=True)


def flattened_wordmark(background, title):
    source = ET.parse(WORDMARK).getroot()
    root = ET.Element(
        Q("svg"),
        {
            "viewBox": "-60 -20 1330 320",
            "role": "img",
            "aria-labelledby": "title desc",
        },
    )
    title_node = ET.SubElement(root, Q("title"), {"id": "title"})
    title_node.text = title
    desc_node = ET.SubElement(root, Q("desc"), {"id": "desc"})
    desc_node.text = (
        "Canonical Chamber symbol-as-C wordmark on a fixed brand background. "
        "The wordmark geometry is inlined so blend behavior is evaluated against that background."
    )
    ET.SubElement(
        root,
        Q("rect"),
        {
            "x": "-60",
            "y": "-20",
            "width": "1330",
            "height": "320",
            "rx": "26",
            "fill": background,
        },
    )
    for child in list(source):
        if child.tag in (Q("title"), Q("desc")):
            continue
        root.append(deepcopy(child))
    return ET.tostring(root, encoding="unicode") + "\n"


def social_preview_source():
    return (
        f'<svg xmlns="{SVG_NS}" viewBox="0 0 1280 640" role="img" '
        'aria-labelledby="title desc">'
        '<title id="title">Chamber social preview</title>'
        '<desc id="desc">Chamber wordmark centered on the canonical dark brand background.</desc>'
        '<rect width="1280" height="640" rx="48" fill="#111322"/>'
        '<image href="chamber-readme-dark.svg" x="64" y="166" width="1152" height="308" '
        'preserveAspectRatio="xMidYMid meet"/>'
        '</svg>\n'
    )


(PRESENTATION / "chamber-readme-light.svg").write_text(
    flattened_wordmark("#FFFFFF", "Chamber on light"), encoding="utf-8"
)
(PRESENTATION / "chamber-readme-dark.svg").write_text(
    flattened_wordmark("#111322", "Chamber on dark"), encoding="utf-8"
)
(PRESENTATION / "chamber-social-preview.svg").write_text(
    social_preview_source(), encoding="utf-8"
)
print("Generated Chamber repository presentation assets.")
