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

  // ---------- which places can be reached on foot from First Street ----------
  // A coarser grid (50 cm) of open cells, flood-filled from the street. Rooms with no
  // doorway on the plan (common on old plans, and in generated houses) stay unreached.
  const RC = 0.5;
  const rw = Math.ceil((BOUNDS.x1 - BOUNDS.x0) / RC);
  const rh = Math.ceil((BOUNDS.z1 - BOUNDS.z0) / RC);
  let reach = null;
  function buildReach(onPlatform, startX, startZ, outlines) {
    // open = on a platform, and none of the four fine cells under it holds a wall
    const open = new Uint8Array(rw * rh);
    const bit = (cx, cz) => {
      const i = cz * w + cx;
      return (bits[i >> 5] >>> (i & 31)) & 1;
    };
    for (let r = 0; r < rh; r++) {
      const z = BOUNDS.z0 + (r + 0.5) * RC;
      // where this row crosses the platform outlines (a scanline, much faster than
      // testing every cell against the polygons)
      const xs = [];
      for (const poly of outlines) {
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const [xi, zi] = poly[i];
          const [xj, zj] = poly[j];
          if (zi > z !== zj > z) xs.push(xi + ((z - zi) * (xj - xi)) / (zj - zi));
        }
      }
      xs.sort((a, b) => a - b);
      const fz = Math.floor((z - 0.25 - BOUNDS.z0) / CELL);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const c0 = Math.max(0, Math.ceil((xs[k] - BOUNDS.x0) / RC - 0.5));
        const c1 = Math.min(rw - 1, Math.floor((xs[k + 1] - BOUNDS.x0) / RC - 0.5));
        for (let c = c0; c <= c1; c++) {
          const fx = c * 2;
          if (fz < 0 || fz + 1 >= h || fx + 1 >= w) continue;
          if (!bit(fx, fz) && !bit(fx + 1, fz) && !bit(fx, fz + 1) && !bit(fx + 1, fz + 1)) open[r * rw + c] = 1;
        }
      }
    }
    void onPlatform;
    reach = new Uint8Array(rw * rh);
    const queue = new Int32Array(rw * rh);
    let head = 0;
    let tail = 0;
    const start = nearestFree(startX, startZ, onPlatform, 20);
    if (!start) return;
    const s0 = Math.floor((start[1] - BOUNDS.z0) / RC) * rw + Math.floor((start[0] - BOUNDS.x0) / RC);
    if (!open[s0]) return;
    reach[s0] = 1;
    queue[tail++] = s0;
    while (head < tail) {
      const i = queue[head++];
      const c = i % rw;
      const nbrs = [c > 0 ? i - 1 : -1, c < rw - 1 ? i + 1 : -1, i - rw, i + rw];
      for (const j of nbrs) {
        if (j < 0 || j >= rw * rh || reach[j] || !open[j]) continue;
        reach[j] = 1;
        queue[tail++] = j;
      }
    }
  }
  function reachable(x, z) {
    if (!reach) return true;
    const c = Math.floor((x - BOUNDS.x0) / RC);
    const r = Math.floor((z - BOUNDS.z0) / RC);
    if (c < 0 || r < 0 || c >= rw || r >= rh) return false;
    // a cell or one of its neighbours (the walker can stand close to a wall)
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= 0 && cc >= 0 && rr < rh && cc < rw && reach[rr * rw + cc]) return true;
    }
    return false;
  }
  // the nearest place that is connected to the streets
  function nearestReachable(x, z, maxR = 150) {
    if (!reach) return null;
    const c0 = Math.floor((x - BOUNDS.x0) / RC);
    const r0 = Math.floor((z - BOUNDS.z0) / RC);
    // a reached cell with room to stand (a little more than the walker needs)
    const at = (c, r) =>
      c >= 0 && r >= 0 && c < rw && r < rh && reach[r * rw + c] && free(BOUNDS.x0 + (c + 0.5) * RC, BOUNDS.z0 + (r + 0.5) * RC, 0.42);
    if (at(c0, r0)) return [BOUNDS.x0 + (c0 + 0.5) * RC, BOUNDS.z0 + (r0 + 0.5) * RC];
    const maxK = Math.ceil(maxR / RC);
    for (let k = 1; k <= maxK; k++) {
      let best = null;
      let bestD = Infinity;
      for (let dc = -k; dc <= k; dc++) {
        for (const dr of [-k, k]) {
          if (at(c0 + dc, r0 + dr) && dc * dc + dr * dr < bestD) [best, bestD] = [[c0 + dc, r0 + dr], dc * dc + dr * dr];
          if (at(c0 + dr, r0 + dc) && dc * dc + dr * dr < bestD) [best, bestD] = [[c0 + dr, r0 + dc], dc * dc + dr * dr];
        }
      }
      if (best) {
        return [BOUNDS.x0 + (best[0] + 0.5) * RC, BOUNDS.z0 + (best[1] + 0.5) * RC];
      }
    }
    return null;
  }

  return { blocked, free, nearestFree, buildReach, reachable, nearestReachable, cell: CELL, bounds: BOUNDS, width: w, height: h, bits };
}
