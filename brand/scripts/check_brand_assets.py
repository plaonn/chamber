#!/usr/bin/env python3
from pathlib import Path
import json
import subprocess
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
BRAND = ROOT / "brand"
ASSETS = BRAND / "assets"


def run(*args):
    subprocess.run(args, cwd=ROOT, check=True)


run(sys.executable, "brand/scripts/generate_wordmark_assets.py")
run(sys.executable, "brand/scripts/generate_presentation_assets.py")

with (BRAND / "brand-spec.json").open(encoding="utf-8") as handle:
    spec = json.load(handle)

assert spec["status"] == "canonical"
assert spec["wordmark_version"] == "chamber-wordmark-v2"
assert spec["wordmark"]["symbol_as_c"]["blend_mode"] == "overlay"
assert spec["wordmark"]["symbol_as_c"]["blend_underlayer_opacity"] == 0.15
assert spec["wordmark"]["symbol_as_c"]["normal_layer_opacity"] == 0.5

for path in sorted(ASSETS.rglob("*.svg")):
    ET.parse(path)

required = [
    ASSETS / "chamber-mark.svg",
    ASSETS / "chamber-wordmark.svg",
    ASSETS / "chamber-wordmark-monochrome-dark.svg",
    ASSETS / "chamber-wordmark-monochrome-light.svg",
    ASSETS / "presentation" / "chamber-readme-light.svg",
    ASSETS / "presentation" / "chamber-readme-dark.svg",
    ASSETS / "presentation" / "chamber-social-preview.svg",
]
missing = [str(path.relative_to(ROOT)) for path in required if not path.exists()]
if missing:
    raise SystemExit(f"missing brand assets: {', '.join(missing)}")

run("git", "diff", "--exit-code", "--", "brand")
print("Brand assets are valid and generated files are in sync.")
