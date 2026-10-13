import { gridToScene } from './city/layout.js';

// A fine grid (25 cm cells, one bit each) marking where walls stand, for walking.
// Built once, the first time someone walks.

const CELL = 0.25;
const BOUNDS = { x0: -560, x1: 460, z0: -520, z1: 420 };

export function buildCollision(obstacles, platformHeightAt) {
  const w = Math.ceil((BOUNDS.x1 - BOUNDS.x0) / CELL);
  const h = Math.ceil((BOUNDS.z1 - BOUNDS.z0) / CELL);
  const bits = new Uint32Array(Math.ceil((w * h) / 32));

  const set = (cx, cz) => {
    if (cx < 0 || cz < 0 || cx >= w || cz >= h) return;
    const i = cz * w + cx;
    bits[i >> 5] |= 1 << (i & 31);
  };

  // fill a convex quad (four corners in order) by testing cell centres
  function fillQuad(q) {
    let minx = Infinity;
    let maxx = -Infinity;
    let minz = Infinity;
    let maxz = -Infinity;
    for (let k = 0; k < 8; k += 2) {
      minx = Math.min(minx, q[k]);
      maxx = Math.max(maxx, q[k]);
      minz = Math.min(minz, q[k + 1]);
      maxz = Math.max(maxz, q[k + 1]);
    }
    const c0 = Math.floor((minx - BOUNDS.x0) / CELL);
    const c1 = Math.floor((maxx - BOUNDS.x0) / CELL);
    const r0 = Math.floor((minz - BOUNDS.z0) / CELL);
    const r1 = Math.floor((maxz - BOUNDS.z0) / CELL);
    // orientation of the quad, so the inside test works either way round
    const area = (q[2] - q[0]) * (q[5] - q[1]) - (q[3] - q[1]) * (q[4] - q[0]);
    const sgn = area >= 0 ? 1 : -1;
    for (let r = r0; r <= r1; r++) {
      const z = BOUNDS.z0 + (r + 0.5) * CELL;
      for (let c = c0; c <= c1; c++) {
        const x = BOUNDS.x0 + (c + 0.5) * CELL;
        let inside = true;
        for (let k = 0; k < 8; k += 2) {
          const ax = q[k];
          const az = q[k + 1];
          const bx = q[(k + 2) % 8];
          const bz = q[(k + 3) % 8];
          if (sgn * ((bx - ax) * (z - az) - (bz - az) * (x - ax)) < 0) {
            inside = false;
            break;
          }
        }
        if (inside) set(c, r);
      }
    }
  }

  const ground = (x, z) => Math.max(0, platformHeightAt(x, z));
  const addFootprints = (list, toWorld) => {
    for (const f of list) {
      const q = toWorld
        ? [...toWorld(f[0], f[1]), ...toWorld(f[2], f[3]), ...toWorld(f[4], f[5]), ...toWorld(f[6], f[7])]
        : f.slice(0, 8);
      const mx = (q[0] + q[4]) / 2;
      const mz = (q[1] + q[5]) / 2;
      const g = ground(mx, mz);
      // only pieces that stand on the ground and rise above knee height block the way
      if (f[8] > g + 1.2 || f[9] < g + 0.5) continue;
      fillQuad(q);
    }
  };
  addFootprints(obstacles.world, null);
  addFootprints(obstacles.grid, gridToScene);
  for (const [x, z] of obstacles.wells) {
    const r = 0.9;
    fillQuad([x - r, z - r, x + r, z - r, x + r, z + r, x - r, z + r]);
  }
  const p = obstacles.pool;
  fillQuad([p.x0, p.z0, p.x1, p.z0, p.x1, p.z1, p.x0, p.z1]);

  function blocked(x, z) {
    const cx = Math.floor((x - BOUNDS.x0) / CELL);
    const cz = Math.floor((z - BOUNDS.z0) / CELL);
    if (cx < 0 || cz < 0 || cx >= w || cz >= h) return true;
    const i = cz * w + cx;
    return (bits[i >> 5] >>> (i & 31)) & 1;
  }

  // is a body of this radius free here? (centre plus eight points on its rim)
  function free(x, z, radius = 0.3) {
    if (blocked(x, z)) return false;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      if (blocked(x + Math.cos(a) * radius, z + Math.sin(a) * radius)) return false;
    }
    return true;
  }

  // nearest free spot on a platform, searching outward in rings
  function nearestFree(x, z, onPlatform, maxR = 60) {
    if (free(x, z) && onPlatform(x, z)) return [x, z];
    for (let r = 0.5; r <= maxR; r += 0.5) {
      const n = Math.max(8, Math.round((2 * Math.PI * r) / 0.5));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        const px = x + Math.cos(a) * r;
        const pz = z + Math.sin(a) * r;
        if (free(px, pz, 0.45) && onPlatform(px, pz)) return [px, pz];
      }
    }
    return null;
  }

  return { blocked, free, nearestFree, cell: CELL, bounds: BOUNDS, width: w, height: h, bits };
}
