import * as THREE from 'three';
import { Batch, CERTAINTY } from './batch.js';
import { buildHouse } from './houses.js';
import { buildCitadel, planCitadel } from './citadel.js';
import { loadTraces, buildTraced, TRACED_CELL } from './traced.js';
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
import { createBrickMaterial, createEarthMaterial, createRuinDepthMaterial } from '../materials.js';

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

// a well: a ring of wedge-shaped bricks, dark water inside, and a paved floor around
// it (paving around wells is common on the plans), so wells read from above
const wellApronMat = new THREE.MeshStandardMaterial({ color: '#c79f78', roughness: 0.95 });
const wellWaterMat = new THREE.MeshStandardMaterial({ color: '#122220', roughness: 0.15, metalness: 0.1 });
function wellMeshes(wells, brick) {
  const ring = new THREE.CylinderGeometry(0.85, 0.85, 0.8, 16, 1, true);
  ring.translate(0, 0.4, 0);
  const water = new THREE.CircleGeometry(0.72, 16);
  water.rotateX(-Math.PI / 2);
  water.translate(0, 0.3, 0);
  const apron = new THREE.BoxGeometry(2.5, 0.1, 2.5);
  apron.translate(0, 0.05, 0);

  const rings = new THREE.InstancedMesh(ring, brick, wells.length);
  const pools = new THREE.InstancedMesh(water, wellWaterMat, wells.length);
  const aprons = new THREE.InstancedMesh(apron, wellApronMat, wells.length);
  const m = new THREE.Matrix4();
  const certainty = new Float32Array(wells.length);
  wells.forEach((w, i) => {
    m.makeTranslation(w.x, w.y, w.z);
    rings.setMatrixAt(i, m);
    pools.setMatrixAt(i, m);
    aprons.setMatrixAt(i, m);
    certainty[i] = w.cert;
  });
  rings.geometry.setAttribute('aCertainty', new THREE.InstancedBufferAttribute(certainty, 1));
  rings.castShadow = true;
  rings.receiveShadow = true;
  aprons.receiveShadow = true;
  return [rings, pools, aprons];
}

const newBatches = () => ({ walls: new Batch({ collect: true }), roofs: new Batch(), paving: new Batch(), ramps: new Batch(), drains: new Batch(), wells: [], lamps: [], yards: [], courts: [], roofSpots: [], drainLines: [] });

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
  // a plot is taken by a traced plan when traced walls lie on it or close by; plots in
  // the empty corners of a plan's rectangle get generated houses, so no bare ring of
  // ground is left around the excavated quarters
  const cells = world.tracedCells || new Set();
  const isCovered = (l) => {
    const b = worldBox(l);
    if (!covered.some((c) => overlaps(b, c, 1))) return false;
    const m = 0.5;
    for (let cx = Math.floor((b.x0 - m) / TRACED_CELL); cx <= Math.floor((b.x1 + m) / TRACED_CELL); cx++) {
      for (let cz = Math.floor((b.z0 - m) / TRACED_CELL); cz <= Math.floor((b.z1 + m) / TRACED_CELL); cz++) {
        if (cells.has(`${cx},${cz}`)) return true;
      }
    }
    return false;
  };
  const isKnownAt = (x, z) => EXCAVATED_AREAS.some((a) => x >= a.x0 && x <= a.x1 && z >= a.z0 && z <= a.z1);
  const isKnown = (l) => {
    const [cx, cz] = gridToScene((l.x0 + l.x1) / 2, (l.z0 + l.z1) / 2);
    return EXCAVATED_AREAS.some((a) => cx >= a.x0 && cx <= a.x1 && cz >= a.z0 && cz <= a.z1);
  };

  const blocks = blocksBetweenStreets(localBounds, LOWER_TOWN_STREETS);
  let houseCount = 0;
  for (const block of blocks) {
    // plots a little smaller and lanes a little more frequent than before, closer to
    // the grain of the excavated plans
    for (const lot of subdivide(block, rng, { minLot: 8, maxLot: 20, laneChance: 0.5 })) {
      if (!insideLower(lot)) continue;
      if (rng.chance(0.04)) {
        // a few open yards (some become workshops in the life layer)
        if (insideLower(lot) && !isCovered(lot)) grid.yards.push({ ...lot });
        continue;
      }
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
  const drains = []; // centre lines in scene coordinates, for water in the monsoon
  for (const s of LOWER_TOWN_STREETS) {
    const span = spanAlong(s.axis, s.at);
    if (!span) continue;
    streetSpans.push({ ...s, span });
    const cert = s.known ? CERTAINTY.inferred : CERTAINTY.imagined;
    const off = s.at + s.width / 2 - 1.1;
    const mid = off + 0.3;
    drains.push({
      a: s.axis === 'ns' ? gridToScene(mid, span[0]) : gridToScene(span[0], mid),
      b: s.axis === 'ns' ? gridToScene(mid, span[1]) : gridToScene(span[1], mid),
      y: lower.y + 0.12,
      known: Boolean(s.known),
    });
    // the covered drain: a raised line of darker cover bricks, with a soak pit (a
    // brick-lined box where silt settled) every so often
    const dw = 0.8;
    const d0 = off - 0.1;
    if (s.axis === 'ns') grid.drains.box(d0, lower.y, span[0], d0 + dw, lower.y + 0.18, span[1], cert);
    else grid.drains.box(span[0], lower.y, d0, span[1], lower.y + 0.18, d0 + dw, cert);
    for (let t = span[0] + 12; t < span[1] - 6; t += 28) {
      if (s.axis === 'ns') grid.drains.box(d0 - 0.35, lower.y, t, d0 + dw + 0.35, lower.y + 0.4, t + 1.5, cert);
      else grid.drains.box(t, lower.y, d0 - 0.35, t + 1.5, lower.y + 0.4, d0 + dw + 0.35, cert);
    }
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
  // everything on the citadel is measured from the platform top when it falls to ruin
  const savedTags = [world.walls.tag, world.roofs.tag, world.paving.tag];
  world.walls.tag = world.roofs.tag = world.paving.tag = { era: 31, build: 0, base: citadel.y };
  buildCitadel(citadel, plan, rng, world, { detail, covered });
  [world.walls.tag, world.roofs.tag, world.paving.tag] = savedTags;
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

  // one shared uniform drives the certainty layer for every material
  const mixUniform = { value: 0 };
  const kinds = {
    walls: (opts) => createBrickMaterial({ ruins: true, ...opts }),
    roofs: (opts) => createEarthMaterial({ tone: '#c2a481', ruins: true, ...opts }),
    paving: (opts) => createBrickMaterial({ tone: '#a97452', ruins: true, ...opts }),
    drains: (opts) => createBrickMaterial({ tone: '#8d5a3e', ruins: true, ...opts }),
    ramps: (opts) => createEarthMaterial({ tone: '#ae9070', ruins: true, ...opts }),
  };
  const materials = {};
  for (const [kind, make] of Object.entries(kinds)) {
    materials[kind] = {
      base: make({}),
      ghost: make({ evidence: 'ghost', mixUniform }),
      sketch: make({ evidence: 'sketch', mixUniform }),
    };
  }
  const brick = materials.walls.base;
  const mudBrick = createBrickMaterial({ tone: '#a7865f' });
  const ground = createEarthMaterial({ tone: '#ae9070' });

  const citadelMesh = platformMesh(citadel.outline, citadel.y, [plan.pool], mudBrick, ground);
  const lowerMesh = platformMesh(lower.outline, lower.y, [], mudBrick, ground);
  citadelMesh.userData = { kind: 'platform', certainty: CERTAINTY.inferred, platform: 'citadel' };
  lowerMesh.userData = { kind: 'platform', certainty: CERTAINTY.inferred, platform: 'lowerTown' };
  group.add(citadelMesh, lowerMesh);

  const certaintyEntries = [];
  const pickables = [citadelMesh, lowerMesh];
  const ruinDepth = createRuinDepthMaterial();
  for (const [parent, b, frame] of [[group, world, 'world'], [gridGroup, grid, 'grid']]) {
    for (const kind of Object.keys(kinds)) {
      for (const { geometry, certainty } of b[kind].toGeometries()) {
        const set = materials[kind];
        const mesh = new THREE.Mesh(geometry, set.base);
        mesh.customDepthMaterial = ruinDepth;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { kind, certainty, frame };
        parent.add(mesh);
        pickables.push(mesh);
        if (certainty === CERTAINTY.inferred) certaintyEntries.push({ mesh, base: set.base, evidence: set.ghost });
        if (certainty === CERTAINTY.imagined) certaintyEntries.push({ mesh, base: set.base, evidence: set.sketch });
      }
    }
  }

  const wells = [
    ...world.wells,
    ...grid.wells.map((w) => {
      const [x, z] = gridToScene(w.x, w.z);
      return { ...w, x, z };
    }),
  ];
  // open yards and courtyards of generated houses, and street centre lines (scene
  // coordinates; yaw is the grid's turn), for people going about their day
  const toScene = (r) => {
    const [x, z] = gridToScene((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2);
    return { x, z, w: r.x1 - r.x0, d: r.z1 - r.z0, yaw: GRID.angle, known: isKnownAt(x, z) };
  };
  const yards = grid.yards.map(toScene);
  // every drain line in scene coordinates (streets and traced plans), for showing them
  const drainLines = [...drains.map((d) => [d.a[0], d.a[1], d.b[0], d.b[1], d.y]), ...world.drainLines];
  const roofSpots = [
    ...world.roofSpots,
    ...grid.roofSpots.map((r) => {
      const [x, z] = gridToScene(r.x, r.z);
      return { ...r, x, z, yaw: GRID.angle };
    }),
  ];
  const courts = grid.courts.map(toScene);
  const streets = streetSpans.map((st) => ({
    id: st.id,
    width: st.width,
    a: st.axis === 'ns' ? gridToScene(st.at, st.span[0]) : gridToScene(st.span[0], st.at),
    b: st.axis === 'ns' ? gridToScene(st.at, st.span[1]) : gridToScene(st.span[1], st.at),
    y: lower.y,
  }));

  // imagined evening lamps in generated houses (scene coordinates)
  const lamps = [
    ...world.lamps,
    ...grid.lamps.map((l) => {
      const [x, z] = gridToScene(l.x, l.z);
      return { x, z, y: l.y };
    }),
  ];
  const wellExtras = [];
  for (const cert of [CERTAINTY.excavated, CERTAINTY.inferred, CERTAINTY.imagined]) {
    const list = wells.filter((w) => w.cert === cert);
    if (!list.length) continue;
    for (const m of wellMeshes(list, brick)) {
      m.userData = { kind: 'well', certainty: cert, frame: 'world' };
      group.add(m);
      // in the evidence view, wells we only imagine are hidden
      if (cert === CERTAINTY.imagined) wellExtras.push({ object: m, hideInEvidence: true });
    }
  }

  // water in the Great Bath (it may not always have been full)
  const poolWater = new THREE.Mesh(
    new THREE.PlaneGeometry(plan.pool.x1 - plan.pool.x0, plan.pool.z1 - plan.pool.z0),
    new THREE.MeshStandardMaterial({ color: '#3e6662', roughness: 0.12, metalness: 0.0 })
  );
  poolWater.rotation.x = -Math.PI / 2;
  poolWater.position.set((plan.pool.x0 + plan.pool.x1) / 2, citadel.y + 0.3 - 0.7, (plan.pool.z0 + plan.pool.z1) / 2);
  poolWater.userData = { kind: 'pool', certainty: CERTAINTY.imagined, frame: 'world' };
  group.add(poolWater);
  pickables.push(poolWater);

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
    meshes: pickables.length,
  };

  return {
    group,
    platformHeightAt,
    features,
    stats,
    rects: { citadel, lowerTown: lower },
    certainty: { entries: certaintyEntries, mixUniform, extra: wellExtras },
    pickables,
    plan,
    covered,
    firstStreetSpan: first ? first.span : null,
    lamps,
    drains,
    drainLines,
    roofSpots,
    yards,
    courts,
    streets,
    wellsForLife: wells.filter((w) => w.cert !== CERTAINTY.excavated),
    // for walking: wall footprints (grid ones are in First Street's frame), wells, the pool
    obstacles: {
      world: world.walls.footprints,
      grid: grid.walls.footprints,
      wells: wells.map((w) => [w.x, w.z]),
      pool: plan.pool,
    },
  };
}
