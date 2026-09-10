#!/usr/bin/env python3
"""Classify Vocabulairelijst entries as bold-blue / plain from a photo of the page.

*Nederlands op niveau* prints its frequency tiers as type styles: **vet** (bold, and
set in the teal accent colour) = the 0-2000 most frequent words, *cursief* = 2000-5000,
plain = above 5000. Only the bold tier is coloured, so "is this word blue?" is a
measurable question: teal ink has a much higher blue-minus-red value than black ink.

The photo gives us that for free, but per-page white balance shifts the absolute
numbers, so we threshold per region (Otsu over the region's own lines) instead of
against a fixed cutoff.

Workflow (the words themselves still get read by eye — this only assigns the tier):

    # 1. see the page and pick column boxes off the overview
    python3 freq_tier_from_photo.py page.HEIC --overview

    # 2. one --region per text column, in reading order
    python3 freq_tier_from_photo.py page.HEIC \
        --region 280,1140,880,2900:p52-left \
        --region 945,1140,1700,2900:p52-right

    # 3. zoom in wherever the line count disagrees with the page
    python3 freq_tier_from_photo.py page.HEIC --crop 250,2430,760,2800

Each region prints one row per detected line, in page order, so the tier column can
be zipped against the words read from the crops.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageOps, UnidentifiedImageError

# A line is "text" if this many pixels in the row are darker than the local paper.
DARK_DELTA = 40          # luminance below row background to count as ink
ROW_MIN_INK = 3          # ink pixels needed to call a row non-blank
MIN_LINE_ROWS = 8        # shorter runs are noise (dust, a stray descender)
SPLIT_DELTAS = (48, 56, 64, 72)  # retried on blocks that swallowed >1 line


def open_image(path: Path) -> Image.Image:
    """Pillow has no HEIC decoder, and iPhone photos are HEIC — shell out to sips."""
    try:
        return Image.open(path)
    except UnidentifiedImageError:
        if path.suffix.lower() not in (".heic", ".heif"):
            raise
        jpeg = Path(tempfile.mkdtemp()) / f"{path.stem}.jpg"
        subprocess.run(
            ["sips", "-s", "format", "jpeg", str(path), "--out", str(jpeg)],
            check=True, capture_output=True,
        )
        return Image.open(jpeg)


def load(path: Path, rotate: str | None, tilt: float = 0.0) -> Image.Image:
    im = ImageOps.exif_transpose(open_image(path))
    if rotate:
        im = im.rotate({"ccw": 90, "cw": -90, "180": 180}[rotate], expand=True)
    if tilt:
        # A hand-held photo of a book is never square to the page, and a column
        # that drifts sideways can't be boxed by a rectangle. Positive = counter-
        # clockwise, i.e. it lifts the bottom of the page to the right.
        im = im.rotate(tilt, expand=True, resample=Image.BICUBIC, fillcolor=(255, 255, 255))
    return im.convert("RGB")


def segment(dark: np.ndarray, min_rows: int = MIN_LINE_ROWS) -> list[tuple[int, int]]:
    """Row runs that contain ink, as [start, end) offsets into the region."""
    profile = dark.sum(axis=1)
    runs: list[tuple[int, int]] = []
    start = None
    for i, ink in enumerate(profile):
        if ink > ROW_MIN_INK and start is None:
            start = i
        elif ink <= ROW_MIN_INK and start is not None:
            if i - start >= min_rows:
                runs.append((start, i))
            start = None
    if start is not None and len(profile) - start >= min_rows:
        runs.append((start, len(profile)))
    return runs


def valleys(dark: np.ndarray, count: int) -> list[tuple[int, int]]:
    """Cut a run-together block into `count` slices at its least-inked rows."""
    profile = dark.sum(axis=1).astype(float)
    guard = max(4, len(profile) // (count * 4))  # keep cuts away from each other
    cuts: list[int] = []
    for _ in range(count - 1):
        candidates = [
            i for i in range(guard, len(profile) - guard)
            if all(abs(i - c) >= guard * 2 for c in cuts)
        ]
        if not candidates:
            break
        cuts.append(min(candidates, key=lambda i: profile[i]))
    edges = [0, *sorted(cuts), len(profile)]
    return [(edges[i], edges[i + 1]) for i in range(len(edges) - 1)]


def ink_mask(lum: np.ndarray, delta: int) -> np.ndarray:
    """Per-row background, so a shadow gradient down the page doesn't eat lines."""
    background = np.percentile(lum, 88, axis=1, keepdims=True)
    return lum < background - delta


def otsu(values: np.ndarray) -> float:
    """1-D Otsu: the cut that best separates blue lines from black ones."""
    order = np.sort(values)
    best, best_var = order[0], -1.0
    for i in range(1, len(order)):
        lo, hi = order[:i], order[i:]
        var = len(lo) * len(hi) * (lo.mean() - hi.mean()) ** 2
        if var > best_var:
            best_var, best = var, (order[i - 1] + order[i]) / 2
    return best


def analyse(im: Image.Image, box: tuple[int, int, int, int], label: str) -> None:
    x0, y0, x1, y1 = box
    rgb = np.asarray(im).astype(np.int16)[y0:y1, x0:x1]
    lum = rgb.mean(axis=2)
    blue_red = rgb[:, :, 2] - rgb[:, :, 0]

    dark = ink_mask(lum, DARK_DELTA)
    runs = segment(dark)
    if not runs:
        print(f"=== {label}: no text found in {box}", file=sys.stderr)
        return

    # Blocks much taller than the typical line ran two entries together (tight
    # leading, low contrast). Re-cut just those with a stricter ink threshold.
    median_h = float(np.median([b - a for a, b in runs]))
    lines: list[tuple[int, int, int]] = []  # (start, end, n_expected)
    for a, b in runs:
        expected = max(1, round((b - a) / median_h))
        if expected == 1:
            lines.append((a, b, 1))
            continue
        for delta in SPLIT_DELTAS:
            sub = segment(ink_mask(lum[a:b], delta), min_rows=6)
            if len(sub) >= expected:
                lines.extend((a + s, a + e, 1) for s, e in sub)
                break
        else:
            # Nothing separated the lines cleanly, so cut at the thinnest rows:
            # the ink profile still dips between entries even when it never
            # reaches zero. Approximate, hence still flagged for a zoom crop.
            lines.extend((a + s, a + e, expected) for s, e in valleys(dark[a:b], expected))

    per_line = []
    for a, b, expected in lines:
        m = dark[a:b]
        if not m.any():
            continue
        cols = np.where(m.any(axis=0))[0]
        # Average the colour over the darkest half of the line's ink only. Print
        # show-through from the reverse of the page, and anti-aliased edges, are
        # grey and would otherwise pull a teal word towards black.
        pixel_lum = lum[a:b][m]
        core = pixel_lum <= np.median(pixel_lum)
        per_line.append(
            {
                "y": y0 + a,
                "h": b - a,
                "x": (x0 + int(cols.min()), x0 + int(cols.max())),
                "n": int(m.sum()),
                "br": float(blue_red[a:b][m][core].mean()),
                "expected": expected,
            }
        )

    cut = otsu(np.array([l["br"] for l in per_line]))
    blues = [l for l in per_line if l["br"] > cut]
    print(f"=== {label}  lines={len(per_line)}  blue={len(blues)}  cut={cut:+.1f}")
    for i, l in enumerate(per_line):
        tier = "BLUE " if l["br"] > cut else "plain"
        warns = []
        if l["expected"] > 1:
            warns.append(f"MERGED, {l['expected']} lines")
        # Ink touching a side means the box is clipping this column, or catching
        # the neighbouring one — either way the colour average is not trustworthy.
        if l["x"][0] <= x0 or l["x"][1] >= x1 - 1:
            warns.append("TOUCHES EDGE, narrow the box")
        warn = f"  <-- {'; '.join(warns)}" if warns else ""
        print(
            f"{i:3d} {tier} BR={l['br']:+6.1f}  y={l['y']:5d} h={l['h']:3d} "
            f"x={l['x'][0]}-{l['x'][1]}{warn}"
        )


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("image", type=Path)
    p.add_argument("--rotate", choices=("ccw", "cw", "180"), help="upright the page first")
    p.add_argument("--tilt", type=float, default=0.0, metavar="DEG",
                   help="fine rotation to square the page up; positive lifts the bottom rightwards")
    p.add_argument("--overview", action="store_true", help="write a 1/3-scale JPEG and exit")
    p.add_argument("--crop", metavar="X0,Y0,X1,Y1", help="write an enlarged, colour-boosted crop and exit")
    p.add_argument("--region", action="append", default=[], metavar="X0,Y0,X1,Y1[:LABEL]",
                   help="one text column to classify; repeat in reading order")
    p.add_argument("--out", type=Path, default=None, help="directory for overview/crop images")
    args = p.parse_args()

    im = load(args.image, args.rotate, args.tilt)
    out = args.out or args.image.parent
    stem = args.image.stem

    if args.overview:
        small = im.resize((im.width // 3, im.height // 3), Image.LANCZOS)
        path = out / f"{stem}-overview.jpg"
        small.save(path, quality=90)
        print(f"{path}  ({small.width}x{small.height}, coordinates x3 for --region)")
        return

    if args.crop:
        box = tuple(int(v) for v in args.crop.split(","))
        crop = im.crop(box)
        scale = max(1, min(3, 1450 // max(1, crop.width)))
        crop = crop.resize((crop.width * scale, crop.height * scale), Image.LANCZOS)
        crop = ImageEnhance.Color(crop).enhance(2.2)
        path = out / f"{stem}-crop-{'_'.join(args.crop.split(','))}.jpg"
        crop.save(path, quality=94)
        print(f"{path}  ({crop.width}x{crop.height})")
        return

    if not args.region:
        p.error("pass --region (or --overview / --crop)")

    for spec in args.region:
        coords, _, label = spec.partition(":")
        box = tuple(int(v) for v in coords.split(","))
        analyse(im, box, label or coords)


if __name__ == "__main__":
    main()
