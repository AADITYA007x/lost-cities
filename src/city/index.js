import * as THREE from 'three';
import { Batch, CERTAINTY } from './batch.js';
import { buildHouse } from './houses.js';
import { buildCitadel, planCitadel } from './citadel.js';
import { loadTraces, buildTraced } from './traced.js';
import {
  createRng,
  PLATFORMS,
  LOWER_TOWN_STREETS,
  EXCAVATED_AREAS,
  GRID,
  gridToScene,
  sceneToGrid,
  blocksBetweenStreets,
  subdivide,
  overlaps,
  pointInPolygon,
  boundsOf,
  centroidOf,
} from './layout.js';
import { createBrickMaterial, createEarthMaterial } from '../materials.js';

function platformMesh(outline, height, holes, sideMaterial, topMaterial) {
  const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, -z)));
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
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height + sink, bevelEnabled: false });
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

  const waterMat = new THREE.MeshStandardMaterial({ color: '#1d2a27', roughness: 0.3 });
  const rings = new THREE.InstancedMesh(ring, brick, wells.length);
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

const newBatches = () => ({ walls: new Batch(), roofs: new Batch(), paving: new Batch(), ramps: new Batch(), wells: [] });

export function buildCity({ lowPower = false } = {}) {
  const rng = createRng(2500);
  const detail = !lowPower;

  const citadel = { ...PLATFORMS.citadel, ...boundsOf(PLATFORMS.citadel.outline), y: PLATFORMS.citadel.height };
  const lower = { ...PLATFORMS.lowerTown, ...boundsOf(PLATFORMS.lowerTown.outline), y: PLATFORMS.lowerTown.height };

  function platformHeightAt(x, z) {
    if (pointInPolygon(x, z, citadel.outline)) return citadel.y;
    if (pointInPolygon(x, z, lower.outline)) return lower.y;
    return -Infinity;
  }

  // world-space pieces (traced plans, citadel) and grid-space pieces (generated lower town)
  const world = newBatches();
  const grid = newBatches();

  // ---------- traced plans (excavated walls) come first ----------
  const traces = loadTraces();
  const covered = buildTraced(traces, (x, z) => Math.max(0, platformHeightAt(x, z)), world);

  // ---------- lower town, generated in First Street's frame ----------
  const corners = (l) => [[l.x0, l.z0], [l.x1, l.z0], [l.x1, l.z1], [l.x0, l.z1]].map(([u, v]) => gridToScene(u, v));
  const localOutline = lower.outline.map(([x, z]) => sceneToGrid(x, z));
  const localBounds = boundsOf(localOutline);
  const insideLower = (l) => corners(l).every(([x, z]) => pointInPolygon(x, z, lower.outline));
  const worldBox = (l) => boundsOf(corners(l));
  const isCovered = (l) => covered.some((c) => overlaps(worldBox(l), c, 1));
  const isKnown = (l) => {
    const [cx, cz] = gridToScene((l.x0 + l.x1) / 2, (l.z0 + l.z1) / 2);
    return EXCAVATED_AREAS.some((a) => cx >= a.x0 && cx <= a.x1 && cz >= a.z0 && cz <= a.z1);
  };

  const blocks = blocksBetweenStreets(localBounds, LOWER_TOWN_STREETS);
  let houseCount = 0;
  for (const block of blocks) {
    for (const lot of subdivide(block, rng)) {
      if (!insideLower(lot)) continue;
      if (rng.chance(0.04)) continue; // a few open yards
      if (isCovered(lot)) continue; // traced houses stand here instead
      buildHouse(lot, lower.y, rng, grid, { known: isKnown(lot), detail });
      houseCount++;
    }
  }

  // covered drains along the streets; First Street's is known, the others continue the pattern
  const spanAlong = (axis, at) => {
    // the stretch of a street line that lies on the platform
    let lo = Infinity;
    let hi = -Infinity;
    const [a0, a1] = axis === 'ns' ? [localBounds.z0, localBounds.z1] : [localBounds.x0, localBounds.x1];
    for (let t = a0; t <= a1; t += 4) {
      const [x, z] = axis === 'ns' ? gridToScene(at, t) : gridToScene(t, at);
      if (pointInPolygon(x, z, lower.outline)) {
        lo = Math.min(lo, t);
        hi = Math.max(hi, t);
      }
    }
    return lo < hi ? [lo + 3, hi - 3] : null;
  };
  const streetSpans = [];
  for (const s of LOWER_TOWN_STREETS) {
    const span = spanAlong(s.axis, s.at);
    if (!span) continue;
    streetSpans.push({ ...s, span });
    const cert = s.known ? CERTAINTY.inferred : CERTAINTY.imagined;
    const off = s.at + s.width / 2 - 1.1;
    if (s.axis === 'ns') grid.paving.box(off, lower.y, span[0], off + 0.6, lower.y + 0.12, span[1], cert);
    else grid.paving.box(span[0], lower.y, off, span[1], lower.y + 0.12, off + 0.6, cert);
  }

  // ramps where First Street leaves the platform (imagined)
  const first = streetSpans.find((s) => s.id === 'first-street');
  if (first) {
    const w = first.width / 2;
    const RL = 45;
    grid.ramps.ramp(-w, first.span[0] - 3 - RL, w, first.span[0] - 3, -0.5, lower.y, 's', CERTAINTY.imagined);
    grid.ramps.ramp(-w, first.span[1] + 3, w, first.span[1] + 3 + RL, -0.5, lower.y, 'n', CERTAINTY.imagined);
  }

  // ---------- citadel ----------
  const bathTraced = traces.some(({ data }) => data.meta?.area === 'SD' && /XXII/.test(data.meta?.plate || ''));
  const plan = planCitadel(citadel, { bathTraced });
  buildCitadel(citadel, plan, rng, world, { detail, covered });
  // a ramp from the citadel east toward the lower town (imagined)
  const rz = plan.bath.z1 + 20;
  const edge = (() => {
    for (let x = citadel.x1; x > citadel.x0; x -= 2) if (pointInPolygon(x, rz, citadel.outline)) return x;
    return citadel.x1;
  })();
  world.ramps.ramp(edge, rz - 3.5, edge + 70, rz + 3.5, -0.5, citadel.y, 'w', CERTAINTY.imagined);

  // ---------- meshes ----------
  const group = new THREE.Group();
  group.name = 'city';
  const gridGroup = new THREE.Group();
  gridGroup.name = 'lower-town-generated';
  gridGroup.position.set(GRID.origin[0], 0, GRID.origin[1]);
  gridGroup.rotation.y = GRID.angle;
  group.add(gridGroup);

  const brick = createBrickMaterial();
  const mudBrick = createBrickMaterial({ tone: '#a7865f' });
  const plaster = createEarthMaterial({ tone: '#c2a481' });
  const ground = createEarthMaterial({ tone: '#ae9070' });
  const paveMat = createBrickMaterial({ tone: '#a97452' });

  group.add(platformMesh(citadel.outline, citadel.y, [plan.pool], mudBrick, ground));
  group.add(platformMesh(lower.outline, lower.y, [], mudBrick, ground));

  const add = (parent, batch, material) => {
    if (!batch.vertexCount) return null;
    const mesh = new THREE.Mesh(batch.toGeometry(), material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  for (const [parent, b] of [[group, world], [gridGroup, grid]]) {
    add(parent, b.walls, brick);
    add(parent, b.roofs, plaster);
    add(parent, b.paving, paveMat);
    add(parent, b.ramps, ground);
  }
  const wells = [
    ...world.wells,
    ...grid.wells.map((w) => {
      const [x, z] = gridToScene(w.x, w.z);
      return { ...w, x, z };
    }),
  ];
  if (wells.length) for (const m of wellMeshes(wells, brick)) group.add(m);

  // water in the Great Bath (it may not always have been full)
  const poolWater = new THREE.Mesh(
    new THREE.PlaneGeometry(plan.pool.x1 - plan.pool.x0, plan.pool.z1 - plan.pool.z0),
    new THREE.MeshStandardMaterial({ color: '#3e6662', roughness: 0.12, metalness: 0.0 })
  );
  poolWater.rotation.x = -Math.PI / 2;
  poolWater.position.set((plan.pool.x0 + plan.pool.x1) / 2, citadel.y + 0.3 - 0.7, (plan.pool.z0 + plan.pool.z1) / 2);
  group.add(poolWater);

  const [ccx, ccz] = centroidOf(citadel.outline);
  const [lcx, lcz] = centroidOf(lower.outline);
  const [fx, fz] = first ? gridToScene(0, first.span[0] + (first.span[1] - first.span[0]) * 0.42) : [0, 0];
  const tracedCenter = covered.length
    ? (() => {
        const c = covered[0];
        const x = (c.x0 + c.x1) / 2;
        const z = (c.z0 + c.z1) / 2;
        return new THREE.Vector3(x, Math.max(0, platformHeightAt(x, z)), z);
      })()
    : null;

  const features = {
    greatBath: new THREE.Vector3((plan.bath.x0 + plan.bath.x1) / 2, citadel.y + 5, (plan.bath.z0 + plan.bath.z1) / 2),
    greatHall: new THREE.Vector3((plan.hall.x0 + plan.hall.x1) / 2, citadel.y + 7, (plan.hall.z0 + plan.hall.z1) / 2),
    firstStreet: new THREE.Vector3(fx, lower.y + 2, fz),
    citadel: new THREE.Vector3(ccx, citadel.y, ccz),
    lowerTown: new THREE.Vector3(lcx, lower.y, lcz),
    traced: tracedCenter,
    tracedAreas: Object.fromEntries(
      covered.map((c) => {
        const x = (c.x0 + c.x1) / 2;
        const z = (c.z0 + c.z1) / 2;
        return [c.area, new THREE.Vector3(x, Math.max(0, platformHeightAt(x, z)), z)];
      })
    ),
  };

  const stats = {
    houses: houseCount,
    tracedPlates: traces.length,
    tracedAreas: covered.map((c) => c.area),
    vertices: [world, grid].reduce((n, b) => n + b.walls.vertexCount + b.roofs.vertexCount + b.paving.vertexCount, 0),
  };

  return { group, platformHeightAt, features, stats, rects: { citadel, lowerTown: lower } };
}
