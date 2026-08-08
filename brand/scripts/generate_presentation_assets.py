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


def source_children():
    source = ET.parse(WORDMARK).getroot()
    return source, [
        deepcopy(child)
        for child in list(source)
        if child.tag not in (Q("title"), Q("desc"))
    ]


def flattened_wordmark(background, title):
    _, children = source_children()
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
    desc_node.text = "Canonical Chamber symbol-as-C wordmark on a fixed brand background."
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
    root.extend(children)
    return ET.tostring(root, encoding="unicode") + "\n"


def social_preview_source():
    source, children = source_children()
    min_x, min_y, width, height = map(float, source.get("viewBox").split())
    canvas_width, canvas_height = 1280.0, 640.0
    target_width = 1080.0
    scale = target_width / width
    target_height = height * scale
    translate_x = (canvas_width - target_width) / 2 - min_x * scale
    translate_y = (canvas_height - target_height) / 2 - min_y * scale

    root = ET.Element(
        Q("svg"),
        {
            "viewBox": "0 0 1280 640",
            "role": "img",
            "aria-labelledby": "title desc",
        },
    )
    ET.SubElement(root, Q("title"), {"id": "title"}).text = "Chamber social preview"
    ET.SubElement(root, Q("desc"), {"id": "desc"}).text = (
        "Canonical Chamber symbol-as-C wordmark centered on the dark brand background."
    )
    ET.SubElement(root, Q("rect"), {"width": "1280", "height": "640", "fill": "#111322"})
    group = ET.SubElement(
        root,
        Q("g"),
        {
            "transform": (
                f"translate({translate_x:.3f} {translate_y:.3f}) "
                f"scale({scale:.6f})"
            )
        },
    )
    group.extend(children)
    return ET.tostring(root, encoding="unicode") + "\n"


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
