import * as THREE from 'three';

// How sure we are about each piece of the city.
export const CERTAINTY = {
  excavated: 0,
  inferred: 1,
  imagined: 2,
};
export const CERTAINTY_NAMES = ['excavated', 'inferred', 'imagined'];

// Pieces are grouped into square tiles so the renderer can skip what is off-screen
// and a click only has to test the tiles under the pointer.
const TILE = 160;

const QUAD_UV = [0, 0, 1, 0, 1, 1, 0, 1];

class Bucket {
  constructor(certainty, tx, tz) {
    this.certainty = certainty;
    this.tx = tx;
    this.tz = tz;
    this.positions = [];
    this.normals = [];
    this.quad = [];
    this.indices = [];
    this.count = 0;
  }
}

// Collects many boxes and wedges into a few geometries: one per certainty level and tile.
export class Batch {
  constructor() {
    this.buckets = new Map();
    this.vertexCount = 0;
  }

  bucket(certainty, x, z) {
    const tx = Math.floor(x / TILE);
    const tz = Math.floor(z / TILE);
    const key = `${certainty}:${tx}:${tz}`;
    let b = this.buckets.get(key);
    if (!b) {
      b = new Bucket(certainty, tx, tz);
      this.buckets.set(key, b);
    }
    return b;
  }

  // Eight corners: bottom ring (y0) then top ring (y1), each ordered
  // [x0z0, x1z0, x1z1, x0z1].
  hexa(c, certainty, { bottom = false } = {}) {
    const faces = [
      [4, 5, 6, 7], // top
      [0, 1, 5, 4], // north (z0)
      [2, 3, 7, 6], // south (z1)
      [3, 0, 4, 7], // west (x0)
      [1, 2, 6, 5], // east (x1)
    ];
    if (bottom) faces.push([3, 2, 1, 0]);
    const cx = (c[0].x + c[2].x) / 2;
    const cz = (c[0].z + c[2].z) / 2;
    const b = this.bucket(certainty, cx, cz);
    const e1 = new THREE.Vector3();
    const e2 = new THREE.Vector3();
    const n = new THREE.Vector3();
    for (const f of faces) {
      const p0 = c[f[0]];
      e1.subVectors(c[f[1]], p0);
      e2.subVectors(c[f[3]], p0);
      n.crossVectors(e2, e1);
      if (n.lengthSq() < 1e-10) continue;
      n.normalize();
      const base = b.count;
      f.forEach((k, i) => {
        const p = c[k];
        b.positions.push(p.x, p.y, p.z);
        b.normals.push(n.x, n.y, n.z);
        b.quad.push(QUAD_UV[i * 2], QUAD_UV[i * 2 + 1]);
      });
      b.indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
      b.count += 4;
      this.vertexCount += 4;
    }
  }

  // Axis-aligned box from corner to corner.
  box(x0, y0, z0, x1, y1, z1, certainty, opts) {
    if (x1 - x0 < 0.01 || z1 - z0 < 0.01 || y1 - y0 < 0.01) return;
    const v = (x, y, z) => new THREE.Vector3(x, y, z);
    this.hexa(
      [v(x0, y0, z0), v(x1, y0, z0), v(x1, y0, z1), v(x0, y0, z1), v(x0, y1, z0), v(x1, y1, z0), v(x1, y1, z1), v(x0, y1, z1)],
      certainty,
      opts
    );
  }

  // A ramp rising from height base at one end to top at the other.
  // dir: which end is high: 'n' (z0), 's' (z1), 'w' (x0), 'e' (x1).
  ramp(x0, z0, x1, z1, base, top, dir, certainty) {
    const v = (x, y, z) => new THREE.Vector3(x, y, z);
    const hi = (x, z) => {
      if (dir === 'n') return z === z0 ? top : base + 0.05;
      if (dir === 's') return z === z1 ? top : base + 0.05;
      if (dir === 'w') return x === x0 ? top : base + 0.05;
      return x === x1 ? top : base + 0.05;
    };
    this.hexa(
      [
        v(x0, base, z0), v(x1, base, z0), v(x1, base, z1), v(x0, base, z1),
        v(x0, hi(x0, z0), z0), v(x1, hi(x1, z0), z0), v(x1, hi(x1, z1), z1), v(x0, hi(x0, z1), z1),
      ],
      certainty
    );
  }

  // One geometry per (certainty, tile).
  toGeometries() {
    const out = [];
    for (const b of this.buckets.values()) {
      if (!b.count) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.positions, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(b.normals, 3));
      g.setAttribute('aQuad', new THREE.Float32BufferAttribute(b.quad, 2));
      g.setIndex(b.count > 65535 ? new THREE.Uint32BufferAttribute(b.indices, 1) : new THREE.Uint16BufferAttribute(b.indices, 1));
      g.computeBoundingSphere();
      g.computeBoundingBox();
      out.push({ geometry: g, certainty: b.certainty });
    }
    return out;
  }
}
