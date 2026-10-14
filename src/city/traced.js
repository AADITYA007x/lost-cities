import * as THREE from 'three';
import { CERTAINTY } from './batch.js';
import { makeTransform, isCalibrated } from './trace-transform.js';
import { sceneToGrid, gridToScene, FIRST_STREET } from './layout.js';

// First Street is known to be an open street. Auto-traced lines that cross its middle
// are almost always drains, cover stones or lettering drawn on the plan, not walls,
// so the part of a traced wall inside this core is left out.
const STREET_CORE = 2.4; // metres either side of the centre line
const STREET_LEN = Math.hypot(FIRST_STREET.south[0] - FIRST_STREET.north[0], FIRST_STREET.south[1] - FIRST_STREET.north[1]);

// pieces [a, b] (scene points) of a segment that lie outside the street core
function outsideStreet(a, b) {
  const [ua, va] = sceneToGrid(a[0], a[1]);
  const [ub, vb] = sceneToGrid(b[0], b[1]);
  if (Math.max(va, vb) < 0 || Math.min(va, vb) > STREET_LEN) return [[a, b]];
  // u changes linearly along the segment: find where it is inside [-core, core]
  const du = ub - ua;
  let t0;
  let t1;
  if (Math.abs(du) < 1e-6) {
    if (Math.abs(ua) >= STREET_CORE) return [[a, b]];
    t0 = 0;
    t1 = 1;
  } else {
    const ta = (-STREET_CORE - ua) / du;
    const tb = (STREET_CORE - ua) / du;
    t0 = Math.max(0, Math.min(ta, tb));
    t1 = Math.min(1, Math.max(ta, tb));
    if (t0 >= t1) return [[a, b]];
  }
  const at = (t) => gridToScene(ua + du * t, va + (vb - va) * t);
  const out = [];
  if (t0 > 0) out.push([a, at(t0)]);
  if (t1 < 1) out.push([at(t1), b]);
  return out;
}

// Every JSON file saved by the plan tracer into src/data/traced/ is picked up here.
const files = import.meta.glob('../data/traced/*.json', { eager: true, import: 'default' });

const H = 3.3; // ground storey: full height shown in the reconstruction

export function loadTraces() {
  return Object.entries(files)
    .map(([path, data]) => ({ path, data }))
    .filter(({ data }) => data && data.format === 'lost-cities-trace/1' && isCalibrated(data.calibration));
}

// Which moments of the city-through-time view a traced plan belongs to (a bit mask:
// 1 founding, 2 height, 4 late, 8 buried, 16 today). Mackay drew DK-G one level at a
// time: his Late levels show the city in decline, Intermediate I its height (and what
// stands exposed today). Marshall's plans mix levels: shown from the height on.
export function eraOfTrace(data) {
  const level = data.meta?.level || '';
  if (/late/i.test(level)) return 4;
  if (/intermediate/i.test(level)) return 2 | 8 | 16;
  return 2 | 4 | 8 | 16;
}

// Builds traced walls, drains and wells. Returns the areas they cover, so generated
// houses there can be left out.
export function buildTraced(traces, groundAt, out) {
  const covered = [];
  const v = (x, y, z) => new THREE.Vector3(x, y, z);

  for (const { data } of traces) {
    const toScene = makeTransform(data.calibration);
    const savedTag = out.walls.tag;
    out.walls.tag = { era: eraOfTrace(data), build: 0, base: null };
    out.walls.tag = { ...out.walls.tag };
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    const grow = ([x, z]) => {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      z0 = Math.min(z0, z);
      z1 = Math.max(z1, z);
    };

    for (const wall of data.walls || []) {
      const pts = wall.points.map(toScene);
      pts.forEach(grow);
      const half = (wall.width || 0.9) / 2;
      const lowCert = wall.certainty === 'inferred' ? CERTAINTY.inferred : CERTAINTY.excavated;
      const standing = Math.min(H, Math.max(0.2, wall.preserved ?? 1.5));

      const pieces = [];
      for (let i = 0; i < pts.length - 1; i++) pieces.push(...outsideStreet(pts[i], pts[i + 1]));
      for (const [[ax, az], [bx, bz]] of pieces) {
        const len = Math.hypot(bx - ax, bz - az);
        if (len < 0.3) continue;
        const dx = (bx - ax) / len;
        const dz = (bz - az) / len;
        // extend each end by half the width so corners close
        const sx = ax - dx * half;
        const sz = az - dz * half;
        const ex = bx + dx * half;
        const ez = bz + dz * half;
        const nx = dz * half;
        const nz = -dx * half;
        const y = groundAt((ax + bx) / 2, (az + bz) / 2);
        out.walls.tag.base = y; // ruins are measured from the ground, for both parts of the wall
        const corners = (ya, yb) => [
          v(sx + nx, ya, sz + nz), v(ex + nx, ya, ez + nz), v(ex - nx, ya, ez - nz), v(sx - nx, ya, sz - nz),
          v(sx + nx, yb, sz + nz), v(ex + nx, yb, ez + nz), v(ex - nx, yb, ez - nz), v(sx - nx, yb, sz - nz),
        ];
        // the part that still stands is what was found; the rest of the storey is inferred
        out.walls.hexa(corners(y, y + standing), lowCert);
        if (standing < H) out.walls.hexa(corners(y + standing, y + H), CERTAINTY.inferred);
      }
    }

    for (const drain of data.drains || []) {
      const pts = drain.points.map(toScene);
      pts.forEach(grow);
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, az] = pts[i];
        const [bx, bz] = pts[i + 1];
        const len = Math.hypot(bx - ax, bz - az);
        if (len < 0.05) continue;
        const nx = ((bz - az) / len) * 0.3;
        const nz = (-(bx - ax) / len) * 0.3;
        const y = groundAt((ax + bx) / 2, (az + bz) / 2);
        out.paving.hexa(
          [
            v(ax + nx, y, az + nz), v(bx + nx, y, bz + nz), v(bx - nx, y, bz - nz), v(ax - nx, y, az - nz),
            v(ax + nx, y + 0.12, az + nz), v(bx + nx, y + 0.12, bz + nz), v(bx - nx, y + 0.12, bz - nz), v(ax - nx, y + 0.12, az - nz),
          ],
          CERTAINTY.excavated
        );
      }
    }

    for (const well of data.wells || []) {
      const [x, z] = toScene(well.point);
      grow([x, z]);
      out.wells.push({ x, z, y: groundAt(x, z), cert: well.certainty === 'inferred' ? CERTAINTY.inferred : CERTAINTY.excavated });
    }

    out.walls.tag = savedTag;

    if (x0 < x1) {
      covered.push({
        x0: x0 - 2,
        x1: x1 + 2,
        z0: z0 - 2,
        z1: z1 + 2,
        area: data.meta?.area,
        source: data.meta?.source,
        plate: data.meta?.plate,
        level: data.meta?.level,
        reviewed: Boolean(data.meta?.reviewed),
      });
    }
  }
  return covered;
}
