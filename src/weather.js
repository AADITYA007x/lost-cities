import * as THREE from 'three';
import { WET } from './materials.js';

// Monsoon rain: falling streaks around the viewer, streets and walls that get wet,
// water running along the street drains, and the river rising in the flood season.

const RAIN_BOX = 70; // metres of rain kept around the camera

function createRain(count) {
  const seeds = new Float32Array(count * 2 * 3);
  const ends = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const sx = Math.random();
    const sy = Math.random();
    const sz = Math.random();
    for (let k = 0; k < 2; k++) {
      const j = i * 2 + k;
      seeds[j * 3] = sx;
      seeds[j * 3 + 1] = sy;
      seeds[j * 3 + 2] = sz;
      ends[j] = k;
    }
  }
  const geometry = new THREE.BufferGeometry();
  // positions are computed in the shader; this attribute only sets the vertex count
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 2 * 3), 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
  geometry.setAttribute('aEnd', new THREE.BufferAttribute(ends, 1));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uCam: { value: new THREE.Vector3() },
      uAmount: { value: 0 },
      uBox: { value: RAIN_BOX },
      uWind: { value: new THREE.Vector2(0.18, 0.08) },
      uColor: { value: new THREE.Color('#c9d0d6') },
    },
    vertexShader: `
      attribute vec3 aSeed;
      attribute float aEnd;
      uniform float uTime;
      uniform vec3 uCam;
      uniform float uBox;
      uniform vec2 uWind;
      varying float vAlpha;
      void main() {
        float speed = 8.5 + aSeed.x * 3.0;
        vec3 dir = normalize(vec3(uWind.x, -1.0, uWind.y));
        vec3 p = aSeed * uBox + dir * (uTime * speed);
        // keep every drop inside a box that travels with the camera
        p = mod(p - uCam + 0.5 * uBox, uBox) - 0.5 * uBox + uCam;
        p -= dir * aEnd * (0.35 + aSeed.y * 0.3);
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float d = length(p - uCam);
        vAlpha = smoothstep(0.6, 2.0, d) * (1.0 - smoothstep(0.25 * uBox, 0.5 * uBox, d));
        vAlpha *= mix(0.35, 1.0, aEnd);
      }`,
    fragmentShader: `
      uniform float uAmount;
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        gl_FragColor = vec4(uColor, vAlpha * 0.42 * uAmount);
      }`,
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.frustumCulled = false;
  lines.renderOrder = 6;
  lines.visible = false;
  return lines;
}

// thin ribbons of moving water along each drain line
function createDrainWater(drains, riverPoint) {
  const pos = [];
  const uv = [];
  const idx = [];
  const W = 0.36;
  for (const d of drains) {
    // which way the water runs is not known for most drains: here it runs toward
    // the end of the street nearer the river
    let [a, b] = [d.a, d.b];
    if (Math.hypot(a[0] - riverPoint.x, a[1] - riverPoint.z) < Math.hypot(b[0] - riverPoint.x, b[1] - riverPoint.z)) [a, b] = [b, a];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const nx = (-(b[1] - a[1]) / len) * (W / 2);
    const nz = ((b[0] - a[0]) / len) * (W / 2);
    const y = d.y + 0.03;
    const base = pos.length / 3;
    pos.push(a[0] + nx, y, a[1] + nz, a[0] - nx, y, a[1] - nz, b[0] + nx, y, b[1] + nz, b[0] - nx, y, b[1] - nz);
    uv.push(0, 0, 0, 1, len, 0, len, 1);
    idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(idx);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uWater: { value: 0 },
        uColor: { value: new THREE.Color('#7b7765') },
        uLight: { value: 1 },
      },
    ]),
    vertexShader: `
      #include <fog_pars_vertex>
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform float uWater;
      uniform vec3 uColor;
      uniform float uLight;
      varying vec2 vUv;
      void main() {
        float across = 1.0 - pow(abs(vUv.y - 0.5) * 2.0, 2.0);
        // ripples carried downstream at about a metre a second
        float flow = 0.5 + 0.5 * sin(vUv.x * 2.3 - uTime * 2.4) * sin(vUv.x * 0.7 + vUv.y * 3.0 - uTime * 1.1);
        vec3 c = uColor * uLight * (0.8 + 0.3 * flow);
        float a = uWater * across * (0.5 + 0.3 * flow);
        gl_FragColor = vec4(c, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 4;
  mesh.visible = false;
  return mesh;
}

export function createWeather({ scene, camera, city, water, riverPoint, lowPower }) {
  const drops = createRain(lowPower ? 4500 : 9000);
  scene.add(drops);
  const drainWater = createDrainWater(city.drains, riverPoint);
  scene.add(drainWater);
  const riverBase = water.position.y;
  // the flood brings silt: the river turns from green to brown
  const wu = water.material.uniforms;
  const clear = { deep: wu.uDeep.value.clone(), shallow: wu.uShallow.value.clone() };
  const silty = { deep: new THREE.Color('#5a4f3c'), shallow: new THREE.Color('#7f6d52') };
  let wet = 0;
  let inDrains = 0;
  let flood = 0;

  return {
    // jump straight to the settled state (when the page opens in the rain)
    settle({ rain, monsoon }) {
      wet = rain > 0.05 ? 1 : 0;
      inDrains = Math.min(1, rain * 1.2);
      flood = monsoon ? 1 : 0;
    },
    // rain: 0..1 how hard it rains now; monsoon: whether it is the flood season;
    // light: rough brightness of the scene (0 night .. 1 day)
    update(dt, t, { rain, monsoon, light }) {
      // the city soaks within half a minute of rain, and dries over a couple of minutes
      wet += ((rain > 0.05 ? 1 : 0) - wet) * Math.min(1, dt * (rain > 0.05 ? 0.12 : 0.02));
      // water in the drains follows the rain, with a lag
      inDrains += (Math.min(1, rain * 1.2) - inDrains) * Math.min(1, dt * 0.08);
      // the river stands higher through the flood season
      flood += ((monsoon ? 1 : 0) - flood) * Math.min(1, dt * 0.3);

      WET.value = wet;
      drops.visible = rain > 0.01;
      drops.material.uniforms.uAmount.value = rain;
      drops.material.uniforms.uTime.value = t;
      drops.material.uniforms.uCam.value.copy(camera.position);
      drainWater.visible = inDrains > 0.01;
      drainWater.material.uniforms.uWater.value = inDrains;
      drainWater.material.uniforms.uTime.value = t;
      drainWater.material.uniforms.uLight.value = 0.25 + 0.75 * light;
      water.position.y = riverBase + flood * 1.2;
      wu.uDeep.value.copy(clear.deep).lerp(silty.deep, flood * 0.8);
      wu.uShallow.value.copy(clear.shallow).lerp(silty.shallow, flood * 0.8);
    },
  };
}
