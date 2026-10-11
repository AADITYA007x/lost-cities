// The overall plan of the city: platforms, main streets and house plots.
// Coordinates are metres in the scene: x east, z south, origin between the two mounds.

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

// Platform rectangles. Centres come from the elevation data (the two mounds);
// sizes are rounded approximations of the published site plans.
export const PLATFORMS = {
  citadel: { cx: -431, cz: -143, w: 210, d: 420, height: 10 },
  lowerTown: { cx: 139, cz: 31, w: 620, d: 820, height: 6 },
};

export function rectOf(p) {
  return { x0: p.cx - p.w / 2, x1: p.cx + p.w / 2, z0: p.cz - p.d / 2, z1: p.cz + p.d / 2, y: p.height };
}

// Main streets of the lower town, as fractions of the platform (u: west to east, v: north to south).
// First Street (north-south) and East Street (east-west) are names used by the excavators;
// their positions here are approximate until the plans are traced.
export const LOWER_TOWN_STREETS = [
  { id: 'first-street', name: 'First Street', axis: 'ns', at: 0.42, width: 9 },
  { id: 'ns-east', name: null, axis: 'ns', at: 0.78, width: 6.5 },
  { id: 'ns-west', name: null, axis: 'ns', at: 0.12, width: 5 },
  { id: 'east-street', name: 'East Street', axis: 'ew', at: 0.38, width: 8 },
  { id: 'ew-south', name: null, axis: 'ew', at: 0.72, width: 6 },
];

// Areas named by the excavators, roughly placed (u, v fractions of the lower town).
// Houses inside them are marked "inferred" (houses were excavated here, our layout is generated);
// elsewhere "imagined".
export const EXCAVATED_AREAS = [
  { id: 'HR', u0: 0.13, u1: 0.42, v0: 0.22, v1: 0.6 },
  { id: 'VS', u0: 0.12, u1: 0.42, v0: 0.6, v1: 0.85 },
  { id: 'DK', u0: 0.55, u1: 0.96, v0: 0.38, v1: 0.88 },
];

// Split a rectangle into blocks between streets.
export function blocksBetweenStreets(rect, streets, margin = 5) {
  const w = rect.x1 - rect.x0;
  const d = rect.z1 - rect.z0;
  const cutsX = [[rect.x0 + margin, 0]];
  const cutsZ = [[rect.z0 + margin, 0]];
  for (const s of streets) {
    if (s.axis === 'ns') cutsX.push([rect.x0 + s.at * w, s.width]);
    else cutsZ.push([rect.z0 + s.at * d, s.width]);
  }
  cutsX.push([rect.x1 - margin, 0]);
  cutsZ.push([rect.z1 - margin, 0]);
  cutsX.sort((a, b) => a[0] - b[0]);
  cutsZ.sort((a, b) => a[0] - b[0]);

  const blocks = [];
  for (let i = 0; i < cutsX.length - 1; i++) {
    for (let j = 0; j < cutsZ.length - 1; j++) {
      const x0 = cutsX[i][0] + cutsX[i][1] / 2;
      const x1 = cutsX[i + 1][0] - cutsX[i + 1][1] / 2;
      const z0 = cutsZ[j][0] + cutsZ[j][1] / 2;
      const z1 = cutsZ[j + 1][0] - cutsZ[j + 1][1] / 2;
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
