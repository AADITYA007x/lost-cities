import * as THREE from 'three';

// Small warm glows after dark, in courtyards and yards. They are imagined: how homes
// were lit at night is not well known. Drawn as glowing points, not real lights,
// so thousands of them cost almost nothing.

export function createLamps(points, { mixUniform }) {
  const n = points.length;
  const pos = new Float32Array(n * 3);
  const seed = new Float32Array(n);
  points.forEach((p, i) => {
    pos[i * 3] = p.x;
    pos[i * 3 + 1] = p.y;
    pos[i * 3 + 2] = p.z;
    seed[i] = Math.random();
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geometry.computeBoundingSphere();

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uGlow: { value: 0 },
      uScale: { value: 500 },
      uFog: { value: 0.00016 },
      uMix: mixUniform,
      uColor: { value: new THREE.Color('#ffb25e') },
    },
    vertexShader: `
      attribute float aSeed;
      uniform float uTime;
      uniform float uScale;
      uniform float uFog;
      varying float vFlicker;
      varying float vFog;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float dist = -mv.z;
        // a glow about 3.2 m across, but never smaller than a spark
        gl_PointSize = clamp(3.2 * uScale / dist, 4.0, 110.0);
        gl_Position = projectionMatrix * mv;
        vFlicker = 0.82 + 0.18 * sin(uTime * 7.0 + aSeed * 40.0) * sin(uTime * 2.9 + aSeed * 13.0);
        float f = uFog * dist;
        vFog = exp(-f * f);
      }`,
    fragmentShader: `
      uniform float uGlow;
      uniform float uMix;
      uniform vec3 uColor;
      varying float vFlicker;
      varying float vFog;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        if (r > 1.0) discard;
        float core = smoothstep(0.16, 0.0, r);
        float halo = exp(-r * r * 5.0) * 0.55;
        float a = (core + halo) * vFlicker * uGlow * vFog * (1.0 - uMix);
        gl_FragColor = vec4(uColor * a + vec3(1.0, 0.92, 0.75) * core * a * 0.6, a);
      }`,
  });

  const mesh = new THREE.Points(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  mesh.visible = false;
  return {
    mesh,
    update({ time, glow, fog, scale }) {
      material.uniforms.uTime.value = time;
      material.uniforms.uGlow.value = glow;
      material.uniforms.uFog.value = fog;
      material.uniforms.uScale.value = scale;
      mesh.visible = glow > 0.01;
    },
  };
}
