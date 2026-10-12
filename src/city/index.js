import * as THREE from 'three';
import { Batch, CERTAINTY } from './batch.js';
import { buildHouse } from './houses.js';
import { buildCitadel, planCitadel } from './citadel.js';
import { loadTraces, buildTraced } from './traced.js';
import {
  createRng,
  PLATFORMS,
  rectOf,
  LOWER_TOWN_STREETS,
  EXCAVATED_AREAS,
  blocksBetweenStreets,
  subdivide,
  overlaps,
} from './layout.js';
import { createBrickMaterial, createEarthMaterial } from '../materials.js';

function platformMesh(rect, holes, sideMaterial, topMaterial) {
  const shape = new THREE.Shape();
  shape.moveTo(rect.x0, -rect.z0);
  shape.lineTo(rect.x1, -rect.z0);
  shape.lineTo(rect.x1, -rect.z1);
  shape.lineTo(rect.x0, -rect.z1);
  shape.closePath();
  for (const h of holes) {
    const p = new THREE.Path();
    p.moveTo(h.x0, -h.z0);
    p.lineTo(h.x0, -h.z1);
    p.lineTo(h.x1, -h.z1);
    p.lineTo(h.x1, -h.z0);
    p.closePath();
    shape.holes.push(p);
  }
  // the base sits a little below the plain so no gap shows at uneven ground
  const sink = 1.5;
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: rect.y + sink, bevelEnabled: false });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, -sink, 0);
  const mesh = new THREE.Mesh(geometry, [topMaterial, sideMaterial]);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  return mesh;
}

function wellMeshes(wells, brick) {
  const ring = new THREE.CylinderGeometry(0.85, 0.85, 0.75, 14, 1, true);
  ring.translate(0, 0.375, 0);
  const water = new THREE.CircleGeometry(0.7, 14);
  water.rotateX(-Math.PI / 2);
  water.translate(0, 0.25, 0);

  const ringMat = brick;
  const waterMat = new THREE.MeshStandardMaterial({ color: '#1d2a27', roughness: 0.3 });
  const rings = new THREE.InstancedMesh(ring, ringMat, wells.length);
  const pools = new THREE.InstancedMesh(water, waterMat, wells.length);
  const m = new THREE.Matrix4();
  const certainty = new Float32Array(wells.length);
  wells.forEach((w, i) => {
    m.makeTranslation(w.x, w.y, w.z);
    rings.setMatrixAt(i, m);
    pools.setMatrixAt(i, m);
    certainty[i] = w.cert;
  });
  rings.geometry.setAttribute('aCertainty', new THREE.InstancedBufferAttribute(certainty, 1));
  rings.castShadow = true;
  rings.receiveShadow = true;
  return [rings, pools];
}

export function buildCity({ lowPower = false } = {}) {
  const rng = createRng(2500);
  const detail = !lowPower;

  const out = {
    walls: new Batch(),
    roofs: new Batch(),
    paving: new Batch(),
    ramps: new Batch(),
    wells: [],
  };

  const citadelRect = rectOf(PLATFORMS.citadel);
  const lowerRect = rectOf(PLATFORMS.lowerTown);

  const inRect = (r, x, z, m = 0) => x >= r.x0 - m && x <= r.x1 + m && z >= r.z0 - m && z <= r.z1 + m;
  function platformHeightAt(x, z) {
    if (inRect(citadelRect, x, z)) return citadelRect.y;
    if (inRect(lowerRect, x, z)) return lowerRect.y;
    return -Infinity;
  }

  // ---------- traced plans (excavated walls) come first ----------
  const traces = loadTraces();
  const covered = buildTraced(traces, (x, z) => Math.max(0, platformHeightAt(x, z)), out);
  const isCovered = (lot) => covered.some((c) => overlaps(lot, c, 1));

  // ---------- lower town ----------
  const lw = lowerRect.x1 - lowerRect.x0;
  const ld = lowerRect.z1 - lowerRect.z0;
  const isKnown = (lot) => {
    const u = ((lot.x0 + lot.x1) / 2 - lowerRect.x0) / lw;
    const v = ((lot.z0 + lot.z1) / 2 - lowerRect.z0) / ld;
    return EXCAVATED_AREAS.some((a) => u >= a.u0 && u <= a.u1 && v >= a.v0 && v <= a.v1);
  };

  const blocks = blocksBetweenStreets(lowerRect, LOWER_TOWN_STREETS);
  let houseCount = 0;
  for (const block of blocks) {
    for (const lot of subdivide(block, rng)) {
      if (rng.chance(0.04)) continue; // a few open yards
      if (isCovered(lot)) continue; // traced houses stand here instead
      buildHouse(lot, lowerRect.y, rng, out, { known: isKnown(lot), detail });
      houseCount++;
    }
  }

  // covered drains along the main streets (drains are among the best-attested features)
  for (const s of LOWER_TOWN_STREETS) {
    if (s.axis === 'ns') {
      const x = lowerRect.x0 + s.at * lw + s.width / 2 - 1.1;
      out.paving.box(x, lowerRect.y, lowerRect.z0 + 3, x + 0.6, lowerRect.y + 0.12, lowerRect.z1 - 3, CERTAINTY.inferred);
    } else {
      const z = lowerRect.z0 + s.at * ld + s.width / 2 - 1.1;
      out.paving.box(lowerRect.x0 + 3, lowerRect.y, z, lowerRect.x1 - 3, lowerRect.y + 0.12, z + 0.6, CERTAINTY.inferred);
    }
  }

  // ramps where main streets meet the edge of the platform (imagined)
  const RL = 45;
  for (const s of LOWER_TOWN_STREETS.filter((s) => s.name)) {
    if (s.axis === 'ns') {
      const x = lowerRect.x0 + s.at * lw;
      out.ramps.ramp(x - s.width / 2, lowerRect.z0 - RL, x + s.width / 2, lowerRect.z0, -0.5, lowerRect.y, 's', CERTAINTY.imagined);
      out.ramps.ramp(x - s.width / 2, lowerRect.z1, x + s.width / 2, lowerRect.z1 + RL, -0.5, lowerRect.y, 'n', CERTAINTY.imagined);
    } else {
      const z = lowerRect.z0 + s.at * ld;
      out.ramps.ramp(lowerRect.x0 - RL, z - s.width / 2, lowerRect.x0, z + s.width / 2, -0.5, lowerRect.y, 'e', CERTAINTY.imagined);
      out.ramps.ramp(lowerRect.x1, z - s.width / 2, lowerRect.x1 + RL, z + s.width / 2, -0.5, lowerRect.y, 'w', CERTAINTY.imagined);
    }
  }

  // ---------- citadel ----------
  const plan = planCitadel(citadelRect);
  buildCitadel(citadelRect, plan, rng, out, { detail, covered });
  // a ramp from the citadel down toward the lower town (imagined)
  const rz = (citadelRect.z0 + citadelRect.z1) / 2 + 40;
  out.ramps.ramp(citadelRect.x1, rz - 3.5, citadelRect.x1 + 70, rz + 3.5, -0.5, citadelRect.y, 'w', CERTAINTY.imagined);

  // ---------- meshes ----------
  const group = new THREE.Group();
  group.name = 'city';

  const brick = createBrickMaterial();
  const mudBrick = createBrickMaterial({ tone: '#a7865f' });
  const plaster = createEarthMaterial({ tone: '#c2a481' });
  const ground = createEarthMaterial({ tone: '#ae9070' });
  const paveMat = createBrickMaterial({ tone: '#a97452' });

  group.add(platformMesh(citadelRect, [plan.pool], mudBrick, ground));
  group.add(platformMesh(lowerRect, [], mudBrick, ground));

  const add = (batch, material) => {
    const mesh = new THREE.Mesh(batch.toGeometry(), material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  add(out.walls, brick);
  add(out.roofs, plaster);
  add(out.paving, paveMat);
  add(out.ramps, ground);
  for (const m of wellMeshes(out.wells, brick)) group.add(m);

  // water in the Great Bath (it may not always have been full)
  const poolWater = new THREE.Mesh(
    new THREE.PlaneGeometry(plan.pool.x1 - plan.pool.x0, plan.pool.z1 - plan.pool.z0),
    new THREE.MeshStandardMaterial({ color: '#3e6662', roughness: 0.12, metalness: 0.0 })
  );
  poolWater.rotation.x = -Math.PI / 2;
  poolWater.position.set((plan.pool.x0 + plan.pool.x1) / 2, citadelRect.y + 0.3 - 0.7, (plan.pool.z0 + plan.pool.z1) / 2);
  group.add(poolWater);


  const firstStreet = LOWER_TOWN_STREETS[0];
  const eastStreet = LOWER_TOWN_STREETS[3];
  const features = {
    greatBath: new THREE.Vector3((plan.bath.x0 + plan.bath.x1) / 2, citadelRect.y + 5, (plan.bath.z0 + plan.bath.z1) / 2),
    greatHall: new THREE.Vector3((plan.hall.x0 + plan.hall.x1) / 2, citadelRect.y + 7, (plan.hall.z0 + plan.hall.z1) / 2),
    firstStreet: new THREE.Vector3(lowerRect.x0 + firstStreet.at * lw, lowerRect.y + 2, lowerRect.z0 + ld * 0.2),
    eastStreet: new THREE.Vector3(lowerRect.x0 + lw * 0.88, lowerRect.y + 2, lowerRect.z0 + eastStreet.at * ld),
    citadel: new THREE.Vector3(PLATFORMS.citadel.cx, citadelRect.y, PLATFORMS.citadel.cz),
    lowerTown: new THREE.Vector3(PLATFORMS.lowerTown.cx, lowerRect.y, PLATFORMS.lowerTown.cz),
    traced: covered.length
      ? new THREE.Vector3((covered[0].x0 + covered[0].x1) / 2, Math.max(0, platformHeightAt((covered[0].x0 + covered[0].x1) / 2, (covered[0].z0 + covered[0].z1) / 2)), (covered[0].z0 + covered[0].z1) / 2)
      : null,
  };

  const stats = {
    houses: houseCount,
    tracedPlates: traces.length,
    tracedAreas: covered.map((c) => c.area),
    vertices: out.walls.vertexCount + out.roofs.vertexCount + out.paving.vertexCount,
  };

  return { group, platformHeightAt, features, stats, rects: { citadel: citadelRect, lowerTown: lowerRect } };
}
