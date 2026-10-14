import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CRAFTS } from './content/crafts.js';
import { createRng } from './city/layout.js';

// People in the city: simple figures at work in open yards and courtyards, people
// drawing water at wells, and people walking the streets. All imagined (the crafts
// themselves are known from finds; see content/crafts.js).
//
// Every body part is one InstancedMesh, so the whole crowd costs a handful of draw
// calls. Each frame the parts of nearby figures are posed from a few angles.

const WORKSHOP_CRAFTS = ['beads', 'shell', 'potter', 'seals', 'spinning', 'metal'];
const SKIN = ['#7a4e33', '#8a5a3b', '#6b4430', '#9a6845', '#5e3b29'];
const CLOTH = ['#e6dcc6', '#d9cbb0', '#cdb894', '#b9643f', '#e9e1cf', '#a8754d', '#d6c4a0'];

// ---------- geometry ----------
function partGeometries() {
  const body = mergeGeometries([
    new THREE.CylinderGeometry(0.14, 0.16, 0.56, 10).translate(0, 0.28, 0), // chest
    new THREE.CylinderGeometry(0.16, 0.25, 0.52, 12).translate(0, -0.24, 0), // wrap to the knee
  ]);
  const head = mergeGeometries([
    new THREE.SphereGeometry(0.105, 12, 9).translate(0, 0.13, 0),
    new THREE.CylinderGeometry(0.045, 0.05, 0.08, 8).translate(0, 0.02, 0),
  ]);
  const hair = new THREE.SphereGeometry(0.11, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.42).rotateX(-0.35).translate(0, 0.14, -0.012);
  const arm = new THREE.CylinderGeometry(0.036, 0.03, 0.6, 7).translate(0, -0.3, 0);
  const leg = new THREE.CylinderGeometry(0.058, 0.045, 0.84, 7).translate(0, -0.42, 0);
  const pot = new THREE.SphereGeometry(0.15, 10, 8).scale(1, 0.85, 1);
  return { body, head, hair, arm, leg, pot };
}

// static props, merged into one coloured geometry (and one glowing one for fires)
function propPieces(craft, add, glow) {
  const mat = (w, d, color) => add(new THREE.BoxGeometry(w, 0.02, d).translate(0, 0.01, 0.55), color);
  switch (craft) {
    case 'beads':
      mat(0.7, 0.45, '#b8a07a');
      for (let i = 0; i < 9; i++) add(new THREE.CylinderGeometry(0.012, 0.012, 0.07, 5).rotateZ(Math.PI / 2).translate(-0.2 + (i % 3) * 0.06, 0.03, 0.45 + Math.floor(i / 3) * 0.05), '#a23b22');
      add(new THREE.BoxGeometry(0.12, 0.08, 0.12).translate(0.15, 0.04, 0.6), '#8a7f72');
      break;
    case 'shell':
      mat(0.7, 0.45, '#b8a07a');
      for (let i = 0; i < 4; i++) add(new THREE.SphereGeometry(0.07, 8, 6).scale(1.4, 0.8, 0.8).translate(-0.22 + i * 0.12, 0.05, 0.62), '#ece4d2');
      for (let i = 0; i < 5; i++) add(new THREE.TorusGeometry(0.035, 0.008, 4, 10).rotateX(Math.PI / 2).translate(0.2, 0.025 + i * 0.012, 0.42), '#f0e9da');
      break;
    case 'potter':
      for (let i = 0; i < 4; i++) {
        add(new THREE.SphereGeometry(0.11, 10, 8).scale(1, 1.15, 1).translate(0.55 + i * 0.26, 0.12, 0.3), '#a9532f');
        add(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 10).translate(0.55 + i * 0.26, 0.16, 0.3), '#2b1d16');
      }
      add(new THREE.CylinderGeometry(0.06, 0.08, 0.14, 8).translate(0, 0.07, 0.55), '#6b5a48');
      break;
    case 'seals':
      mat(0.6, 0.4, '#b8a07a');
      for (let i = 0; i < 6; i++) add(new THREE.BoxGeometry(0.035, 0.012, 0.035).translate(-0.15 + (i % 3) * 0.08, 0.03, 0.5 + Math.floor(i / 3) * 0.08), i % 2 ? '#f1ece0' : '#9a9384');
      break;
    case 'spinning':
      add(new THREE.CylinderGeometry(0.2, 0.16, 0.3, 10, 1, true).translate(0.45, 0.15, 0.25), '#8c6a43');
      for (let i = 0; i < 5; i++) add(new THREE.SphereGeometry(0.09, 7, 6).translate(0.38 + (i % 3) * 0.06, 0.28 + Math.floor(i / 3) * 0.05, 0.2 + (i % 2) * 0.08), '#f4f0e6');
      break;
    case 'metal':
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        add(new THREE.BoxGeometry(0.14, 0.12, 0.07).rotateY(-a).translate(Math.cos(a) * 0.22, 0.06, 0.65 + Math.sin(a) * 0.22), '#9b5a3a');
      }
      add(new THREE.CylinderGeometry(0.18, 0.18, 0.04, 10).translate(0, 0.03, 0.65), '#1d1714');
      glow(new THREE.CylinderGeometry(0.15, 0.15, 0.03, 10).translate(0, 0.055, 0.65), '#ff7a2a');
      glow(new THREE.CylinderGeometry(0.06, 0.045, 0.09, 8).translate(0, 0.11, 0.65), '#ffb24a');
      break;
    case 'grinding':
      add(new THREE.BoxGeometry(0.5, 0.09, 0.3).translate(0, 0.045, 0.55), '#7d766c');
      add(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 8).rotateZ(Math.PI / 2).translate(0, 0.12, 0.55), '#8c857b');
      add(new THREE.CylinderGeometry(0.16, 0.12, 0.2, 10).translate(0.45, 0.1, 0.3), '#8c6a43');
      add(new THREE.CylinderGeometry(0.15, 0.15, 0.02, 10).translate(0.45, 0.2, 0.3), '#d9c48e');
      break;
    default:
  }
}

// ---------- poses ----------
// angles in radians; arms hang down at 0 and point forward at about 1.5
function poseFor(f, t) {
  const p = f.pose;
  const ph = f.phase;
  const s = (k, o = 0) => Math.sin(t * k + ph + o);
  switch (f.activity) {
    case 'beads':
      return { ...p, lean: 0.28, armR: [1.15, 0.35 * s(6.5)], armL: [1.0, -0.4] };
    case 'shell':
      return { ...p, lean: 0.32, armR: [0.95 + 0.22 * s(5), 0.1], armL: [1.05, -0.3] };
    case 'potter':
      return { ...p, lean: 0.38 + 0.03 * s(1.3), armR: [1.15, 0.25 + 0.04 * s(3)], armL: [1.15, -0.25 - 0.04 * s(3)] };
    case 'seals':
      return { ...p, lean: 0.42, head: 0.35, armR: [1.25 + 0.04 * s(11), 0.2], armL: [1.2, -0.25] };
    case 'spinning':
      return { ...p, lean: 0.04, armR: [1.75 + 0.08 * s(4), 0.25], armL: [0.4, -0.1] };
    case 'metal':
      return { ...p, lean: 0.22, armR: [0.85 + 0.3 * s(3), 0.15], armL: [0.6, -0.2] };
    case 'grinding':
      return { ...p, lean: 0.5 + 0.14 * s(2.2), armR: [1.35 - 0.15 * s(2.2), 0.12], armL: [1.35 - 0.15 * s(2.2), -0.12] };
    case 'water':
      return { ...p, lean: 0.12, armR: [1.3 + 0.55 * s(2), 0.1], armL: [1.3 + 0.55 * s(2, Math.PI), -0.1] };
    case 'walk': {
      const w = f.stride;
      return { ...p, lean: 0.03, bob: 0.025 * Math.abs(Math.sin(w)), legSwing: 0.42 * Math.sin(w), armR: f.carry ? [2.9, 0.25] : [-0.32 * Math.sin(w), 0.08], armL: [0.32 * Math.sin(w), -0.08] };
    }
    default:
      return { ...p, lean: 0, armR: [0.1, 0.1], armL: [0.1, -0.1] };
  }
}

const SIT = { hip: 0.22, legFwd: 1.5, legYaw: 1.0, legLen: 0.55 };
const STAND = { hip: 0.86, legFwd: 0, legYaw: 0, legLen: 1 };

export function createLife({ city, groundAt, lowPower }) {
  const rng = createRng(7).next;
  const group = new THREE.Group();
  group.name = 'life';
  const figures = [];
  const stations = [];

  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const distToFirst = (() => {
    const fs = city.streets.find((s) => s.id === 'first-street');
    return (x, z) => {
      if (!fs) return 0;
      const [ax, az] = fs.a;
      const [bx, bz] = fs.b;
      const dx = bx - ax;
      const dz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
      return Math.hypot(x - (ax + t * dx), z - (az + t * dz));
    };
  })();

  function addFigure(f) {
    figures.push({
      skin: new THREE.Color(pick(SKIN)),
      cloth: new THREE.Color(pick(CLOTH)),
      hair: new THREE.Color(rng() < 0.85 ? '#1b1410' : '#2e2119'),
      phase: rng() * 10,
      stride: 0,
      carry: false,
      shown: 1,
      threshold: rng(),
      ...f,
    });
  }

  // ---------- workshops in open yards (and courtyards when yards run out) ----------
  // open yards first (easy to see from the street), nearest First Street first;
  // courtyards only if there are not enough yards
  const byNear = (list) => list.map((s) => ({ ...s, near: distToFirst(s.x, s.z) })).sort((a, b) => a.near - b.near);
  const spots = [...byNear(city.yards.filter((y) => y.w > 4 && y.d > 4)), ...byNear(city.courts.filter((c) => c.w > 3.4 && c.d > 3.4))];
  const perCraft = lowPower ? 3 : 4;
  const used = [];
  let ci = 0;
  for (const s of spots) {
    if (stations.length >= WORKSHOP_CRAFTS.length * perCraft) break;
    if (used.some((u) => Math.hypot(u.x - s.x, u.z - s.z) < 35)) continue; // spread them out
    used.push(s);
    const craft = WORKSHOP_CRAFTS[ci++ % WORKSHOP_CRAFTS.length];
    const yaw = s.yaw + Math.floor(rng() * 4) * (Math.PI / 2);
    const y = groundAt(s.x, s.z);
    stations.push({ craft, x: s.x, z: s.z, y, yaw });
    addFigure({ activity: craft, pose: craft === 'spinning' ? STAND : SIT, x: s.x, y, z: s.z, yaw, kind: 'craft', craft });
    if (craft === 'potter' || craft === 'beads') {
      // a second worker nearby, at the same craft
      const off = new THREE.Vector3(1.3, 0, 0.4).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      addFigure({ activity: craft === 'potter' ? 'grinding' : craft, pose: SIT, x: s.x + off.x, y, z: s.z + off.z, yaw: yaw - 0.5, kind: 'craft', craft });
    }
  }

  // grinding grain in courtyards near First Street
  let ground = 0;
  for (const c of city.courts) {
    if (ground >= (lowPower ? 4 : 7)) break;
    if (c.w < 3.4 || c.d < 3.4 || distToFirst(c.x, c.z) > 120 || used.some((u) => Math.hypot(u.x - c.x, u.z - c.z) < 30)) continue;
    used.push(c);
    const yaw = c.yaw + Math.floor(rng() * 4) * (Math.PI / 2);
    const y = groundAt(c.x, c.z);
    stations.push({ craft: 'grinding', x: c.x, z: c.z, y, yaw });
    addFigure({ activity: 'grinding', pose: SIT, x: c.x, y, z: c.z, yaw, kind: 'craft', craft: 'grinding' });
    ground++;
  }

  // drawing water at house wells
  const wells = (city.wellsForLife || []).filter((w) => distToFirst(w.x, w.z) < 150).slice(0, lowPower ? 4 : 8);
  for (const w of wells) {
    const yaw = rng() * Math.PI * 2;
    const back = new THREE.Vector3(0, 0, -1.25).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const y = groundAt(w.x, w.z);
    stations.push({ craft: 'water', x: w.x + back.x, z: w.z + back.z, y, yaw, noProps: true });
    addFigure({ activity: 'water', pose: STAND, x: w.x + back.x, y, z: w.z + back.z, yaw, kind: 'craft', craft: 'water' });
  }

  // ---------- walkers on the streets ----------
  // walk only where the street is open: outside traced plans, except on First Street,
  // whose middle is kept clear
  const paths = [];
  for (const st of city.streets) {
    const [ax, az] = st.a;
    const [bx, bz] = st.b;
    const len = Math.hypot(bx - ax, bz - az);
    let start = null;
    const isFirst = st.id === 'first-street';
    for (let d = 0; d <= len; d += 2) {
      const x = ax + ((bx - ax) * d) / len;
      const z = az + ((bz - az) * d) / len;
      const open = isFirst || !city.covered.some((c) => x > c.x0 - 3 && x < c.x1 + 3 && z > c.z0 - 3 && z < c.z1 + 3);
      if (open && start === null) start = d;
      if ((!open || d + 2 > len) && start !== null) {
        if (d - start > 30) paths.push({ a: [ax + ((bx - ax) * start) / len, az + ((bz - az) * start) / len], b: [x, z], width: isFirst ? 3.4 : st.width - 2, first: isFirst });
        start = null;
      }
    }
  }
  const pathLen = (p) => Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1]) * (p.first ? 2.5 : 1);
  const total = paths.reduce((s, p) => s + pathLen(p), 0);
  const walkerCount = lowPower ? 80 : 170;
  for (let i = 0; i < walkerCount && paths.length; i++) {
    let r = rng() * total;
    let path = paths[0];
    for (const p of paths) {
      r -= pathLen(p);
      if (r <= 0) {
        path = p;
        break;
      }
    }
    addFigure({
      activity: 'walk',
      pose: STAND,
      kind: 'walker',
      path,
      s: rng(),
      lateral: (rng() - 0.5) * path.width,
      dir: rng() < 0.5 ? 1 : -1,
      speed: 1.05 + rng() * 0.4,
      carry: rng() < 0.25,
      x: 0,
      y: 0,
      z: 0,
      yaw: 0,
    });
  }

  // ---------- meshes ----------
  const geo = partGeometries();
  const n = figures.length;
  const skinMat = new THREE.MeshStandardMaterial({ roughness: 0.8 });
  const clothMat = new THREE.MeshStandardMaterial({ roughness: 0.95 });
  const hairMat = new THREE.MeshStandardMaterial({ roughness: 0.7 });
  const potMat = new THREE.MeshStandardMaterial({ color: '#a9532f', roughness: 0.9 });
  const mats = [skinMat, clothMat, hairMat, potMat];
  const mk = (g, mat, count, shadow = false) => {
    const m = new THREE.InstancedMesh(g, mat, count);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.castShadow = shadow;
    m.receiveShadow = false;
    m.frustumCulled = false;
    m.userData = { kind: 'walker', certainty: 2 };
    group.add(m);
    return m;
  };
  const bodies = mk(geo.body, clothMat, n, true);
  const heads = mk(geo.head, skinMat, n);
  const hairs = mk(geo.hair, hairMat, n);
  const arms = mk(geo.arm, skinMat, n * 2, true);
  const legs = mk(geo.leg, skinMat, n * 2, true);
  const pots = mk(geo.pot, potMat, n);
  figures.forEach((f, i) => {
    bodies.setColorAt(i, f.cloth);
    heads.setColorAt(i, f.skin);
    hairs.setColorAt(i, f.hair);
    arms.setColorAt(i * 2, f.skin);
    arms.setColorAt(i * 2 + 1, f.skin);
    legs.setColorAt(i * 2, f.skin);
    legs.setColorAt(i * 2 + 1, f.skin);
  });

  // props and the invisible boxes that make each workshop clickable
  const propParts = [];
  const glowParts = [];
  const pickMat = new THREE.MeshBasicMaterial({ visible: false });
  const pickables = [bodies];
  const wheels = [];
  for (const st of stations) {
    const place = (g) => g.rotateY(st.yaw).translate(st.x, st.y, st.z);
    const colored = (list) => (g, color) => {
      const c = new THREE.Color(color);
      const count = g.attributes.position.count;
      const col = new Float32Array(count * 3);
      for (let k = 0; k < count; k++) col.set([c.r, c.g, c.b], k * 3);
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      if (g.index) g = g.toNonIndexed();
      g.deleteAttribute('uv');
      list.push(place(g));
    };
    if (!st.noProps) propPieces(st.craft, colored(propParts), colored(glowParts));
    if (st.craft === 'potter') wheels.push(st);
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.8, 2.2), pickMat);
    box.position.set(st.x, st.y + 0.9, st.z);
    box.rotation.y = st.yaw;
    box.userData = { kind: 'craft', craft: st.craft, certainty: 2 };
    group.add(box);
    pickables.push(box);
    st.labelPos = new THREE.Vector3(st.x, st.y + 1.9, st.z);
  }
  const propMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  mats.push(propMat, glowMat);
  if (propParts.length) {
    const props = new THREE.Mesh(mergeGeometries(propParts), propMat);
    props.castShadow = true;
    group.add(props);
  }
  if (glowParts.length) group.add(new THREE.Mesh(mergeGeometries(glowParts), glowMat));
  // potters' wheels turn
  const wheelGeo = mergeGeometries([
    new THREE.CylinderGeometry(0.34, 0.34, 0.06, 16).translate(0, 0.16, 0),
    new THREE.BoxGeometry(0.05, 0.065, 0.3).translate(0, 0.16, 0.15),
  ]);
  const wheelMesh = new THREE.InstancedMesh(wheelGeo, new THREE.MeshStandardMaterial({ color: '#6e5843', roughness: 0.9 }), Math.max(1, wheels.length));
  wheelMesh.count = wheels.length;
  mats.push(wheelMesh.material);
  group.add(wheelMesh);
  const potOnWheel = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 10, 8).scale(1, 1.1, 1), potMat, Math.max(1, wheels.length));
  potOnWheel.count = wheels.length;
  group.add(potOnWheel);

  // ---------- per-frame posing ----------
  const F = new THREE.Matrix4();
  const P = new THREE.Matrix4();
  const B = new THREE.Matrix4();
  const M = new THREE.Matrix4();
  const R = new THREE.Matrix4();
  const T = new THREE.Matrix4();
  const HIDE = new THREE.Matrix4().makeScale(0, 0, 0);
  const tmpV = new THREE.Vector3();

  const Q = new THREE.Matrix4();
  const rotXY = (pitch, yaw) => Q.makeRotationY(yaw).multiply(R.makeRotationX(pitch));

  function placeFigure(i, f, t) {
    const p = poseFor(f, t);
    F.makeRotationY(f.yaw).setPosition(f.x, f.y, f.z);
    // pelvis
    P.copy(F).multiply(T.makeTranslation(0, p.hip + (p.bob || 0), 0));
    // body leans forward from the hips
    B.copy(P).multiply(R.makeRotationX(p.lean || 0));
    bodies.setMatrixAt(i, B);
    M.copy(B).multiply(T.makeTranslation(0, 0.56, 0)).multiply(R.makeRotationX(p.head || 0.05));
    heads.setMatrixAt(i, M);
    hairs.setMatrixAt(i, M);
    // arms: pitch forward (positive), swing sideways (yaw)
    for (const [k, side, a] of [[0, 1, p.armR], [1, -1, p.armL]]) {
      M.copy(B).multiply(T.makeTranslation(-0.17 * side, 0.5, 0)).multiply(rotXY(-a[0], a[1]));
      arms.setMatrixAt(i * 2 + k, M);
    }
    // legs: forward and splayed when sitting, swinging when walking
    for (const [k, side] of [[0, 1], [1, -1]]) {
      const swing = (p.legSwing || 0) * side;
      M.copy(P).multiply(T.makeTranslation(-0.09 * side, 0, 0)).multiply(rotXY(-(p.legFwd + swing), p.legYaw * -side));
      // folded legs (sitting) show only their thighs
      if (p.legLen !== 1) M.multiply(T.makeScale(1, p.legLen, 1));
      legs.setMatrixAt(i * 2 + k, M);
    }
    if (f.carry) {
      M.copy(B).multiply(T.makeTranslation(0, 0.92, 0));
      pots.setMatrixAt(i, M);
    } else {
      pots.setMatrixAt(i, HIDE);
    }
  }

  function hideFigure(i) {
    bodies.setMatrixAt(i, HIDE);
    heads.setMatrixAt(i, HIDE);
    hairs.setMatrixAt(i, HIDE);
    arms.setMatrixAt(i * 2, HIDE);
    arms.setMatrixAt(i * 2 + 1, HIDE);
    legs.setMatrixAt(i * 2, HIDE);
    legs.setMatrixAt(i * 2 + 1, HIDE);
    pots.setMatrixAt(i, HIDE);
  }

  let lastPose = -1;
  return {
    group,
    stations,
    pickables,
    paths,
    // day: 0 night .. 1 full day; rain: 0..1; evidence: 0..1 (the certainty switch)
    update(dt, t, { camera, day, rain, evidence, population = 1 }) {
      const opacity = 1 - evidence;
      group.visible = opacity > 0.02;
      if (!group.visible) return;
      for (const m of mats) {
        m.transparent = opacity < 0.999;
        m.opacity = opacity;
      }
      // how many people are out: most by day, few at night, almost none in the rain
      const outdoors = THREE.MathUtils.clamp(day * 1.2, 0.04, 1) * (1 - 0.95 * rain) * population;
      const working = day > 0.25 && rain < 0.35;
      const far = camera.position.y > 1400;
      // pose about 30 times a second at most
      if (t - lastPose < 1 / 30) return;
      const step = lastPose < 0 ? 0 : t - lastPose;
      lastPose = t;
      figures.forEach((f, i) => {
        if (f.kind === 'walker') {
          const target = f.threshold < outdoors ? 1 : 0;
          f.shown = target;
          const [ax, az] = f.path.a;
          const [bx, bz] = f.path.b;
          const len = Math.hypot(bx - ax, bz - az);
          f.s += (f.dir * f.speed * step) / len;
          if (f.s > 1) {
            f.s = 1;
            f.dir = -1;
          } else if (f.s < 0) {
            f.s = 0;
            f.dir = 1;
          }
          const ux = (bx - ax) / len;
          const uz = (bz - az) / len;
          f.x = ax + (bx - ax) * f.s - uz * f.lateral;
          f.z = az + (bz - az) * f.s + ux * f.lateral;
          f.y = groundAt(f.x, f.z);
          f.yaw = Math.atan2(ux * f.dir, uz * f.dir);
          f.stride += f.speed * step * 4.2;
        } else {
          f.shown = working && f.threshold < population ? 1 : 0;
        }
        if (!f.shown || far || tmpV.set(f.x, f.y, f.z).distanceToSquared(camera.position) > 700 * 700) hideFigure(i);
        else placeFigure(i, f, t);
      });
      wheels.forEach((w, k) => {
        M.makeRotationY(w.yaw).setPosition(w.x, w.y, w.z).multiply(T.makeTranslation(0, 0, 0.55)).multiply(R.makeRotationY(t * 5));
        wheelMesh.setMatrixAt(k, M);
        M.makeRotationY(w.yaw).setPosition(w.x, w.y, w.z).multiply(T.makeTranslation(0, 0.3, 0.55));
        potOnWheel.setMatrixAt(k, M);
      });
      wheelMesh.instanceMatrix.needsUpdate = true;
      potOnWheel.instanceMatrix.needsUpdate = true;
      for (const m of [bodies, heads, hairs, arms, legs, pots]) m.instanceMatrix.needsUpdate = true;
    },
  };
}

export const CRAFT_LABELS = Object.fromEntries(Object.entries(CRAFTS).map(([k, c]) => [k, c.label]));
