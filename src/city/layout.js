// The overall plan of the city: platforms, main streets and house plots.
// Coordinates are metres in the scene: x east, z south.
//
// Positions come from Mackay 1938, Plate I (site plan of Mohenjo-daro), lined up with
// the Copernicus elevation data: the stupa on the citadel mound is the anchor, and the
// plan's scale bar gives 1.408 m per scan pixel. The mounds on the plan match the
// elevation data to within about 15 m.

export function createRng(seed = 2500) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (lo, hi) => lo + (hi - lo) * next(),
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
  };
}

// Mackay 1938 Plate I pixel -> scene metres
export const SITE_PLAN = { source: 'Mackay 1938, Plate I', mPerPx: 1.408, anchorPx: [340, 462], anchorScene: [-383, -110] };
export function fromSitePlan(px, py) {
  const { mPerPx, anchorPx, anchorScene } = SITE_PLAN;
  return [anchorScene[0] + (px - anchorPx[0]) * mPerPx, anchorScene[1] + (py - anchorPx[1]) * mPerPx];
}

// Platform outlines follow the outer contours of the mounds on the site plan (simplified).
export const PLATFORMS = {
  citadel: {
    height: 10,
    outline: [
      [-492.8, -236.7], [-397.1, -246.6], [-319.6, -218.4], [-305.6, -126.9], [-312.6, -28.3], [-340.8, 6.9],
      [-371.7, 28.0], [-376.0, 98.4], [-408.3, 140.6], [-474.5, 147.7], [-509.7, 112.5], [-516.8, 28.0],
      [-502.7, -28.3], [-509.7, -126.9], [-506.9, -197.3],
    ],
  },
  lowerTown: {
    height: 6,
    outline: [
      [-94.4, -422.6], [-16.9, -471.9], [67.6, -481.7], [152.0, -447.9], [250.6, -397.2], [321.0, -338.1],
      [363.2, -225.5], [384.4, -84.7], [391.4, 56.1], [377.3, 168.8], [405.5, 239.2], [377.3, 312.4],
      [264.7, 340.6], [123.9, 354.6], [11.2, 380.0], [-101.4, 387.0], [-185.9, 365.9], [-207.0, 281.4],
      [-171.8, 196.9], [-157.7, 112.5], [-157.7, 28.0], [-129.6, -56.5], [-143.6, -141.0], [-157.7, -197.3],
      [-150.7, -295.9], [-129.6, -366.3],
    ],
  },
};

// Areas dug by the excavators (red on the site plan), as scene rectangles.
// Generated houses inside them are marked "inferred" (houses were found here, our layout is generated);
// houses elsewhere are "imagined". Traced plans replace generated houses entirely.
export const EXCAVATED_AREAS = [
  { id: 'DK-G', x0: -136.6, x1: 46.4, z0: -401.5, z1: -197.3 },
  { id: 'DK-B/C', x0: 173.2, x1: 363.2, z0: -190.3, z1: -105.8 },
  { id: 'DK-A', x0: 304.1, x1: 352.0, z0: -49.5, z1: 2.6 },
  { id: 'VS', x0: -129.6, x1: 39.4, z0: 20.9, z1: 154.7 },
  { id: 'HR', x0: -171.8, x1: 4.2, z0: 211.0, z1: 351.8 },
  { id: 'SD', x0: -502.7, x1: -312.6, z0: -232.5, z1: -28.3 },
  { id: 'L', x0: -509.7, x1: -376.0, z0: 6.9, z1: 140.6 },
];

// First Street: one straight street that runs through DK-G, VS and HR on the site plan.
// Its width (about 7 m) is measured on Mackay Plate XVIII.
export const FIRST_STREET = { north: [46.4, -401.5], south: [-45.1, 351.8], width: 7 };

// The lower town's houses are generated in a frame aligned with First Street
// (about 7 degrees off north), so streets and houses follow the city's own grid.
const fdx = FIRST_STREET.south[0] - FIRST_STREET.north[0];
const fdz = FIRST_STREET.south[1] - FIRST_STREET.north[1];
const flen = Math.hypot(fdx, fdz);
export const GRID = {
  origin: FIRST_STREET.north,
  // unit vectors in the scene: v runs south along First Street, u runs east across it
  v: [fdx / flen, fdz / flen],
  u: [fdz / flen, -fdx / flen],
  angle: Math.atan2(fdx, fdz), // rotation about y that maps local axes to the scene
};
export function gridToScene(u, v) {
  return [GRID.origin[0] + u * GRID.u[0] + v * GRID.v[0], GRID.origin[1] + u * GRID.u[1] + v * GRID.v[1]];
}
export function sceneToGrid(x, z) {
  const dx = x - GRID.origin[0];
  const dz = z - GRID.origin[1];
  return [dx * GRID.u[0] + dz * GRID.u[1], dx * GRID.v[0] + dz * GRID.v[1]];
}

// Streets in grid coordinates (u across, v along). Only First Street is known end to end;
// the others continue the pattern and are imagined.
export const LOWER_TOWN_STREETS = [
  { id: 'first-street', name: 'First Street', axis: 'ns', at: 0, width: FIRST_STREET.width, known: true },
  { id: 'ns-west', name: null, axis: 'ns', at: -125, width: 5 },
  { id: 'ns-east', name: null, axis: 'ns', at: 215, width: 6 },
  { id: 'ns-far-east', name: null, axis: 'ns', at: 360, width: 5 },
  { id: 'ew-1', name: null, axis: 'ew', at: 215, width: 6 },
  { id: 'ew-2', name: null, axis: 'ew', at: 470, width: 6 },
  { id: 'ew-3', name: null, axis: 'ew', at: 640, width: 5 },
];

export function pointInPolygon(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function boundsOf(poly) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const [x, z] of poly) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    z0 = Math.min(z0, z);
    z1 = Math.max(z1, z);
  }
  return { x0, x1, z0, z1 };
}

export function centroidOf(poly) {
  let x = 0;
  let z = 0;
  for (const p of poly) {
    x += p[0];
    z += p[1];
  }
  return [x / poly.length, z / poly.length];
}

// Split a rectangle into blocks between streets.
export function blocksBetweenStreets(rect, streets, margin = 0) {
  const cutsX = [[rect.x0 + margin, 0]];
  const cutsZ = [[rect.z0 + margin, 0]];
  for (const s of streets) {
    if (s.axis === 'ns') cutsX.push([s.at, s.width]);
    else cutsZ.push([s.at, s.width]);
  }
  cutsX.push([rect.x1 - margin, 0]);
  cutsZ.push([rect.z1 - margin, 0]);
  const keepX = cutsX.filter(([p]) => p >= rect.x0 && p <= rect.x1).sort((a, b) => a[0] - b[0]);
  const keepZ = cutsZ.filter(([p]) => p >= rect.z0 && p <= rect.z1).sort((a, b) => a[0] - b[0]);

  const blocks = [];
  for (let i = 0; i < keepX.length - 1; i++) {
    for (let j = 0; j < keepZ.length - 1; j++) {
      const x0 = keepX[i][0] + keepX[i][1] / 2;
      const x1 = keepX[i + 1][0] - keepX[i + 1][1] / 2;
      const z0 = keepZ[j][0] + keepZ[j][1] / 2;
      const z1 = keepZ[j + 1][0] - keepZ[j + 1][1] / 2;
      if (x1 - x0 > 8 && z1 - z0 > 8) {
        blocks.push({ x0, x1, z0, z1, open: { n: true, s: true, w: true, e: true } });
      }
    }
  }
  return blocks;
}

// Recursively divide a block into house plots, leaving narrow lanes between some of them.
export function subdivide(block, rng, { minLot = 9, maxLot = 24, laneChance = 0.42, laneWidth = [1.6, 2.6] } = {}) {
  const lots = [];
  const stack = [block];
  while (stack.length) {
    const r = stack.pop();
    const w = r.x1 - r.x0;
    const d = r.z1 - r.z0;
    const big = Math.max(w, d);
    if (big <= maxLot && (big < minLot * 2 || rng.chance(0.55))) {
      lots.push(r);
      continue;
    }
    if (big < minLot * 2) {
      lots.push(r);
      continue;
    }
    const lane = rng.chance(laneChance) ? rng.range(laneWidth[0], laneWidth[1]) : 0;
    const t = rng.range(0.36, 0.64);
    if (w >= d) {
      const cut = r.x0 + w * t;
      stack.push({ x0: r.x0, x1: cut - lane / 2, z0: r.z0, z1: r.z1, open: { ...r.open, e: lane > 0 } });
      stack.push({ x0: cut + lane / 2, x1: r.x1, z0: r.z0, z1: r.z1, open: { ...r.open, w: lane > 0 } });
    } else {
      const cut = r.z0 + d * t;
      stack.push({ x0: r.x0, x1: r.x1, z0: r.z0, z1: cut - lane / 2, open: { ...r.open, s: lane > 0 } });
      stack.push({ x0: r.x0, x1: r.x1, z0: cut + lane / 2, z1: r.z1, open: { ...r.open, n: lane > 0 } });
    }
  }
  return lots;
}

export function overlaps(a, b, margin = 0) {
  return a.x0 < b.x1 + margin && a.x1 > b.x0 - margin && a.z0 < b.z1 + margin && a.z1 > b.z0 - margin;
}
