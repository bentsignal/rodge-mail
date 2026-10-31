"""Writes the Rodge Mail app icon, its Icon Composer document, and its renders.

    python3 build-icons.py              # rodge-mail.icon, render-flat.swift, previews/
    python3 build-icons.py --check DIR  # also every iOS appearance at 1024px in DIR

The icon is a folded paper plane: a near wing seen whole and a far wing
foreshortened behind it, meeting along the fold from the nose to the notch.
Light is a graphite plane on white; dark is a white plane on near-black;
tinted and clear use a white and a gray wing, which iOS tints.

The plane is drawn on a 100-unit design grid, scaled so its larger side is
GLYPH pixels of the 1024px canvas, and centered optically: halfway between
its bounding box's center and its centroid (OPTICAL). Wing tips, nose, and
notch are rounded with arcs tangent to both edges.
"""

from pathlib import Path
import json
import math
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
NAME = "rodge-mail"
ICTOOL = "/Applications/Xcode.app/Contents/Applications/Icon Composer.app/Contents/Executables/ictool"
RENDITIONS = ("Default", "Dark", "ClearLight", "ClearDark", "TintedLight", "TintedDark")
PREVIEW_SIZE = 180
SRGB = "/System/Library/ColorSync/Profiles/sRGB Profile.icc"
TINT_HUE = .6

CANVAS = 1024
GLYPH = 640
# How far the canvas center moves from the bounding box's center toward the
# plane's centroid. The nose carries most of the area, so a box-centered plane
# looks pushed up and to the right; halfway reads as centered.
OPTICAL = .5

# The plane on a 100-unit design grid (concept 05): y grows downward.
NOSE = (80, 24)
NEAR_TIP = (20, 49)
FAR_TIP = (61, 78)
NOTCH = (48, 56)
RADIUS = {NOSE: 18, NOTCH: 10, NEAR_TIP: 24, FAR_TIP: 20}

BACKGROUND = {"light": ("#ffffff", "#e4e4e9"), "dark": ("#2e2e30", "#0c0c0d")}
WINGS = {
    "near": {"light": ("#4a4a4d", "#1f1f21"), "dark": ("#ffffff", "#e5e5ea"), "tinted": "#ffffff"},
    "far": {"light": ("#1a1a1b", "#000000"), "dark": ("#a1a1a6", "#77777c"), "tinted": "#9a9a9a"},
}
FACETS = {"near": (NOSE, NEAR_TIP, NOTCH), "far": (NOSE, NOTCH, FAR_TIP)}


def centroid(points):
    area = cx = cy = 0
    for (x0, y0), (x1, y1) in zip(points, points[1:] + points[:1]):
        cross = x0 * y1 - x1 * y0
        area += cross
        cx += (x0 + x1) * cross
        cy += (y0 + y1) * cross
    return cx / (3 * area), cy / (3 * area)


def to_screen(points):
    xs, ys = zip(*points)
    scale = GLYPH / max(max(xs) - min(xs), max(ys) - min(ys))
    box = ((max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2)
    mass = centroid(list(points))
    cx, cy = (b + OPTICAL * (m - b) for b, m in zip(box, mass))
    return [(CANVAS / 2 + (x - cx) * scale, CANVAS / 2 + (y - cy) * scale) for x, y in points]


OUTLINE = (NOSE, FAR_TIP, NOTCH, NEAR_TIP)
SCREEN = dict(zip(OUTLINE, to_screen(OUTLINE)))


def rounded(vertices, steps=10):
    """A convex polygon with each corner replaced by a tangent arc."""
    points = []
    for i, vertex in enumerate(vertices):
        p = SCREEN[vertex]
        a, b = SCREEN[vertices[i - 1]], SCREEN[vertices[(i + 1) % len(vertices)]]
        u = unit(a[0] - p[0], a[1] - p[1])
        v = unit(b[0] - p[0], b[1] - p[1])
        half = math.acos(max(-1, min(1, u[0] * v[0] + u[1] * v[1]))) / 2
        r = RADIUS[vertex]
        reach = r / math.tan(half)
        bisector = unit(u[0] + v[0], u[1] + v[1])
        center = (p[0] + bisector[0] * r / math.sin(half), p[1] + bisector[1] * r / math.sin(half))
        start = (p[0] + u[0] * reach, p[1] + u[1] * reach)
        end = (p[0] + v[0] * reach, p[1] + v[1] * reach)
        a0 = math.atan2(start[1] - center[1], start[0] - center[0])
        a1 = math.atan2(end[1] - center[1], end[0] - center[0])
        sweep = (a1 - a0 + math.pi) % (2 * math.pi) - math.pi
        points += [(center[0] + r * math.cos(a0 + sweep * k / steps),
                    center[1] + r * math.sin(a0 + sweep * k / steps)) for k in range(steps + 1)]
    return points


def unit(x, y):
    d = math.hypot(x, y)
    return x / d, y / d


def f(x):
    return f"{x:.1f}"


def svg(points):
    d = "M " + " L ".join(f"{f(x)} {f(y)}" for x, y in points) + " Z"
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{CANVAS}" height="{CANVAS}" '
            f'viewBox="0 0 {CANVAS} {CANVAS}"><path fill="#ffffff" d="{d}"/></svg>\n')


def rgb(h):
    return tuple(int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))


def color(h):
    return "extended-srgb:" + ",".join(f"{x:.5f}" for x in (*rgb(h), 1))


def fill(v):
    return {"linear-gradient": [color(v[0]), color(v[1])]} if isinstance(v, tuple) else {"solid": color(v)}


def document():
    def layer(wing):
        return {
            "image-name": f"{wing}-wing.svg",
            "name": f"{wing.title()} wing",
            "glass": True,
            # The light fill must be the unqualified specialization: with a
            # plain "fill", ictool and iOS ignore the dark one.
            "fill-specializations": [
                {"value": fill(WINGS[wing]["light"])},
                {"appearance": "dark", "value": fill(WINGS[wing]["dark"])},
                {"appearance": "tinted", "value": fill(WINGS[wing]["tinted"])},
            ],
        }

    return {
        "fill": fill(BACKGROUND["light"]),
        "fill-specializations": [
            {"appearance": "dark", "value": fill(BACKGROUND["dark"])},
            {"appearance": "tinted", "value": fill(BACKGROUND["dark"])},
        ],
        # Icon Composer lists groups and layers front to back.
        "groups": [{
            "name": "Plane",
            "layers": [layer("near"), layer("far")],
            "shadow": {"kind": "neutral", "opacity": .4},
            "specular": True,
            "translucency": {"enabled": True, "value": .1},
        }],
        "supported-platforms": {"squares": "shared"},
    }


def write_bundle():
    bundle = ROOT / f"{NAME}.icon"
    shutil.rmtree(bundle, ignore_errors=True)
    (bundle / "Assets").mkdir(parents=True)
    for wing, vertices in FACETS.items():
        (bundle / "Assets" / f"{wing}-wing.svg").write_text(svg(rounded(vertices)))
    (bundle / "icon.json").write_text(json.dumps(document(), indent=2) + "\n")
    return bundle


def render(bundle, rendition, output, size):
    args = [
        ICTOOL, str(bundle), "--export-image", "--output-file", str(output),
        "--platform", "iOS", "--rendition", rendition,
        "--width", str(size), "--height", str(size), "--scale", "1",
    ]
    if rendition.startswith("Tinted"):
        args += ["--tint-color", str(TINT_HUE), "--tint-strength", "0.8"]
    subprocess.run(args, check=True, capture_output=True)


def main():
    bundle = write_bundle()
    subprocess.run(["swift", str(ROOT / "render-flat.swift"), str(ROOT), NAME], check=True)
    previews = ROOT / "previews"
    shutil.rmtree(previews, ignore_errors=True)
    previews.mkdir()
    for rendition, appearance in (("Default", "light"), ("Dark", "dark")):
        output = previews / f"{NAME}-{appearance}.png"
        render(bundle, rendition, output, PREVIEW_SIZE)
        # ictool writes 16-bit Display P3; 8-bit sRGB is a third the size.
        subprocess.run(["sips", "-m", SRGB, str(output), "--out", str(output)], check=True, capture_output=True)
    if "--check" in sys.argv:
        check = Path(sys.argv[sys.argv.index("--check") + 1])
        check.mkdir(parents=True, exist_ok=True)
        for rendition in RENDITIONS:
            render(bundle, rendition, check / f"{rendition}.png", 1024)
            print(rendition, flush=True)


if __name__ == "__main__":
    main()
