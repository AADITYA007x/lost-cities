import * as THREE from 'three';

// A soft gradient sky with a hazy sun glow. Colours follow the "dawn haze" palette.
export function createSky({ sunDirection, haze }) {
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
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 c = mix(uLow, uMid, smoothstep(-0.02, 0.16, h));
        c = mix(c, uTop, smoothstep(0.16, 0.85, h));
        float s = max(dot(d, normalize(uSunDir)), 0.0);
        c += uSun * (pow(s, 900.0) * 1.4 + pow(s, 40.0) * 0.18 + pow(s, 6.0) * 0.08);
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
