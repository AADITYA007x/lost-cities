import * as THREE from 'three';

// Certainty levels, stored per vertex so the certainty layer can restyle the whole city in one shader.
export const CERTAINTY = {
  excavated: 0,
  inferred: 1,
  imagined: 2,
};

// Collects many boxes / wedges into one geometry (one draw call per material).
export class Batch {
  constructor() {
    this.positions = [];
    this.normals = [];
    this.certainty = [];
    this.indices = [];
    this.vertexCount = 0;
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
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const n = new THREE.Vector3();
    for (const f of faces) {
      const p0 = c[f[0]];
      const p1 = c[f[1]];
      const p3 = c[f[3]];
      a.subVectors(p1, p0);
      b.subVectors(p3, p0);
      n.crossVectors(b, a).normalize();
      if (n.lengthSq() === 0) continue;
      const base = this.vertexCount;
      for (const k of f) {
        const p = c[k];
        this.positions.push(p.x, p.y, p.z);
        this.normals.push(n.x, n.y, n.z);
        this.certainty.push(certainty);
      }
      this.indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
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

  // A ramp rising from height y0 at one end to y1 at the other.
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

  toGeometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    g.setAttribute('aCertainty', new THREE.Float32BufferAttribute(this.certainty, 1));
    g.setIndex(this.vertexCount > 65535 ? new THREE.Uint32BufferAttribute(this.indices, 1) : new THREE.Uint16BufferAttribute(this.indices, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}
