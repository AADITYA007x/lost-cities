import * as THREE from 'three';
import { ERA } from '../materials.js';
import { ERAS, ERA_BY_ID } from '../content/eras.js';
import { EXCAVATED_AREAS, boundsOf, pointInPolygon, fromSitePlan } from '../city/layout.js';

// The city through time. Each moment sets a few shared shader values (which pieces
// exist, how much of each building stands) and shows or hides whole objects: roofs,
// people, lamps, the mounds that bury the city, the stupa on top.

const PARAMS = {
  founding: { keep: 0.12, missing: 0, standH: 999, ruinH: 0, roofs: true, ramps: true, rise: 0, holes: 0, stupa: null, people: 0.3, lamps: true, pool: true, drains: true },
  height: { keep: 1, missing: 0, standH: 999, ruinH: 999, roofs: true, ramps: true, rise: 0, holes: 0, stupa: null, people: 1, lamps: true, pool: true, drains: true },
  late: { keep: 0.66, missing: 1, standH: 999, ruinH: 1.0, roofs: true, ramps: true, rise: 0, holes: 0, stupa: null, people: 0.55, lamps: true, pool: true, drains: true },
  buried: { keep: 1, missing: 0, standH: 0.05, ruinH: 0.05, roofs: false, ramps: false, rise: 1, holes: 0, stupa: 'built', people: 0, lamps: false, pool: false, drains: false },
  today: { keep: 1, missing: 0, standH: 1.5, ruinH: 1.5, roofs: false, ramps: false, rise: 1, holes: 1, stupa: 'ruin', people: 0, lamps: false, pool: false, drains: false },
};

// where the stupa stands on Mackay's site plan (the plan was placed using it)
const STUPA = fromSitePlan(340, 462);

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function distToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

// signed distance to a polygon outline: positive inside
function signedDist(x, z, poly) {
  let d = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) d = Math.min(d, distToSegment(x, z, poly[j][0], poly[j][1], poly[i][0], poly[i][1]));
  return pointInPolygon(x, z, poly) ? d : -d;
}

function hash(x, z) {
  const v = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return v - Math.floor(v);
}
function noise(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const u = fx * fx * (3 - 2 * fx);
  const w = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz);
  const b = hash(ix + 1, iz);
  const c = hash(ix, iz + 1);
  const d = hash(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
}

// The mounds that cover the city after it is abandoned: a rounded cap over each
// platform, slumping down over its edges. Today the excavated areas are opened in it.
function buildMound(city) {
  const holes = [
    ...city.covered.map((c) => ({ x0: c.x0 + 2, x1: c.x1 - 2, z0: c.z0 + 2, z1: c.z1 - 2 })),
    ...EXCAVATED_AREAS,
  ];
  const holeDist = (x, z) => {
    let d = Infinity;
    for (const r of holes) {
      const dx = Math.max(r.x0 - x, 0, x - r.x1);
      const dz = Math.max(r.z0 - z, 0, z - r.z1);
      d = Math.min(d, Math.hypot(dx, dz));
    }
    return d;
  };

  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: '#a8906c', roughness: 1 });
  const uniforms = { uRise: { value: 0 } };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uRise;
        attribute float aFloor;
        varying vec3 vMoundPos;`
      )
      .replace(
        '#include <begin_vertex>',
        `vec3 transformed = position;
        transformed.y = mix(aFloor, position.y, uRise);
        vMoundPos = transformed;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vMoundPos;
        float mh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float mn(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mh(i), mh(i + vec2(1, 0)), f.x), mix(mh(i + vec2(0, 1)), mh(i + vec2(1, 1)), f.x), f.y);
        }`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          // dusty earth strewn with broken brick
          vec2 p = vMoundPos.xz;
          vec2 cell = floor(p * 2.5);
          float r = mh(cell);
          float shard = step(0.93, r) * step(length(fract(p * 2.5) - 0.5), 0.28) * (1.0 - smoothstep(0.3, 1.2, length(fwidth(p * 2.5))));
          float big = mn(p * 0.08) * 0.6 + mn(p * 0.3) * 0.4;
          vec3 c = diffuseColor.rgb * (0.88 + 0.2 * big);
          c = mix(c, vec3(0.62, 0.33, 0.21), shard * 0.8);
          diffuseColor.rgb = c;
        }`
      );
  };
  material.customProgramCacheKey = () => 'md-mound-v1';

  const STEP = 3;
  for (const key of ['citadel', 'lowerTown']) {
    const plat = city.rects[key];
    const poly = plat.outline;
    const py = plat.y;
    const b = boundsOf(poly);
    const x0 = b.x0 - 45;
    const z0 = b.z0 - 45;
    const nx = Math.ceil((b.x1 - b.x0 + 90) / STEP);
    const nz = Math.ceil((b.z1 - b.z0 + 90) / STEP);
    // two versions: closed (buried) and opened at the excavations (today)
    for (const opened of [false, true]) {
      const geo = new THREE.PlaneGeometry(nx * STEP, nz * STEP, nx, nz).rotateX(-Math.PI / 2);
      geo.translate(x0 + (nx * STEP) / 2, 0, z0 + (nz * STEP) / 2);
      const pos = geo.attributes.position;
      const floor = new Float32Array(pos.count);
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const d = signedDist(x, z, poly);
        const n = (noise(x * 0.05, z * 0.05) - 0.5) * 1.6 + (noise(x * 0.2, z * 0.2) - 0.5) * 0.5;
        // over the platform: rounded, about 2 to 4 m above its top;
        // beyond it: slumping down to the plain within about 40 m
        let h = d >= 0 ? py + 1.8 + 2.4 * smooth(0, 30, d) + n * 0.6 * smooth(0, 10, d) : (py + 1.8) * smooth(-45, 0, d) + n * 0.4 * smooth(-45, 0, d);
        h = Math.max(h, 0);
        if (opened && d > -2) {
          // the mound falls away to the platform top in each excavated area
          const k = smooth(0, 9, holeDist(x, z));
          h = py - 0.35 + (h - py + 0.35) * k;
        }
        pos.setY(i, h);
        floor[i] = d >= 0 ? py - 0.6 : -0.6;
      }
      geo.computeVertexNormals();
      geo.setAttribute('aFloor', new THREE.BufferAttribute(floor, 1));
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, material);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      mesh.userData = { kind: 'mound', certainty: 1, opened };
      group.add(mesh);
    }
  }
  group.visible = false;
  return { group, uniforms, meshes: group.children };
}

// A simplified stupa of mud brick on the high mound: a square terrace, a drum and a
// dome. Built in the 2nd century CE or so; today a worn ruin.
function buildStupa(groundY) {
  const mud = new THREE.MeshStandardMaterial({ color: '#a88a64', roughness: 1 });
  const burnt = new THREE.MeshStandardMaterial({ color: '#a8673f', roughness: 0.95 });
  const make = (ruined) => {
    const g = new THREE.Group();
    const add = (geo, mat, y) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.y = y;
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData = { kind: 'stupa', certainty: 1 };
      g.add(m);
      return m;
    };
    add(new THREE.BoxGeometry(27, 4, 27), burnt, 2);
    add(new THREE.BoxGeometry(19, 2.2, 19), burnt, 5.1);
    if (ruined) {
      // worn down to a rounded stump
      add(new THREE.CylinderGeometry(6.2, 7.6, 3.2, 24), mud, 7.8);
      add(new THREE.SphereGeometry(6.2, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.35, 1), mud, 9.4);
    } else {
      add(new THREE.CylinderGeometry(7, 7, 3, 28), burnt, 7.7);
      add(new THREE.SphereGeometry(7, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.9, 1), mud, 9.2);
      add(new THREE.BoxGeometry(2.4, 1.4, 2.4), burnt, 16.1);
      add(new THREE.CylinderGeometry(0.15, 0.15, 3, 8), mud, 18);
    }
    g.position.set(STUPA[0], groundY - 0.3, STUPA[1]);
    g.visible = false;
    return g;
  };
  return { built: make(false), ruin: make(true) };
}

export function createEras(app) {
  const { city, stage } = app;
  // the mounds and the stupa are built the first time they are needed
  let mound = null;
  let stupa = null;
  function ensureLater() {
    if (mound) return;
    mound = buildMound(city);
    const cit = city.rects.citadel;
    const stupaGround = cit.y + 1.8 + 2.4 * smooth(0, 30, signedDist(STUPA[0], STUPA[1], cit.outline));
    stupa = buildStupa(stupaGround);
    stage.scene.add(mound.group, stupa.built, stupa.ruin);
    app.info?.addTargets([...mound.meshes, ...stupa.built.children, ...stupa.ruin.children]);
  }

  const byKind = { roofs: [], ramps: [], pool: [], wellsGenerated: [] };
  city.group.traverse((o) => {
    const k = o.userData?.kind;
    if (k === 'roofs') byKind.roofs.push(o);
    if (k === 'ramps') byKind.ramps.push(o);
    if (k === 'pool') byKind.pool.push(o);
    if (k === 'well' && o.userData.certainty !== 0) byKind.wellsGenerated.push(o);
  });

  let current = 'height';
  // the shader values move smoothly from one moment to the next
  const live = { keep: 1, standH: 999, ruinH: 999, rise: 0, holes: 0 };
  let target = PARAMS.height;

  function setUniforms(p, bit) {
    ERA.uEraBit.value = bit;
    ERA.uKeep.value = p.keep;
    ERA.uMissing.value = p.missing;
    ERA.uStandH.value = p.standH;
    ERA.uRuinH.value = p.ruinH;
    if (mound) mound.uniforms.uRise.value = p.rise;
  }

  // objects whose visibility depends on the moment; other modules set their
  // "natural" visibility each frame, and a moment can only hide them
  const toggles = () => [
    ...byKind.roofs.map((o) => [o, 'roofs']),
    ...byKind.ramps.map((o) => [o, 'ramps']),
    ...byKind.pool.map((o) => [o, 'pool']),
    ...byKind.wellsGenerated.map((o) => [o, 'wells']),
    ...(app.life ? [[app.life.group, 'people']] : []),
    ...(app.lampsMesh?.() ? [[app.lampsMesh(), 'lamps']] : []),
    ...(app.drainsMesh ? [[app.drainsMesh, 'drains']] : []),
  ];
  const allowed = (p, what) => {
    if (what === 'wells') return p.keep >= 0.5 && p.rise < 0.5;
    if (what === 'people') return p.people > 0;
    return Boolean(p[what]);
  };
  let natural = null;

  function show(id, p) {
    if (p.rise > 0.001) ensureLater();
    if (mound) {
      mound.group.visible = p.rise > 0.001;
      for (const m of mound.meshes) m.visible = m.userData.opened === p.holes > 0.5;
      stupa.built.visible = p.stupa === 'built';
      stupa.ruin.visible = p.stupa === 'ruin';
    }
    for (const [o, what] of toggles()) {
      const nat = natural?.get(o) ?? o.visible;
      o.visible = nat && allowed(p, what);
    }
  }

  return {
    get current() {
      return current;
    },
    get live() {
      return { ...live, era: ERA.uEraBit.value, standH: ERA.uStandH.value };
    },
    get population() {
      return PARAMS[current].people;
    },
    set(id, { instant = false } = {}) {
      if (!PARAMS[id]) return;
      current = id;
      target = PARAMS[id];
      if (instant) Object.assign(live, { keep: target.keep, standH: target.standH, ruinH: target.ruinH, rise: target.rise, holes: target.holes });
    },
    update(dt) {
      // ease towards the chosen moment over about a second and a half
      const k = Math.min(1, dt * 2.2);
      const toward = (a, b) => (Math.abs(b - a) < 0.002 ? b : a + (b - a) * k);
      // heights move on a log scale, so a city sinking into a mound looks even
      const logToward = (a, b) => Math.exp(toward(Math.log(Math.min(a, 60) + 0.1), Math.log(Math.min(b, 60) + 0.1))) - 0.1;
      live.keep = toward(live.keep, target.keep);
      live.standH = target.standH > 100 && live.standH > 59 ? 999 : logToward(live.standH, target.standH);
      live.ruinH = target.ruinH > 100 && live.ruinH > 59 ? 999 : logToward(live.ruinH, target.ruinH);
      live.rise = toward(live.rise, target.rise);
      live.holes = toward(live.holes, target.holes);
    },
    // before rendering: remember what other modules want visible this frame
    beginFrame() {
      natural = new Map(toggles().map(([o]) => [o, o.visible]));
    },
    // set up the scene for one moment (the current one, or another in the split view)
    apply(id = current) {
      const p = id === current ? { ...target, ...live } : PARAMS[id];
      setUniforms(p, ERA_BY_ID[id].bit);
      show(id, p);
    },
    endFrame() {
      if (natural) for (const [o, v] of natural) o.visible = v;
      natural = null;
    },
    // is this ray hit on something that exists in the current moment?
    visibleHit(hit) {
      const p = { ...target, ...live };
      const ud = hit.object.userData || {};
      if (ud.kind === 'mound' || ud.kind === 'stupa') return hit.object.visible && hit.object.parent?.visible !== false;
      if (p.rise > 0.5 && hit.object.userData?.kind === 'platform') return false;
      const tag = hit.object.geometry?.attributes?.aTag;
      if (!tag || !hit.face) return true;
      const i = hit.face.a;
      const era = tag.getX(i);
      if (era < 0.5) return true;
      if (Math.floor(era / ERA_BY_ID[current].bit + 0.001) % 2 === 0) return false;
      const standing = tag.getY(i) <= p.keep;
      if (!standing && p.missing < 0.5) return false;
      return hit.point.y - tag.getZ(i) <= (standing ? p.standH : p.ruinH);
    },
    ERAS,
  };
}
