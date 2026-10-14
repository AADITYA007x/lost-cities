import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createRng, GRID, pointInPolygon } from './city/layout.js';

// The busy city seen from above: smoke from kilns and cooking fires, birds over the
// roofs, ox carts in the streets, cloth and grain spread on roofs, and fields and trees
// on the plain. All of it is imagined, drawn from what is known of life in the city:
// kilns and hearths are found, terracotta models of carts and of humped cattle are
// common, cotton cloth survives as traces, and wheat, barley and cotton were grown.
// Where any of these were, and how many, is a guess.

const WIND = new THREE.Vector3(0.9, 0, 0.35).normalize();

// crop colours through the year: [winter crops (wheat, barley), summer crops (cotton,
// sesame), fallow]. Winter crops are sown after the flood and harvested in spring;
// summer crops grow through the monsoon.
const CROP_COLOURS = {
  cool: ['#738a42', '#a68d63', '#a98a5f'],
  hot: ['#cba85b', '#a6875d', '#ad8c60'],
  monsoon: ['#8c7a55', '#5f843f', '#8b8b55'],
  after: ['#8f9a52', '#c3bea0', '#a58a5e'],
};

export function createBustle({ city, world, life, lowPower }) {
  const group = new THREE.Group();
  group.name = 'bustle';
  const rng = createRng(31).next;
  const { heightAt, waterLevel } = world.terrain;
  const outlines = [city.rects.lowerTown.outline, city.rects.citadel.outline];
  const onCity = (x, z, m = 0) =>
    outlines.some((o) => [[0, 0], [m, 0], [-m, 0], [0, m], [0, -m], [m, m], [-m, -m], [m, -m], [-m, m]].some(([dx, dz]) => pointInPolygon(x + dx, z + dz, o)));
  const pickables = [];

  // ---------- smoke ----------
  // kilns (potters, metal workers) smoke all day; cooking fires in some courtyards in
  // the morning and evening
  const sources = [];
  for (const st of life.stations) {
    if (st.craft === 'potter' || st.craft === 'metal') sources.push({ x: st.x + 1.2, y: st.y + 0.6, z: st.z + 0.8, kind: 'kiln', strength: 1 });
  }
  const courts = [...city.courts];
  for (let i = courts.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [courts[i], courts[j]] = [courts[j], courts[i]];
  }
  for (const c of courts.slice(0, lowPower ? 18 : 40)) sources.push({ x: c.x, y: world.groundAt(c.x, c.z) + 0.4, z: c.z, kind: 'hearth', strength: 0.5 + rng() * 0.4 });
  const PER = lowPower ? 9 : 14;
  const nSmoke = sources.length * PER;
  const sPos = new Float32Array(nSmoke * 3);
  const sAge = new Float32Array(nSmoke);
  const sSize = new Float32Array(nSmoke);
  const sState = [];
  for (let i = 0; i < nSmoke; i++) {
    const src = sources[Math.floor(i / PER)];
    sState.push({ src, age: rng(), life: 8 + rng() * 6, jx: (rng() - 0.5) * 1.2, jz: (rng() - 0.5) * 1.2, on: rng() < (src.kind === 'kiln' ? 0.9 : 0.5) });
  }
  const smokeGeo = new THREE.BufferGeometry();
  smokeGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3).setUsage(THREE.DynamicDrawUsage));
  smokeGeo.setAttribute('aAge', new THREE.BufferAttribute(sAge, 1).setUsage(THREE.DynamicDrawUsage));
  smokeGeo.setAttribute('aSize', new THREE.BufferAttribute(sSize, 1).setUsage(THREE.DynamicDrawUsage));
  const smokeMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uScale: { value: 500 },
      uLight: { value: new THREE.Color('#cfc2b0') },
      uFade: { value: 1 },
      uFog: { value: 0.00016 },
    },
    vertexShader: `
      attribute float aAge;
      attribute float aSize;
      uniform float uScale;
      uniform float uFog;
      varying float vAge;
      varying float vFog;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float dist = -mv.z;
        gl_PointSize = clamp(aSize * uScale / dist, 0.0, 260.0);
        gl_Position = projectionMatrix * mv;
        vAge = aAge;
        float f = uFog * dist;
        vFog = exp(-f * f);
      }`,
    fragmentShader: `
      uniform vec3 uLight;
      uniform float uFade;
      varying float vAge;
      varying float vFog;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        if (r > 1.0 || vAge <= 0.0) discard;
        float soft = exp(-r * r * 3.0);
        // thin as it rises: fade in quickly, out slowly
        float life = smoothstep(0.0, 0.12, vAge) * (1.0 - smoothstep(0.35, 1.0, vAge));
        float a = soft * life * 0.5 * uFade * vFog;
        gl_FragColor = vec4(uLight, a);
      }`,
  });
  const smoke = new THREE.Points(smokeGeo, smokeMat);
  smoke.frustumCulled = false;
  smoke.renderOrder = 4;
  group.add(smoke);

  // ---------- birds ----------
  // a few flocks wheeling over the city by day (kites, crows and egrets live along the
  // river today; which birds and how many is imagined)
  const flocks = [];
  const nFlocks = lowPower ? 2 : 4;
  for (let f = 0; f < nFlocks; f++) {
    const cx = world.siteCenter.x + (rng() - 0.5) * 500;
    const cz = world.siteCenter.z + (rng() - 0.5) * 400;
    const birds = [];
    const n = 8 + Math.floor(rng() * 8);
    for (let b = 0; b < n; b++) birds.push({ a: rng() * Math.PI * 2, r: 25 + rng() * 60, h: 30 + rng() * 45, speed: 0.12 + rng() * 0.08, flap: rng() * 10, bob: rng() * 6 });
    flocks.push({ cx, cz, birds, drift: rng() * 6 });
  }
  const nBirds = flocks.reduce((s, f) => s + f.birds.length, 0);
  const wing = new THREE.BufferGeometry();
  // one wing: a thin triangle from the body (origin) out to the side (+x), 0.8 m long
  wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.18, 0.8, 0, -0.05, 0, 0, -0.2], 3));
  wing.computeVertexNormals();
  const birdMat = new THREE.MeshBasicMaterial({ color: '#2b2420', side: THREE.DoubleSide, fog: true });
  const wings = new THREE.InstancedMesh(wing, birdMat, nBirds * 2);
  wings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  wings.frustumCulled = false;
  group.add(wings);

  // ---------- ox carts ----------
  const cartParts = [];
  const tint = (g, color) => {
    const c = new THREE.Color(color);
    g = g.index ? g.toNonIndexed() : g;
    g.deleteAttribute('uv');
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    cartParts.push(g);
  };
  // the ox (a humped zebu, as on the seals and figurines), facing +z
  tint(new THREE.BoxGeometry(0.62, 0.62, 1.55).translate(0, 1.0, 1.9), '#d3cabb');
  tint(new THREE.SphereGeometry(0.22, 8, 6).scale(1, 1.2, 1.1).translate(0, 1.38, 2.35), '#c4b9a8');
  tint(new THREE.BoxGeometry(0.32, 0.36, 0.5).rotateX(0.5).translate(0, 1.15, 2.85), '#cfc6b6');
  tint(new THREE.CylinderGeometry(0.03, 0.04, 0.32, 5).rotateZ(0.6).translate(0.16, 1.42, 2.8), '#3a302a');
  tint(new THREE.CylinderGeometry(0.03, 0.04, 0.32, 5).rotateZ(-0.6).translate(-0.16, 1.42, 2.8), '#3a302a');
  for (const [lx, lz] of [[0.2, 1.35], [-0.2, 1.35], [0.2, 2.45], [-0.2, 2.45]]) tint(new THREE.BoxGeometry(0.13, 0.75, 0.13).translate(lx, 0.37, lz), '#bdb3a3');
  // the cart: bed, solid wheels (as on terracotta cart models), a load of sacks
  tint(new THREE.BoxGeometry(1.25, 0.1, 1.7).translate(0, 0.8, 0), '#7a5a3c');
  tint(new THREE.BoxGeometry(0.08, 0.08, 1.6).translate(0.25, 0.85, 1.4), '#6b4f35');
  tint(new THREE.BoxGeometry(0.08, 0.08, 1.6).translate(-0.25, 0.85, 1.4), '#6b4f35');
  for (const s of [-1, 1]) tint(new THREE.CylinderGeometry(0.55, 0.55, 0.12, 14).rotateZ(Math.PI / 2).translate(0.72 * s, 0.55, 0), '#5e4630');
  tint(new THREE.SphereGeometry(0.34, 8, 6).scale(1, 0.75, 1.2).translate(0.25, 1.1, -0.3), '#d8cbb0');
  tint(new THREE.SphereGeometry(0.32, 8, 6).scale(1, 0.75, 1.2).translate(-0.25, 1.08, 0.25), '#c9b48c');
  tint(new THREE.SphereGeometry(0.28, 8, 6).scale(1, 0.8, 1.1).translate(0.05, 1.42, 0), '#e2d7bf');
  const cartGeo = mergeGeometries(cartParts);
  const cartMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  const paths = life.paths || [];
  const nCarts = paths.length ? (lowPower ? 5 : 10) : 0;
  const carts = [];
  for (let i = 0; i < nCarts; i++) {
    const path = paths[Math.floor(rng() * paths.length)];
    carts.push({ path, s: rng(), dir: rng() < 0.5 ? 1 : -1, speed: 0.75 + rng() * 0.25, lateral: (rng() < 0.5 ? -1 : 1) * Math.min(1.2, path.width * 0.3), threshold: rng() });
  }
  const cartMesh = new THREE.InstancedMesh(cartGeo, cartMat, Math.max(1, nCarts));
  cartMesh.count = nCarts;
  cartMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  cartMesh.castShadow = true;
  cartMesh.frustumCulled = false;
  cartMesh.userData = { kind: 'cart', certainty: 2 };
  group.add(cartMesh);
  pickables.push(cartMesh);

  // ---------- cloth and grain on the roofs ----------
  const spots = city.roofSpots.slice(0, lowPower ? 70 : 160);
  const clothParts = [];
  const CLOTHS = ['#efe7d6', '#e6dcc4', '#a8432c', '#b5533a', '#c4913f', '#d8c9a5', '#efe7d6', '#cdb48a'];
  for (const s of spots) {
    const grain = rng() < 0.3;
    const w = grain ? Math.min(3, s.w * 0.6) : 1.2 + rng() * 1.4;
    const d = grain ? Math.min(2.2, s.d * 0.6) : 0.8 + rng() * 0.6;
    const g = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).rotateY((s.yaw ?? GRID.angle) + (rng() < 0.3 ? 0.4 : 0)).translate(s.x + (rng() - 0.5) * 0.8, s.y + 0.04, s.z + (rng() - 0.5) * 0.8);
    const c = new THREE.Color(grain ? (rng() < 0.5 ? '#d9b866' : '#c9a75e') : CLOTHS[Math.floor(rng() * CLOTHS.length)]);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.deleteAttribute('uv');
    clothParts.push(g.index ? g.toNonIndexed() : g);
  }
  let roofCloth = null;
  if (clothParts.length) {
    roofCloth = new THREE.Mesh(mergeGeometries(clothParts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }));
    roofCloth.receiveShadow = true;
    group.add(roofCloth);
  }

  // ---------- fields and trees on the plain ----------
  const fieldGroup = new THREE.Group();
  group.add(fieldGroup);
  const fieldParts = [];
  const fieldCrops = [];
  const [ux, uz] = GRID.u;
  const [vx, vz] = GRID.v;
  const FW = 44;
  const FD = 28;
  const reach = lowPower ? 1100 : 1500;
  const dry = (x, z) => heightAt(x, z) > waterLevel + 0.4;
  for (let a = -reach; a < reach; a += FW) {
    for (let b = -reach; b < reach; b += FD) {
      const cx = world.siteCenter.x + ux * a + vx * b;
      const cz = world.siteCenter.z + uz * a + vz * b;
      const dist = Math.hypot(a, b);
      if (dist > reach || rng() < dist / reach - 0.35) continue;
      if (onCity(cx, cz, 70) || !dry(cx, cz)) continue;
      if (rng() < 0.12) continue; // grazing land and paths
      const crop = rng() < 0.55 ? 0 : rng() < 0.6 ? 1 : 2;
      // a field: 2 x 2 quads following the ground, with a bund (the gap) around it
      const w = FW - 3;
      const d = FD - 3;
      const pos = [];
      const idx = [];
      for (let j = 0; j <= 2; j++) {
        for (let i = 0; i <= 2; i++) {
          const pa = (i / 2 - 0.5) * w;
          const pb = (j / 2 - 0.5) * d;
          const x = cx + ux * pa + vx * pb;
          const z = cz + uz * pa + vz * pb;
          pos.push(x, heightAt(x, z) + 0.15, z);
        }
      }
      for (let j = 0; j < 2; j++) {
        for (let i = 0; i < 2; i++) {
          const k = j * 3 + i;
          idx.push(k, k + 3, k + 1, k + 1, k + 3, k + 4);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      fieldParts.push(g.toNonIndexed());
      fieldCrops.push({ crop, shade: 0.82 + rng() * 0.32 });
    }
  }
  let fields = null;
  if (fieldParts.length) {
    const geo = mergeGeometries(fieldParts);
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3));
    fields = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
    fields.receiveShadow = true;
    fields.userData = { kind: 'fields', certainty: 2 };
    fieldGroup.add(fields);
    pickables.push(fields);
  }
  const VERTS_PER_FIELD = 24; // 4 quads x 2 triangles x 3 vertices
  let season = null;
  function setSeason(s) {
    if (!fields || s === season) return;
    season = s;
    // softened toward the colour of the plain, so the fields sit in the landscape
    const soil = new THREE.Color('#a98a62');
    const cols = (CROP_COLOURS[s] || CROP_COLOURS.cool).map((h) => new THREE.Color(h).lerp(soil, 0.3));
    const attr = fields.geometry.attributes.color;
    const c = new THREE.Color();
    fieldCrops.forEach((f, k) => {
      c.copy(cols[f.crop]).multiplyScalar(f.shade);
      for (let i = 0; i < VERTS_PER_FIELD; i++) attr.setXYZ(k * VERTS_PER_FIELD + i, c.r, c.g, c.b);
    });
    attr.needsUpdate = true;
  }

  // trees along field edges and near the river (which trees is not known)
  const trunk = new THREE.CylinderGeometry(0.25, 0.35, 4, 6).translate(0, 2, 0);
  const crown = new THREE.IcosahedronGeometry(3.2, 1).scale(1.15, 0.8, 1.15).translate(0, 5.6, 0);
  const nTrees = lowPower ? 140 : 320;
  const trees = [];
  for (let k = 0; trees.length < nTrees && k < nTrees * 30; k++) {
    const a = (rng() - 0.5) * 2 * reach;
    const b = (rng() - 0.5) * 2 * reach;
    const x = world.siteCenter.x + ux * a + vx * b;
    const z = world.siteCenter.z + uz * a + vz * b;
    if (onCity(x, z, 45)) continue;
    const h = heightAt(x, z);
    if (h < waterLevel + 0.6) continue;
    // more trees near the river and along the bunds
    const nearRiver = h < waterLevel + 3;
    if (!nearRiver && rng() < 0.55) continue;
    trees.push({ x, z, y: h, s: 1.0 + rng() * 0.9, r: rng() * Math.PI });
  }
  const trunks = new THREE.InstancedMesh(trunk, new THREE.MeshStandardMaterial({ color: '#5a4636', roughness: 1 }), Math.max(1, trees.length));
  const crowns = new THREE.InstancedMesh(crown, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true }), Math.max(1, trees.length));
  const M = new THREE.Matrix4();
  const tc = new THREE.Color();
  trees.forEach((t, i) => {
    M.makeRotationY(t.r).scale(new THREE.Vector3(t.s, t.s, t.s)).setPosition(t.x, t.y, t.z);
    trunks.setMatrixAt(i, M);
    crowns.setMatrixAt(i, M);
    crowns.setColorAt(i, tc.set('#76844a').offsetHSL((rng() - 0.5) * 0.04, (rng() - 0.5) * 0.1, (rng() - 0.5) * 0.08));
  });
  trunks.count = crowns.count = trees.length;
  crowns.castShadow = true;
  trunks.userData = crowns.userData = { kind: 'trees', certainty: 2 };
  fieldGroup.add(trunks, crowns);

  // ---------- per frame ----------
  const T = new THREE.Matrix4();
  const R = new THREE.Matrix4();
  const S = new THREE.Matrix4();
  const HIDE = new THREE.Matrix4().makeScale(0, 0, 0);
  const tmp = new THREE.Vector3();

  return {
    group,
    pickables,
    setSeason,
    // where the cart nearest a point is now (for the guide), or null
    nearestCart(x, z) {
      let best = null;
      for (const c of carts) {
        if (!c.at) continue;
        const d = Math.hypot(c.at[0] - x, c.at[2] - z);
        if (!best || d < best.d) best = { d, x: c.at[0], y: c.at[1], z: c.at[2], yaw: c.at[3] };
      }
      return best;
    },
    // day 0..1, rain 0..1, population 0..1 (the moment in time), evidence 0..1
    update(dt, t, { camera, day, rain, population, evidence, scale, hour }) {
      const shown = evidence < 0.5;
      group.visible = shown;
      if (!shown) return;
      // the plain has its own lighting; keep the fields and trees as dark as it at night
      const dim = 0.3 + 0.7 * day;
      if (fields) fields.material.color.setScalar(dim);
      trunks.material.color.set('#5a4636').multiplyScalar(dim);
      crowns.material.color.setScalar(dim);
      const living = population > 0;
      // the living city's things (not the fields and trees, which stay with the plain)
      smoke.visible = wings.visible = cartMesh.visible = living;
      if (roofCloth) roofCloth.visible = living && rain < 0.5;
      const fade = 1 - evidence;

      // smoke: kilns by day; cooking fires mostly morning and evening
      if (living) {
        smokeMat.uniforms.uScale.value = scale;
        smokeMat.uniforms.uFade.value = fade * (1 - 0.85 * rain);
        smokeMat.uniforms.uLight.value.setRGB(0.25 + 0.6 * day, 0.24 + 0.55 * day, 0.23 + 0.5 * day);
        const cook = Math.max(Math.exp(-(((hour - 7.5) / 1.6) ** 2)), Math.exp(-(((hour - 18.8) / 1.5) ** 2)));
        for (let i = 0; i < nSmoke; i++) {
          const p = sState[i];
          const src = p.src;
          const want = (src.kind === 'kiln' ? (day > 0.2 ? 1 : 0.2) : 0.12 + cook) * src.strength * population;
          p.age += dt / p.life;
          if (p.age >= 1) {
            p.age = 0;
            p.on = rng() < want;
          }
          const k = i * 3;
          if (!p.on || rain > 0.6) {
            sAge[i] = 0;
            continue;
          }
          const a = p.age;
          // rise, slow down, spread and lean with the wind
          const up = 22 * (1 - Math.exp(-a * 2.2)) * (src.kind === 'kiln' ? 1.25 : 1);
          sPos[k] = src.x + p.jx * (1 + a * 3) + WIND.x * a * 18;
          sPos[k + 1] = src.y + up;
          sPos[k + 2] = src.z + p.jz * (1 + a * 3) + WIND.z * a * 18;
          sAge[i] = a;
          sSize[i] = (2 + a * 14) * (src.kind === 'kiln' ? 1.25 : 0.9);
        }
        smokeGeo.attributes.position.needsUpdate = true;
        smokeGeo.attributes.aAge.needsUpdate = true;
        smokeGeo.attributes.aSize.needsUpdate = true;
      }

      // birds: only by day and not in heavy rain
      const birdsOut = living && day > 0.3 && rain < 0.5;
      wings.visible = birdsOut;
      if (birdsOut) {
        let n = 0;
        for (const f of flocks) {
          const fx = f.cx + Math.sin(t * 0.02 + f.drift) * 60;
          const fz = f.cz + Math.cos(t * 0.017 + f.drift) * 60;
          for (const b of f.birds) {
            const ang = b.a + t * b.speed;
            const x = fx + Math.cos(ang) * b.r;
            const z = fz + Math.sin(ang) * b.r;
            const y = world.groundAt(fx, fz) + b.h + Math.sin(t * 0.5 + b.bob) * 3;
            // heading along the circle; flap now and then, glide otherwise
            const yaw = -ang;
            const flapping = Math.sin(t * 0.7 + b.flap) > 0.2;
            const flap = flapping ? Math.sin(t * 9 + b.flap) * 0.5 : 0.08;
            for (const side of [1, -1]) {
              M.makeTranslation(x, y, z)
                .multiply(R.makeRotationY(yaw))
                .multiply(S.makeScale(side * 2.2, 2.2, 2.2))
                .multiply(T.makeRotationZ(flap));
              wings.setMatrixAt(n++, M);
            }
          }
        }
        wings.instanceMatrix.needsUpdate = true;
      }

      // carts: out by day, not in the rain
      if (living && nCarts) {
        const out = THREE.MathUtils.clamp(day * 1.3, 0, 1) * (1 - rain) * population;
        const far = camera.position.y > 1400;
        carts.forEach((c, i) => {
          const len = Math.hypot(c.path.b[0] - c.path.a[0], c.path.b[1] - c.path.a[1]);
          c.s += (c.dir * c.speed * dt) / len;
          if (c.s > 1) {
            c.s = 1;
            c.dir = -1;
          } else if (c.s < 0) {
            c.s = 0;
            c.dir = 1;
          }
          const ux2 = (c.path.b[0] - c.path.a[0]) / len;
          const uz2 = (c.path.b[1] - c.path.a[1]) / len;
          // keep to one side of the street, by the way it is going
          const side = c.lateral * c.dir;
          const x = c.path.a[0] + (c.path.b[0] - c.path.a[0]) * c.s - uz2 * side;
          const z = c.path.a[1] + (c.path.b[1] - c.path.a[1]) * c.s + ux2 * side;
          const y = world.groundAt(x, z);
          c.at = [x, y, z, Math.atan2(ux2 * c.dir, uz2 * c.dir)];
          if (c.threshold > out || far || tmp.set(x, y, z).distanceToSquared(camera.position) > 900 * 900) {
            cartMesh.setMatrixAt(i, HIDE);
            return;
          }
          const yaw = Math.atan2(ux2 * c.dir, uz2 * c.dir);
          c.at = [x, y, z, yaw];
          M.makeRotationY(yaw).setPosition(x, y + Math.abs(Math.sin(t * 3 + i)) * 0.03, z);
          cartMesh.setMatrixAt(i, M);
        });
        cartMesh.instanceMatrix.needsUpdate = true;
      }
    },
  };
}
