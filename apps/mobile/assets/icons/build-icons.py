"""Writes the Rodge Mail app icon, its Icon Composer document, and its renders.

    python3 build-icons.py              # rodge-mail.icon, render-flat.swift, previews/
    python3 build-icons.py --check DIR  # also every iOS appearance at 1024px in DIR

The icon is a folded paper plane: one rounded silhouette cut along the fold
from the nose to the notch into a near wing and a far wing behind it. The two
wings are one color, the far wing in shadow: graphite on white in light, white
on near-black in dark, white and gray in tinted and clear, which iOS tints.

The plane is drawn on a 100-unit design grid. Its outline grows by OUTSET with
round corners, as if stroked with round joins, and its notch gets a small
concave arc. The silhouette is scaled so its larger side is GLYPH pixels of the
1024px canvas and centered optically: halfway between its bounding box's center
and its centroid (OPTICAL).
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

# The plane on a 100-unit design grid: y grows downward. The fold is the line
# through NOSE and NOTCH.
NOSE = (80, 24)
FAR_TIP = (61, 78)
NOTCH = (48, 56)
NEAR_TIP = (20, 49)
OUTLINE = (NOSE, FAR_TIP, NOTCH, NEAR_TIP)
# Half the approved design's 7-unit round-join stroke. Convex corners with
# radius OUTSET become arcs around the original vertices.
OUTSET = 3.5
RADIUS = {NOSE: OUTSET, FAR_TIP: OUTSET, NOTCH: 1, NEAR_TIP: OUTSET}
# Pixels the far wing reaches under the near wing. Icon Composer antialiases
# each layer on its own, so wings that only touch show the background through
# a hairline along the fold.
UNDERLAP = 1.5

BACKGROUND = {"light": ("#ffffff", "#e4e4e9"), "dark": ("#2e2e30", "#0c0c0d")}
NEAR_WING = {"light": ("#48484b", "#1c1c1e"), "dark": ("#ffffff", "#e0e0e4"), "tinted": "#ffffff"}
# The far wing is the near wing's color times this.
SHADE = {"light": .68, "dark": .74, "tinted": .74}


def shaded(value, k):
    if isinstance(value, tuple):
        return tuple(shaded(v, k) for v in value)
    return "#" + "".join(f"{round(int(value[i:i + 2], 16) * k):02x}" for i in (1, 3, 5))


WINGS = {
    "near": NEAR_WING,
    "far": {appearance: shaded(v, SHADE[appearance]) for appearance, v in NEAR_WING.items()},
}


def unit(x, y):
    d = math.hypot(x, y)
    return x / d, y / d


def signed_area(points):
    return sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(points, points[1:] + points[:1])) / 2


def centroid(points):
    cx = cy = 0
    for (x0, y0), (x1, y1) in zip(points, points[1:] + points[:1]):
        cross = x0 * y1 - x1 * y0
        cx += (x0 + x1) * cross
        cy += (y0 + y1) * cross
    area = signed_area(points)
    return cx / (6 * area), cy / (6 * area)


def outset(points, d):
    """The polygon with every edge moved outward by d, its corners kept sharp."""
    sign = 1 if signed_area(points) > 0 else -1
    lines = []
    for p, q in zip(points, points[1:] + points[:1]):
        n = unit(sign * (q[1] - p[1]), sign * (p[0] - q[0]))
        lines.append((n, n[0] * p[0] + n[1] * p[1] + d))
    corners = []
    for (n1, c1), (n2, c2) in zip(lines[-1:] + lines[:-1], lines):
        det = n1[0] * n2[1] - n1[1] * n2[0]
        corners.append(((c1 * n2[1] - c2 * n1[1]) / det, (n1[0] * c2 - n2[0] * c1) / det))
    return corners


def rounded(corners, radii, step=math.radians(5)):
    """The polygon with each corner replaced by an arc tangent to both edges.

    The arc's center lies on the corner's bisector, inside the polygon at a
    convex corner and outside it at a reflex one, so the same construction
    rounds both.
    """
    points = []
    for i, p in enumerate(corners):
        a, b = corners[i - 1], corners[(i + 1) % len(corners)]
        u = unit(a[0] - p[0], a[1] - p[1])
        v = unit(b[0] - p[0], b[1] - p[1])
        half = math.acos(max(-1, min(1, u[0] * v[0] + u[1] * v[1]))) / 2
        r = radii[i]
        reach = r / math.tan(half)
        bisector = unit(u[0] + v[0], u[1] + v[1])
        center = (p[0] + bisector[0] * r / math.sin(half), p[1] + bisector[1] * r / math.sin(half))
        start = (p[0] + u[0] * reach, p[1] + u[1] * reach)
        end = (p[0] + v[0] * reach, p[1] + v[1] * reach)
        a0 = math.atan2(start[1] - center[1], start[0] - center[0])
        a1 = math.atan2(end[1] - center[1], end[0] - center[0])
        sweep = (a1 - a0 + math.pi) % (2 * math.pi) - math.pi
        steps = max(1, math.ceil(abs(sweep) / step))
        points += [(center[0] + r * math.cos(a0 + sweep * k / steps),
                    center[1] + r * math.sin(a0 + sweep * k / steps)) for k in range(steps + 1)]
    return points


def placement(points):
    """Maps the design grid onto the canvas: the larger side GLYPH pixels, centered optically."""
    xs, ys = zip(*points)
    scale = GLYPH / max(max(xs) - min(xs), max(ys) - min(ys))
    box = ((max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2)
    cx, cy = (b + OPTICAL * (m - b) for b, m in zip(box, centroid(points)))
    return lambda p: (CANVAS / 2 + (p[0] - cx) * scale, CANVAS / 2 + (p[1] - cy) * scale)


def clip(points, distance):
    """Sutherland-Hodgman: the part of the polygon where the linear `distance` is >= 0."""
    part = []
    for p, q in zip(points, points[1:] + points[:1]):
        dp, dq = distance(p), distance(q)
        if dp >= 0:
            part.append(p)
        if (dp >= 0) != (dq >= 0):
            t = dp / (dp - dq)
            part.append((p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])))
    return part


def wings():
    """The silhouette cut along the fold, in canvas pixels."""
    grid = rounded(outset(list(OUTLINE), OUTSET), [RADIUS[v] for v in OUTLINE])
    place = placement(grid)
    plane = [place(p) for p in grid]
    (ax, ay), (bx, by) = place(NOSE), place(NOTCH)
    normal = unit(ay - by, bx - ax)
    near_tip = place(NEAR_TIP)
    if normal[0] * (near_tip[0] - ax) + normal[1] * (near_tip[1] - ay) < 0:
        normal = -normal[0], -normal[1]

    def past_fold(p):
        return normal[0] * (p[0] - ax) + normal[1] * (p[1] - ay)

    return {"near": clip(plane, past_fold), "far": clip(plane, lambda p: UNDERLAP - past_fold(p))}


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
    for wing, points in wings().items():
        (bundle / "Assets" / f"{wing}-wing.svg").write_text(svg(points))
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
