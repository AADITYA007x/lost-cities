"""
First-pass automatic tracing of solid black walls on an excavation plan.

Finds the filled black walls, drops thin lines and lettering, and splits the walls
into rectangles. Each rectangle becomes a two-point "wall" in the tracer's JSON format,
so the result can be opened and corrected in the plan tracer
(http://localhost:5173/tools/tracer/ : open the plan image, then "Open JSON").

It only finds walls drawn as solid black. Walls drawn in outline, wells, drains and
anything faint must be added by hand in the tracer. Always review the result.

Requires: Python 3, numpy, scipy, pillow
Usage:
  python tools/autotrace.py PLATE_IMAGE OUT.json --mpp 0.1555 \
      --anchor-px 680 604 --anchor-scene -98.5 -244.2 \
      --source "Mackay 1938" --plate XVIII --area DK-G --page 50 \
      --exclude 500,460,650,780
"""

import argparse
import json
from datetime import datetime, timezone

import numpy as np
import scipy.ndimage as nd
from PIL import Image


def wall_mask(gray, dark=95, min_thick=3, min_area=30):
    # soften JPEG noise first, so wall edges come out straight
    gray = nd.median_filter(gray, size=3)
    m = gray < dark
    # walls are at least min_thick px thick: an opening removes text strokes and thin lines
    m = nd.binary_opening(m, structure=np.ones((min_thick, min_thick)))
    lab, n = nd.label(m)
    if n:
        sizes = nd.sum(m, lab, range(1, n + 1))
        keep = np.isin(lab, 1 + np.where(sizes >= min_area)[0])
        m &= keep
    # straighten ragged edges: fill one-pixel notches, then trim one-pixel bumps
    m = nd.binary_closing(m, structure=np.ones((3, 3)))
    m = nd.median_filter(m.astype(np.uint8), size=3).astype(bool)
    return m


def rectangles(mask):
    """Greedy split of a mask into axis-aligned rectangles (merging identical row runs)."""
    h, w = mask.shape
    open_rects = {}  # (x0, x1) -> [x0, y0, x1, y1]
    done = []
    for y in range(h):
        row = mask[y]
        runs = []
        x = 0
        while x < w:
            if row[x]:
                s = x
                while x < w and row[x]:
                    x += 1
                runs.append((s, x))
            else:
                x += 1
        current = {}
        for r in runs:
            if r in open_rects:
                rect = open_rects.pop(r)
                rect[3] = y + 1
                current[r] = rect
            else:
                current[r] = [r[0], y, r[1], y + 1]
        done.extend(open_rects.values())
        open_rects = current
    done.extend(open_rects.values())
    return done


def merge_columns(rects, tol=1):
    """Merge vertically stacked rectangles whose column spans match (within tol px)."""
    rects = sorted(rects, key=lambda r: (r[1], r[0]))
    out = []
    for r in rects:
        for o in out:
            if abs(o[0] - r[0]) <= tol and abs(o[2] - r[2]) <= tol and abs(o[3] - r[1]) <= 0:
                o[0] = min(o[0], r[0])
                o[2] = max(o[2], r[2])
                o[3] = r[3]
                break
        else:
            out.append(list(r))
    return out


def merge_rows(rects, tol=1):
    """Merge side-by-side rectangles whose row spans match (within tol px)."""
    rects = sorted(rects, key=lambda r: (r[0], r[1]))
    out = []
    for r in rects:
        for o in out:
            if abs(o[1] - r[1]) <= tol and abs(o[3] - r[3]) <= tol and abs(o[2] - r[0]) <= 0:
                o[1] = min(o[1], r[1])
                o[3] = max(o[3], r[3])
                o[2] = r[2]
                break
        else:
            out.append(list(r))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('image')
    ap.add_argument('out')
    ap.add_argument('--mpp', type=float, required=True, help='metres per pixel')
    ap.add_argument('--anchor-px', type=float, nargs=2, required=True)
    ap.add_argument('--anchor-scene', type=float, nargs=2, required=True)
    ap.add_argument('--source', default='Mackay 1938')
    ap.add_argument('--plate', default='')
    ap.add_argument('--area', default='')
    ap.add_argument('--page', default='')
    ap.add_argument('--level', default='')
    ap.add_argument('--exclude', action='append', default=[], help='x0,y0,x1,y1 pixel box to ignore (legend, title)')
    ap.add_argument('--dark', type=int, default=95)
    ap.add_argument('--min-thick', type=int, default=3)
    ap.add_argument('--min-rect', type=float, default=0.35, help='drop rectangles shorter than this many metres')
    args = ap.parse_args()

    gray = np.asarray(Image.open(args.image).convert('L'))
    mask = wall_mask(gray, dark=args.dark, min_thick=args.min_thick)
    for box in args.exclude:
        x0, y0, x1, y1 = (int(v) for v in box.split(','))
        mask[y0:y1, x0:x1] = False

    rects = rectangles(mask)
    for _ in range(3):
        rects = merge_rows(merge_columns(rects))
    # drop slivers thinner than 2 px (scan noise along wall edges)
    rects = [r for r in rects if min(r[2] - r[0], r[3] - r[1]) >= 2]
    walls = []
    next_id = 1
    for x0, y0, x1, y1 in rects:
        w = x1 - x0
        h = y1 - y0
        if max(w, h) * args.mpp < args.min_rect:
            continue
        cx = (x0 + x1) / 2
        cy = (y0 + y1) / 2
        if w >= h:
            half = h / 2
            pts = [[x0 + half, cy], [max(x1 - half, x0 + half + 0.4), cy]]
            width = h * args.mpp
        else:
            half = w / 2
            pts = [[cx, y0 + half], [cx, max(y1 - half, y0 + half + 0.4)]]
            width = w * args.mpp
        walls.append({
            'id': next_id,
            'points': [[round(p[0], 1), round(p[1], 1)] for p in pts],
            'width': round(width, 3),
            'preserved': 1.0,
            'certainty': 'excavated',
            'auto': True,
        })
        next_id += 1

    ax, ay = args.anchor_px
    data = {
        'format': 'lost-cities-trace/1',
        'meta': {
            'source': args.source,
            'plate': args.plate,
            'page': args.page,
            'area': args.area,
            'level': args.level,
            'image': args.image.split('/')[-1],
            'method': 'autotrace.py first pass (solid black walls only); review in the tracer',
        },
        'calibration': {
            'mPerPx': args.mpp,
            'north': [[ax, ay + 100], [ax, ay]],
            'anchor': {'px': [ax, ay], 'scene': list(args.anchor_scene)},
        },
        'walls': walls,
        'drains': [],
        'wells': [],
        'savedAt': datetime.now(timezone.utc).isoformat(),
    }
    with open(args.out, 'w') as f:
        json.dump(data, f, separators=(',', ':'))
    print(f'{len(walls)} wall pieces from {int(mask.sum())} wall pixels -> {args.out}')


if __name__ == '__main__':
    main()
