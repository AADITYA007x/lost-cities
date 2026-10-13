import * as THREE from 'three';

// A soft gradient sky with a hazy sun glow, and at night a field of stars that turns
// slowly around the celestial pole. The stars are generic, not a star map.
export function createSky({ sunDirection, haze, pole }) {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: new THREE.Color('#7d93ad') },
      uMid: { value: new THREE.Color('#e9c29b') },
      uLow: { value: haze.clone() },
      uSun: { value: new THREE.Color('#fff0d6') },
      uSunDir: { value: sunDirection.clone().normalize() },
      uStars: { value: 0 },
      uStarAngle: { value: 0 },
      uPole: { value: pole.clone() },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: `
      uniform vec3 uTop;
      uniform vec3 uMid;
      uniform vec3 uLow;
      uniform vec3 uSun;
      uniform vec3 uSunDir;
      uniform float uStars;
      uniform float uStarAngle;
      uniform vec3 uPole;
      varying vec3 vDir;
      float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      vec3 turn(vec3 v, vec3 k, float a) { return v * cos(a) + cross(k, v) * sin(a) + k * dot(k, v) * (1.0 - cos(a)); }
      float starField(vec3 d) {
        vec3 p = d * 260.0;
        vec3 i = floor(p);
        float h = hash3(i);
        if (h < 0.93) return 0.0;
        vec3 c = vec3(hash3(i + 1.3), hash3(i + 2.7), hash3(i + 5.1));
        float r = length(fract(p) - c);
        float bright = (h - 0.93) / 0.07;
        return smoothstep(0.16, 0.0, r) * (0.25 + 0.75 * bright * bright);
      }
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 c = mix(uLow, uMid, smoothstep(-0.02, 0.16, h));
        c = mix(c, uTop, smoothstep(0.16, 0.85, h));
        float s = max(dot(d, normalize(uSunDir)), 0.0);
        c += uSun * (pow(s, 900.0) * 1.4 + pow(s, 40.0) * 0.18 + pow(s, 6.0) * 0.08);
        if (uStars > 0.001) {
          float st = starField(turn(d, normalize(uPole), uStarAngle));
          c += vec3(0.86, 0.9, 1.0) * st * uStars * smoothstep(0.02, 0.2, h) * 1.6;
        }
        c = mix(c, uLow, smoothstep(0.05, -0.08, h));
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), material);
  mesh.scale.setScalar(15000);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return mesh;
}
