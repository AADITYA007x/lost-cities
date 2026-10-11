import * as THREE from 'three';
import { createEarthMaterial } from './materials.js';

// The two mounds are flattened to the plain here; the city's platforms are built as
// separate crisp meshes (see city/). The mound masks still mark where the site is.

const EDGE_FADE = 0.12; // fraction of the area at each edge blended to a flat horizon

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export async function loadTerrainData(base = '/terrain/mohenjo-daro') {
  const [meta, buffer] = await Promise.all([
    fetch(`${base}.json`).then((r) => r.json()),
    fetch(`${base}.bin`).then((r) => r.arrayBuffer()),
  ]);
  const n = meta.grid * meta.grid;
  const heights = new Uint16Array(buffer.slice(0, n * 2));
  const masks = new Uint8Array(buffer, n * 2, n * 3);
  return { meta, heights, masks };
}

function boxBlur(src, grid, radius) {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const w = radius * 2 + 1;
  for (let r = 0; r < grid; r++) {
    for (let c = 0; c < grid; c++) {
      let s = 0;
      for (let k = -radius; k <= radius; k++) {
        const cc = Math.min(grid - 1, Math.max(0, c + k));
        s += src[r * grid + cc];
      }
      tmp[r * grid + c] = s / w;
    }
  }
  for (let r = 0; r < grid; r++) {
    for (let c = 0; c < grid; c++) {
      let s = 0;
      for (let k = -radius; k <= radius; k++) {
        const rr = Math.min(grid - 1, Math.max(0, r + k));
        s += tmp[rr * grid + c];
      }
      out[r * grid + c] = s / w;
    }
  }
  return out;
}

export function buildTerrain({ meta, heights, masks }) {
  const grid = meta.grid;
  const size = meta.sizeMeters;
  const half = size / 2;
  const step = size / (grid - 1);
  const n = grid * grid;

  const citadel = new Float32Array(n);
  const lower = new Float32Array(n);
  const water = new Float32Array(n);
  const plain = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    plain[i] = heights[i] / 100;
    citadel[i] = masks[i * 3] / 255;
    lower[i] = masks[i * 3 + 1] / 255;
    water[i] = masks[i * 3 + 2] / 255;
  }

  // The plain level around the site becomes y = 0.
  let sum = 0;
  let count = 0;
  for (let r = 0; r < grid; r++) {
    for (let c = 0; c < grid; c++) {
      const x = -half + c * step;
      const z = -half + r * step;
      const d = Math.hypot(x, z);
      const i = r * grid + c;
      if (d > 700 && d < 1200 && water[i] < 0.05) {
        sum += plain[i];
        count++;
      }
    }
  }
  const ref = sum / count;
  const waterLevel = meta.waterLevel - ref;
  const edgeLevel = 0;

  const banks = boxBlur(water, grid, 6);

  const y = new Float32Array(n);
  const colors = new Float32Array(n * 3);
  const dry = new THREE.Color('#b39a7c');
  const silt = new THREE.Color('#8d8066');
  const green = new THREE.Color('#878a62');
  const mound = new THREE.Color('#a98c6c');
  const tmp = new THREE.Color();

  for (let r = 0; r < grid; r++) {
    for (let c = 0; c < grid; c++) {
      const i = r * grid + c;
      let h = plain[i] - ref;

      // flatten the plain around the site (the platforms stand on it)
      const onSite = smoothstep(0.05, 0.4, Math.max(citadel[i], lower[i]));
      h = h * (1 - onSite);

      const wm = smoothstep(0.2, 0.8, water[i]);
      h = Math.max(h, waterLevel + 0.4) * (1 - wm) + (waterLevel - 2.5) * wm;

      const ex = Math.min(c, grid - 1 - c) / (grid - 1);
      const ez = Math.min(r, grid - 1 - r) / (grid - 1);
      const edge = smoothstep(0, EDGE_FADE, Math.min(ex, ez));
      h = edgeLevel + (h - edgeLevel) * edge;

      y[i] = h;

      const bank = smoothstep(0.02, 0.35, banks[i]);
      tmp.copy(dry).lerp(green, bank * 0.55).lerp(silt, wm);
      // trodden ground around the city
      tmp.lerp(mound, onSite * 0.35);
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
  }

  const geometry = new THREE.PlaneGeometry(size, size, grid - 1, grid - 1);
  geometry.rotateX(-Math.PI / 2);
  const pos = geometry.attributes.position;
  for (let i = 0; i < n; i++) pos.setY(i, y[i]);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const material = createEarthMaterial({ tone: '#ffffff' });
  material.vertexColors = true;

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  mesh.name = 'terrain';

  function heightAt(x, z) {
    const fc = Math.min(grid - 1.001, Math.max(0, (x + half) / step));
    const fr = Math.min(grid - 1.001, Math.max(0, (z + half) / step));
    const c0 = Math.floor(fc);
    const r0 = Math.floor(fr);
    const tx = fc - c0;
    const tz = fr - r0;
    const a = y[r0 * grid + c0];
    const b = y[r0 * grid + c0 + 1];
    const cc = y[(r0 + 1) * grid + c0];
    const d = y[(r0 + 1) * grid + c0 + 1];
    return (a * (1 - tx) + b * tx) * (1 - tz) + (cc * (1 - tx) + d * tx) * tz;
  }

  function centroid(maskArr, threshold = 0.6) {
    let sx = 0;
    let sz = 0;
    let k = 0;
    for (let r = 0; r < grid; r++) {
      for (let c = 0; c < grid; c++) {
        if (maskArr[r * grid + c] > threshold) {
          sx += -half + c * step;
          sz += -half + r * step;
          k++;
        }
      }
    }
    return k ? new THREE.Vector3(sx / k, 0, sz / k) : new THREE.Vector3();
  }

  // the point of water nearest the site, for a label
  let best = Infinity;
  const riverPoint = new THREE.Vector3();
  for (let r = 0; r < grid; r++) {
    for (let c = 0; c < grid; c++) {
      if (water[r * grid + c] > 0.9) {
        const x = -half + c * step;
        const z = -half + r * step;
        const d = Math.hypot(x, z);
        if (d < best) {
          best = d;
          riverPoint.set(x, waterLevel, z);
        }
      }
    }
  }

  const places = {
    citadel: centroid(citadel),
    lowerTown: centroid(lower),
    river: riverPoint,
  };
  places.citadel.y = heightAt(places.citadel.x, places.citadel.z);
  places.lowerTown.y = heightAt(places.lowerTown.x, places.lowerTown.z);

  return { mesh, heightAt, waterLevel, edgeLevel, size, places };
}

export function createWater({ size, level, sunDirection, haze }) {
  const material = new THREE.ShaderMaterial({
    transparent: false,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uDeep: { value: new THREE.Color('#355a55') },
        uShallow: { value: new THREE.Color('#5d7e6c') },
        uSky: { value: new THREE.Color('#c9b394') },
        uSun: { value: new THREE.Color('#ffe2b8') },
        uSunDir: { value: sunDirection.clone().normalize() },
      },
    ]),
    vertexShader: `
      #include <fog_pars_vertex>
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uSky;
      uniform vec3 uSun;
      uniform vec3 uSunDir;
      varying vec3 vWorld;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }

      void main() {
        // slow current toward the south-west, with fine ripples
        vec2 p = vWorld.xz * 0.04 + vec2(uTime * 0.05, uTime * 0.08);
        vec2 q = vWorld.xz * 0.15 - vec2(uTime * 0.12, uTime * 0.03);
        float n1 = noise(p) - 0.5;
        float n2 = noise(q) - 0.5;
        vec3 nrm = normalize(vec3(n1 * 0.35 + n2 * 0.15, 1.0, n2 * 0.35 + n1 * 0.12));

        vec3 view = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(dot(view, nrm), 0.0), 3.0);
        vec3 col = mix(uDeep, uShallow, 0.35 + n1 * 0.4);
        col = mix(col, uSky, clamp(fres * 0.5 + 0.06, 0.0, 0.7));

        vec3 h = normalize(normalize(uSunDir) + view);
        float spec = pow(max(dot(nrm, h), 0.0), 180.0);
        col += uSun * spec * 1.2;

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size, 1, 1), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = level;
  mesh.name = 'water';
  return mesh;
}

// A wide flat ground beyond the terrain so the horizon has no edge.
export function createHorizonGround(level) {
  const material = createEarthMaterial({ tone: '#b39a7c' });
  const mesh = new THREE.Mesh(new THREE.RingGeometry(3500, 30000, 64, 1), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = level - 0.05;
  mesh.receiveShadow = false;
  return mesh;
}
