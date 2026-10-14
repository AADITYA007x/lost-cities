import * as THREE from 'three';
import { CERTAINTY } from './batch.js';
import { sceneToGrid, gridToScene } from './layout.js';

// Roofs over the rooms of a traced plan, so excavated quarters read like the
// generated houses around them (which have roofs). Which rooms were roofed, and how,
// is not known: the roofs and the few upper rooms added here are imagined.
//
// The plan's walls are drawn into a 0.5 m grid in the city's own frame. Doorways are
// closed by growing the walls a little, then every closed space that is room-sized
// (and has no well in it) gets a flat roof. Big spaces (courtyards, lanes) stay open.

const CELL = 0.5;
const CLOSE = 0.85; // metres added to each side of a wall to close doorways
const H = 3.3; // ground storey, as for traced walls
const UPPER = 2.9;

// a stable random number for a place, so the roofs do not change between visits
const rand = (x, z, k) => {
  const v = Math.sin(x * 12.9898 + z * 78.233 + k * 37.719) * 43758.5453;
  return v - Math.floor(v);
};

export function roofTracedPlan(segments, wells, groundAt, out, era) {
  if (!segments.length) return;
  // bounds in the grid frame (u across First Street, v along it)
  let u0 = Infinity;
  let u1 = -Infinity;
  let v0 = Infinity;
  let v1 = -Infinity;
  const segs = segments.map(([ax, az, bx, bz, half]) => {
    const [ua, va] = sceneToGrid(ax, az);
    const [ub, vb] = sceneToGrid(bx, bz);
    u0 = Math.min(u0, ua, ub);
    u1 = Math.max(u1, ua, ub);
    v0 = Math.min(v0, va, vb);
    v1 = Math.max(v1, va, vb);
    return [ua, va, ub, vb, half];
  });
  u0 -= 3;
  v0 -= 3;
  u1 += 3;
  v1 += 3;
  const W = Math.ceil((u1 - u0) / CELL);
  const D = Math.ceil((v1 - v0) / CELL);
  if (W * D > 2e6) return;
  const closed = new Uint8Array(W * D); // 1 = wall, grown to close doorways
  const idx = (i, j) => j * W + i;

  // draw each wall as a thick line
  for (const [ua, va, ub, vb, half] of segs) {
    const len = Math.hypot(ub - ua, vb - va);
    const r = half + CLOSE;
    const steps = Math.max(1, Math.ceil(len / (CELL * 0.5)));
    const rc = Math.ceil(r / CELL);
    for (let s = 0; s <= steps; s++) {
      const u = ua + ((ub - ua) * s) / steps;
      const v = va + ((vb - va) * s) / steps;
      const ci = Math.floor((u - u0) / CELL);
      const cj = Math.floor((v - v0) / CELL);
      for (let dj = -rc; dj <= rc; dj++) {
        for (let di = -rc; di <= rc; di++) {
          const i = ci + di;
          const j = cj + dj;
          if (i < 0 || j < 0 || i >= W || j >= D) continue;
          const cu = u0 + (i + 0.5) * CELL - u;
          const cv = v0 + (j + 0.5) * CELL - v;
          if (cu * cu + cv * cv <= r * r) closed[idx(i, j)] = 1;
        }
      }
    }
  }

  // label open spaces: 2 = connected to the edge of the plan (outside), 3+ = closed spaces
  const label = new Int32Array(W * D);
  const stack = [];
  const fill = (si, sj, id) => {
    let n = 0;
    let bi0 = si;
    let bi1 = si;
    let bj0 = sj;
    let bj1 = sj;
    stack.length = 0;
    stack.push(idx(si, sj));
    label[idx(si, sj)] = id;
    while (stack.length) {
      const k = stack.pop();
      const i = k % W;
      const j = (k - i) / W;
      n++;
      bi0 = Math.min(bi0, i);
      bi1 = Math.max(bi1, i);
      bj0 = Math.min(bj0, j);
      bj1 = Math.max(bj1, j);
      if (i > 0 && !closed[k - 1] && !label[k - 1]) {
        label[k - 1] = id;
        stack.push(k - 1);
      }
      if (i < W - 1 && !closed[k + 1] && !label[k + 1]) {
        label[k + 1] = id;
        stack.push(k + 1);
      }
      if (j > 0 && !closed[k - W] && !label[k - W]) {
        label[k - W] = id;
        stack.push(k - W);
      }
      if (j < D - 1 && !closed[k + W] && !label[k + W]) {
        label[k + W] = id;
        stack.push(k + W);
      }
    }
    return { n, bi0, bi1, bj0, bj1 };
  };
  for (let i = 0; i < W; i++) {
    for (const j of [0, D - 1]) if (!closed[idx(i, j)] && !label[idx(i, j)]) fill(i, j, 2);
  }
  for (let j = 0; j < D; j++) {
    for (const i of [0, W - 1]) if (!closed[idx(i, j)] && !label[idx(i, j)]) fill(i, j, 2);
  }
  const rooms = [];
  let next = 3;
  for (let j = 0; j < D; j++) {
    for (let i = 0; i < W; i++) {
      const k = idx(i, j);
      if (closed[k] || label[k]) continue;
      const info = fill(i, j, next);
      rooms.push({ id: next, ...info });
      next++;
    }
  }

  // rooms with a well stay open (well rooms and courtyards)
  const wellIds = new Set();
  for (const [x, z] of wells) {
    const [u, v] = sceneToGrid(x, z);
    const i = Math.floor((u - u0) / CELL);
    const j = Math.floor((v - v0) / CELL);
    // look a little around the well, as it may sit on a grown wall cell
    for (let dj = -3; dj <= 3; dj++) {
      for (let di = -3; di <= 3; di++) {
        const ii = i + di;
        const jj = j + dj;
        if (ii >= 0 && jj >= 0 && ii < W && jj < D && label[idx(ii, jj)] > 2) wellIds.add(label[idx(ii, jj)]);
      }
    }
  }

  const roofed = new Map(); // id -> { upper }
  for (const r of rooms) {
    // the free space is measured inside the grown walls, so the real room is larger
    const area = r.n * CELL * CELL;
    const bw = (r.bi1 - r.bi0 + 1) * CELL;
    const bd = (r.bj1 - r.bj0 + 1) * CELL;
    if (area < 0.5 || area > 32 || Math.min(bw, bd) < 0.5 || wellIds.has(r.id)) continue;
    const cu = u0 + ((r.bi0 + r.bi1) / 2) * CELL;
    const cv = v0 + ((r.bj0 + r.bj1) / 2) * CELL;
    // most rooms are roofed; some stay open as small yards
    if (rand(cu, cv, 1) < 0.12) continue;
    roofed.set(r.id, { upper: area > 4 && area < 30 && rand(cu, cv, 2) < 0.3 });
  }
  if (!roofed.size) return;

  // one flat roof per room: the room's rectangle grown back out over its walls. (Many
  // small pieces would show seams; rooms are near enough rectangular on the plans.)
  // Neighbouring roofs overlap over the shared wall, so each sits at its own height.
  const grow = CLOSE + 0.35;
  const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const savedRoof = out.roofs.tag;
  const savedWall = out.walls.tag;
  for (const r of rooms) {
    const info = roofed.get(r.id);
    if (!info) continue;
    // irregular spaces (L-shaped or long and thin) keep no roof rather than a wrong one
    const cells = (r.bi1 - r.bi0 + 1) * (r.bj1 - r.bj0 + 1);
    if (r.n / cells < 0.5) continue;
    const a = [u0 + r.bi0 * CELL - grow, v0 + r.bj0 * CELL - grow];
    const b = [u0 + (r.bi1 + 1) * CELL + grow, v0 + (r.bj1 + 1) * CELL + grow];
    const ring = [gridToScene(a[0], a[1]), gridToScene(b[0], a[1]), gridToScene(b[0], b[1]), gridToScene(a[0], b[1])];
    const [mx, mz] = gridToScene((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    const y = groundAt(mx, mz);
    const lift = rand(mx, mz, 4) * 0.08;
    const box = (ya, yb) => [...ring.map(([x, z]) => v3(x, ya, z)), ...ring.map(([x, z]) => v3(x, yb, z))];
    const tag = { era, build: 0, base: y };
    out.roofs.tag = tag;
    out.walls.tag = tag;
    out.roofs.hexa(box(y + H, y + H + 0.25 + lift), CERTAINTY.imagined);
    if (info.upper) {
      // an upper room: its walls drawn as a solid block (slightly inset), with a roof
      const inset = [gridToScene(a[0] + 0.3, a[1] + 0.3), gridToScene(b[0] - 0.3, a[1] + 0.3), gridToScene(b[0] - 0.3, b[1] - 0.3), gridToScene(a[0] + 0.3, b[1] - 0.3)];
      const ibox = (ya, yb) => [...inset.map(([x, z]) => v3(x, ya, z)), ...inset.map(([x, z]) => v3(x, yb, z))];
      out.walls.hexa(ibox(y + H + 0.2, y + H + 0.3 + UPPER), CERTAINTY.imagined);
      out.roofs.hexa(box(y + H + 0.3 + UPPER, y + H + 0.55 + UPPER + lift), CERTAINTY.imagined);
    } else if (out.roofSpots && rand(mx, mz, 3) < 0.1) {
      out.roofSpots.push({ x: mx, z: mz, y: y + H + 0.25 + lift, w: b[0] - a[0], d: b[1] - a[1], yaw: null });
    }
  }
  out.roofs.tag = savedRoof;
  out.walls.tag = savedWall;
}
