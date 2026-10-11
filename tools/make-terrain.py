"""
Turns the Copernicus DEM GLO-30 tile N27 E068 into the small terrain file the app loads.

You do not need to run this: its output (public/terrain/mohenjo-daro.bin + .json) is committed.
It is kept so anyone can see exactly how the landscape was made.

Requires: Python 3, numpy, scipy, tifffile, imagecodecs
Usage:    python tools/make-terrain.py data-raw/Copernicus_DSM_COG_10_N27_00_E068_00_DEM.tif public/terrain
"""

import json
import sys
from pathlib import Path

import numpy as np
import scipy.ndimage as nd
import tifffile

TILE_LAT_TOP = 28.0       # tile N27: 27..28 N, 68..69 E, 1 arc-second pixels
TILE_LON_LEFT = 68.0
PX = 1.0 / 3600.0

# Scene origin: between the citadel mound and the lower town, read from the DEM.
ORIGIN_LAT = 27.3290 - 16 * PX
ORIGIN_LON = 68.1386 - 5 * PX

SIZE_M = 8000.0           # square area, metres
GRID = 257                # vertices per side (31.25 m spacing)


def main(src, out_dir):
    dem = tifffile.imread(src).astype(np.float64)

    m_per_px_lat = 111_320.0 * PX
    m_per_px_lon = 111_320.0 * PX * np.cos(np.radians(ORIGIN_LAT))

    row0 = (TILE_LAT_TOP - ORIGIN_LAT) / PX
    col0 = (ORIGIN_LON - TILE_LON_LEFT) / PX

    # work on a window a little larger than the output area
    pad = 200
    r0, c0 = int(row0) - pad, int(col0) - pad
    dem = dem[r0:r0 + 2 * pad, c0:c0 + 2 * pad]
    row0 -= r0
    col0 -= c0

    # --- remove thin modern features (roads, canals, embankments), keep landforms
    smooth = nd.gaussian_filter(nd.median_filter(dem, size=7), 1.2)

    # --- the plain without the mounds: very wide median, blended in only on the site
    wide = nd.median_filter(dem, size=61)
    rel = nd.gaussian_filter(dem, 1.0) - wide

    rows = np.arange(dem.shape[0])[:, None] - row0
    cols = np.arange(dem.shape[1])[None, :] - col0

    # Mound boxes in DEM pixels relative to the origin (read from a relative-height map).
    citadel_box = (rows > -16) & (rows < 10) & (cols > -21) & (cols < -7)
    lower_box = (rows > -16) & (rows < 18) & (cols > -8) & (cols < 23)

    def mound_mask(box):
        m = (rel > 1.2) & box
        m = nd.binary_closing(m, iterations=2)
        m = nd.binary_fill_holes(m)
        m = nd.binary_opening(m, iterations=1)
        return nd.gaussian_filter(m.astype(np.float64), 1.4)

    citadel = mound_mask(citadel_box)
    lower = mound_mask(lower_box)

    def top_height(box):
        vals = rel[(rel > 1.2) & box]
        return float(np.percentile(vals, 85))

    citadel_top = top_height(citadel_box)
    lower_top = top_height(lower_box)

    site = np.clip((citadel + lower) * 1.6, 0, 1)
    plain = smooth * (1 - site) + nd.gaussian_filter(wide, 2) * site

    # --- water: the modern Indus surface is perfectly flat in the DEM
    flat = nd.generic_filter(dem, np.std, size=3) < 0.05
    flat &= dem < 44.6
    lab, n = nd.label(flat)
    sizes = nd.sum(flat, lab, range(1, n + 1))
    water = np.isin(lab, 1 + np.where(sizes > 300)[0])
    water = nd.binary_closing(water, iterations=4)
    water = nd.binary_fill_holes(water)
    water = nd.gaussian_filter(water.astype(np.float64), 1.0)
    water_level = float(np.median(dem[water > 0.9]))

    # --- resample to a metre grid (x east, z south)
    half = SIZE_M / 2
    xs = np.linspace(-half, half, GRID)
    zs = np.linspace(-half, half, GRID)
    zz, xx = np.meshgrid(zs, xs, indexing="ij")
    rr = row0 + zz / m_per_px_lat
    cc = col0 + xx / m_per_px_lon
    coords = np.array([rr.ravel(), cc.ravel()])

    def sample(arr):
        return nd.map_coordinates(arr, coords, order=1, mode="nearest").reshape(GRID, GRID)

    plain_g = sample(plain)
    cit_g = np.clip(sample(citadel), 0, 1)
    low_g = np.clip(sample(lower), 0, 1)
    wat_g = np.clip(sample(water), 0, 1)

    base = float(np.floor(plain_g.min()))
    heights_cm = np.round((plain_g - base) * 100).astype("<u2")
    masks = np.stack([cit_g, low_g, wat_g], axis=-1)
    masks_u8 = np.round(masks * 255).astype(np.uint8)

    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    with open(out / "mohenjo-daro.bin", "wb") as f:
        f.write(heights_cm.tobytes())
        f.write(masks_u8.tobytes())

    meta = {
        "source": "Copernicus DEM GLO-30, tile N27 E068",
        "grid": GRID,
        "sizeMeters": SIZE_M,
        "originLatLon": [round(ORIGIN_LAT, 6), round(ORIGIN_LON, 6)],
        "baseElevation": base,
        "heightUnit": "cm above baseElevation, uint16, row-major, rows north to south",
        "masks": "uint8 x3 per vertex after heights: citadel, lower town, water",
        "waterLevel": round(water_level - base, 2),
        "citadelTop": round(citadel_top, 2),
        "lowerTownTop": round(lower_top, 2),
    }
    (out / "mohenjo-daro.json").write_text(json.dumps(meta, indent=2))
    print(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
