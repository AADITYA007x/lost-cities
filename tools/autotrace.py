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


def drop_glyphs(mask, max_size=100):
    """Remove lettering (block numbers, street names) drawn in solid black.

    Walls are made of straight runs, so their row-by-row outline changes rarely;
    letters and digits are curved, so it changes almost every row."""
    lab, n = nd.label(mask)
    out = mask.copy()
    dropped = 0
    for i, sl in enumerate(nd.find_objects(lab), start=1):
        h = sl[0].stop - sl[0].start
        w = sl[1].stop - sl[1].start
        if max(h, w) > max_size:
            continue
        comp = lab[sl] == i
        fill = comp.mean()
        # count how often the left and right edges move from one row to the next
        changes = 0
        prev = None
        for row in comp:
            xs = np.flatnonzero(row)
            edge = (xs[0], xs[-1], len(xs)) if len(xs) else None
            if prev is not None and edge is not None and (abs(edge[0] - prev[0]) > 1 or abs(edge[1] - prev[1]) > 1 or abs(edge[2] - prev[2]) > 2):
                changes += 1
            prev = edge
        if changes / max(h, 1) > 0.25 and fill < 0.75:
            out[lab == i] = False
            dropped += 1
    return out, dropped


def dominant_angle(mask, axis, center=0.0, span=15.0, step=0.25):
    """Angle (degrees) that best lines up one family of walls with the image axes.

    axis=0: north-south walls become vertical (sharpest column profile);
    axis=1: east-west walls become horizontal (sharpest row profile).
    On some plans the grid is a few degrees off the page, and the two wall
    directions are not exactly square to each other on the scan."""
    small = nd.zoom(mask.astype(float), 0.25, order=1)
    best = (0.0, -1.0)
    for a in np.arange(center - span, center + span + step / 2, step):
        r = nd.rotate(small, a, reshape=False, order=1)
        score = r.sum(axis=axis).var()
        if score > best[1]:
            best = (float(a), score)
    return best[0]


def line_walls(mask, max_gap=10, min_len=6):
    """Find walls as centre lines at any angle: thin the mask to a skeleton, detect
    straight lines on it, measure each line's thickness from the distance to the
    wall edge, then join pieces that continue each other."""
    import cv2
    from skimage.morphology import skeletonize

    sk = skeletonize(mask)
    dist = nd.distance_transform_edt(mask)
    raw = cv2.HoughLinesP(sk.astype(np.uint8) * 255, 1, np.pi / 360, threshold=6,
                          minLineLength=min_len, maxLineGap=max_gap)
    if raw is None:
        return []
    h, w = mask.shape

    def width_of(x0, y0, x1, y1):
        n = max(2, int(np.hypot(x1 - x0, y1 - y0) / 2))
        xs = np.linspace(x0, x1, n).round().astype(int).clip(0, w - 1)
        ys = np.linspace(y0, y1, n).round().astype(int).clip(0, h - 1)
        return 2 * float(np.median(dist[ys, xs])) + 1.0  # the skeleton sits on a pixel centre

    segs = []
    for x0, y0, x1, y1 in raw.reshape(-1, 4).astype(float):
        wd = width_of(x0, y0, x1, y1)
        length = np.hypot(x1 - x0, y1 - y0)
        if wd < 2.5 or length < 0.6 * wd:
            continue  # thin lines, or stubs where the skeleton cuts across a corner
        segs.append([x0, y0, x1, y1, wd])

    def open_sides(sg):
        x0, y0, x1, y1, wd = sg
        length = np.hypot(x1 - x0, y1 - y0)
        n = max(3, int(length / 2))
        nx, ny = -(y1 - y0) / max(length, 1e-6), (x1 - x0) / max(length, 1e-6)
        off = wd / 2 + 3
        hits = 0
        for t in np.linspace(0.1, 0.9, n):
            cx, cy = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            free = 0
            for sgn in (1, -1):
                px = int(round(cx + nx * off * sgn))
                py = int(round(cy + ny * off * sgn))
                if 0 <= px < w and 0 <= py < h and not mask[py, px]:
                    free += 1
            hits += free == 2
        return hits / n

    # join pieces that continue each other: same direction, ends close, similar width
    def angle(sg):
        return np.arctan2(sg[3] - sg[1], sg[2] - sg[0]) % np.pi

    merged = True
    while merged:
        merged = False
        segs.sort(key=lambda sg: (round(angle(sg), 1), min(sg[0], sg[2]), min(sg[1], sg[3])))
        out = []
        for sg in segs:
            joined = False
            for o in out[-25:]:
                da = abs(angle(o) - angle(sg))
                da = min(da, np.pi - da)
                if da > np.radians(4) or abs(o[4] - sg[4]) > 0.45 * max(o[4], sg[4]):
                    continue
                pts = [(o[0], o[1]), (o[2], o[3]), (sg[0], sg[1]), (sg[2], sg[3])]
                gap = min(np.hypot(a[0] - b[0], a[1] - b[1]) for a in pts[:2] for b in pts[2:])
                # the new piece must lie on the line of the old one
                ux, uy = np.cos(angle(o)), np.sin(angle(o))
                off = max(abs((p[0] - o[0]) * uy - (p[1] - o[1]) * ux) for p in pts[2:])
                if gap > max_gap + o[4] or off > 0.6 * max(o[4], sg[4]):
                    continue
                proj = [(p[0] - o[0]) * ux + (p[1] - o[1]) * uy for p in pts]
                lo, hi = min(proj), max(proj)
                o[0], o[1] = o[0] + ux * lo, o[1] + uy * lo
                o[2], o[3] = o[0] + ux * (hi - lo), o[1] + uy * (hi - lo)
                o[4] = (o[4] + sg[4]) / 2
                joined = merged = True
                break
            if not joined:
                out.append(list(sg))
        segs = out

    # walls run in two (nearly square) directions; short pieces at odd angles are
    # artefacts where the skeleton cuts across a junction
    if segs:
        ang = np.array([angle(sg) % (np.pi / 2) for sg in segs])
        lens = np.array([np.hypot(sg[2] - sg[0], sg[3] - sg[1]) for sg in segs])
        hist, edges = np.histogram(ang, bins=90, range=(0, np.pi / 2), weights=lens)
        grid = (edges[hist.argmax()] + edges[hist.argmax() + 1]) / 2
        keep = []
        for sg, a, ln in zip(segs, ang, lens):
            dev = abs(a - grid)
            dev = min(dev, np.pi / 2 - dev)
            if dev > np.radians(12) and ln < 4 * sg[4]:
                continue
            # a slanted line inside a solid block of wall is the skeleton cutting a
            # corner, not a wall: a real slanted wall has open ground on both sides
            if dev > np.radians(6) and open_sides(sg) < 0.4:
                continue
            keep.append(sg)
        segs = keep
    return segs


def split_on_gaps(segs, ink, min_gap):
    """Cut each wall where its centre line crosses blank paper for at least min_gap
    pixels: on the plans those gaps are doorways and passages, which joining pieces
    of line can wrongly close. Lines that mostly cross blank paper (stray strokes
    across a room) fall apart into short bits and are dropped."""
    h, w = ink.shape
    out = []
    for x0, y0, x1, y1, wd in segs:
        length = np.hypot(x1 - x0, y1 - y0)
        n = max(2, int(length) + 1)
        ux, uy = (x1 - x0) / max(length, 1e-6), (y1 - y0) / max(length, 1e-6)
        nx, ny = -uy, ux
        r = max(1, int(wd * 0.25))
        on = np.zeros(n, bool)
        for i in range(n):
            t = i * length / (n - 1)
            cx, cy = x0 + ux * t, y0 + uy * t
            for k in range(-r, r + 1):
                px = int(round(cx + nx * k))
                py = int(round(cy + ny * k))
                if 0 <= px < w and 0 <= py < h and ink[py, px]:
                    on[i] = True
                    break
        # runs of ink, with short breaks (scan noise, thin lines) bridged
        pieces = []
        i = 0
        while i < n:
            if not on[i]:
                i += 1
                continue
            s = i
            while i < n:
                if on[i]:
                    i += 1
                    continue
                j = i
                while j < n and not on[j]:
                    j += 1
                if j - i >= min_gap or j >= n:
                    break
                i = j
            pieces.append((s, i - 1))
        for a, b in pieces:
            ta, tb = a * length / (n - 1), b * length / (n - 1)
            if tb - ta < max(0.6 * wd, min_gap):
                continue
            out.append([x0 + ux * ta, y0 + uy * ta, x0 + ux * tb, y0 + uy * tb, wd])
    return out


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


def write(args, walls, mask):
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
    ap.add_argument('--drop-glyphs', type=int, default=0, help='remove letter-shaped blobs up to this many px across')
    ap.add_argument('--rotate', default='auto', help="rect method: straighten walls first: 'auto', 'none' or degrees")
    ap.add_argument('--door-gap', type=float, default=0.5, help='lines method: cut walls where the plan shows blank paper for this many metres (doorways); 0 to turn off')
    ap.add_argument('--method', default='lines', choices=['lines', 'rects'], help='lines: centre lines at any angle (default); rects: upright boxes')
    args = ap.parse_args()

    gray = np.asarray(Image.open(args.image).convert('L'))
    mask = wall_mask(gray, dark=args.dark, min_thick=args.min_thick)
    for box in args.exclude:
        x0, y0, x1, y1 = (int(v) for v in box.split(','))
        mask[y0:y1, x0:x1] = False

    if args.drop_glyphs:
        mask, n = drop_glyphs(mask, args.drop_glyphs)
        print(f'dropped {n} letter-shaped blobs')

    if args.method == 'lines':
        walls = []
        segs = line_walls(mask)
        if args.door_gap > 0:
            # anything clearly darker than the paper counts as drawn (walls in any style)
            paper = np.percentile(gray, 90)
            ink = gray < paper - 40
            for box in args.exclude:
                x0, y0, x1, y1 = (int(v) for v in box.split(','))
                ink[y0:y1, x0:x1] = False
            before = len(segs)
            segs = split_on_gaps(segs, ink, max(2, round(args.door_gap / args.mpp)))
            print(f'doorways: {before} lines became {len(segs)} after cutting at gaps over {args.door_gap} m')
        for i, (x0, y0, x1, y1, wd) in enumerate(segs, start=1):
            if np.hypot(x1 - x0, y1 - y0) * args.mpp + wd * args.mpp < args.min_rect:
                continue
            walls.append({
                'id': i,
                'points': [[round(x0, 1), round(y0, 1)], [round(x1, 1), round(y1, 1)]],
                'width': round(wd * args.mpp, 3),
                'preserved': 1.0,
                'certainty': 'excavated',
                'auto': True,
            })
        write(args, walls, mask)
        return

    # straighten: rotate so each family of walls runs along the pixel axes, split into
    # rectangles, then rotate the pieces back. North-south and east-west walls are
    # handled in separate passes, because their slants can differ slightly on a scan.
    H0, W0 = mask.shape
    passes = []
    if args.rotate == 'none':
        passes = [(0.0, None)]
    elif args.rotate == 'auto':
        a_ns = dominant_angle(mask, 0)
        # the two wall directions are close to square: search near the first angle
        a_ew = dominant_angle(mask, 1, center=a_ns, span=3.0)
        print(f'wall angles: north-south {a_ns:.2f}, east-west {a_ew:.2f} degrees')
        passes = [(a_ns, 'tall'), (a_ew, 'wide')]
    else:
        passes = [(float(args.rotate), None)]

    pieces = []  # (rect, back-mapping function)
    for angle, keep in passes:
        m = nd.rotate(mask.astype(np.uint8) * 255, angle, reshape=True, order=1) > 127 if angle else mask
        H1, W1 = m.shape
        t = np.radians(angle)
        c, s_ = np.cos(t), np.sin(t)

        def back(x, y, c=c, s_=s_, W1=W1, H1=H1):
            dx = x - W1 / 2
            dy = y - H1 / 2
            return [W0 / 2 + dx * c - dy * s_, H0 / 2 + dx * s_ + dy * c]

        rects = rectangles(m)
        for _ in range(3):
            rects = merge_rows(merge_columns(rects))
        rects = [r for r in rects if min(r[2] - r[0], r[3] - r[1]) >= 2]
        for r in rects:
            w = r[2] - r[0]
            h = r[3] - r[1]
            if keep == 'tall' and w > h:
                continue
            if keep == 'wide' and h >= w:
                continue
            pieces.append((r, back))

    walls = []
    next_id = 1
    for (x0, y0, x1, y1), back in pieces:
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
        pts = [back(*p) for p in pts]
        walls.append({
            'id': next_id,
            'points': [[round(p[0], 1), round(p[1], 1)] for p in pts],
            'width': round(width, 3),
            'preserved': 1.0,
            'certainty': 'excavated',
            'auto': True,
        })
        next_id += 1

    write(args, walls, mask)


if __name__ == '__main__':
    main()
