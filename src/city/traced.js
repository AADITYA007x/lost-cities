import * as THREE from 'three';
import { CERTAINTY } from './batch.js';
import { makeTransform, isCalibrated } from './trace-transform.js';

// Every JSON file saved by the plan tracer into src/data/traced/ is picked up here.
const files = import.meta.glob('../data/traced/*.json', { eager: true, import: 'default' });

const H = 3.3; // ground storey: full height shown in the reconstruction

export function loadTraces() {
  return Object.entries(files)
    .map(([path, data]) => ({ path, data }))
    .filter(({ data }) => data && data.format === 'lost-cities-trace/1' && isCalibrated(data.calibration));
}

// Builds traced walls, drains and wells. Returns the areas they cover, so generated
// houses there can be left out.
export function buildTraced(traces, groundAt, out) {
  const covered = [];
  const v = (x, y, z) => new THREE.Vector3(x, y, z);

  for (const { data } of traces) {
    const toScene = makeTransform(data.calibration);
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

      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, az] = pts[i];
        const [bx, bz] = pts[i + 1];
        const len = Math.hypot(bx - ax, bz - az);
        if (len < 0.05) continue;
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

    if (x0 < x1) covered.push({ x0: x0 - 2, x1: x1 + 2, z0: z0 - 2, z1: z1 + 2, area: data.meta?.area });
  }
  return covered;
}
