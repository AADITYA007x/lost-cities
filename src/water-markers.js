import * as THREE from 'three';

// Gold marks that show, for a little while, where every well or every drain is.
// Opened from the guide ("Wells", "Street drains"), so they are easy to find.

export function createWaterMarkers({ wells, drainLines }) {
  const group = new THREE.Group();
  group.name = 'water-markers';
  group.renderOrder = 12;

  // wells: a glowing dot above each
  const wellGeo = new THREE.BufferGeometry();
  wellGeo.setAttribute('position', new THREE.Float32BufferAttribute(wells.flatMap((w) => [w.x, w.y + 2.2, w.z]), 3));
  const wellMat = new THREE.ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: { uOpacity: { value: 0 }, uTime: { value: 0 } },
    vertexShader: `
      uniform float uTime;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(1400.0 / -mv.z, 7.0, 26.0) * (1.0 + 0.15 * sin(uTime * 4.0));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uOpacity;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        if (r > 1.0) discard;
        float ring = smoothstep(1.0, 0.8, r) * smoothstep(0.45, 0.65, r);
        float dot = smoothstep(0.35, 0.2, r);
        gl_FragColor = vec4(vec3(1.0, 0.82, 0.42), (ring + dot) * uOpacity);
      }`,
  });
  const wellPoints = new THREE.Points(wellGeo, wellMat);
  wellPoints.frustumCulled = false;
  wellPoints.renderOrder = 12;
  group.add(wellPoints);

  // drains: gold lines along each drain
  const drainGeo = new THREE.BufferGeometry();
  drainGeo.setAttribute('position', new THREE.Float32BufferAttribute(drainLines.flatMap(([ax, az, bx, bz, y]) => [ax, y + 0.4, az, bx, y + 0.4, bz]), 3));
  const drainMat = new THREE.LineBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0, depthTest: false, depthWrite: false });
  const drainLinesMesh = new THREE.LineSegments(drainGeo, drainMat);
  drainLinesMesh.frustumCulled = false;
  drainLinesMesh.renderOrder = 12;
  group.add(drainLinesMesh);

  const state = { wells: 0, drains: 0 };
  const until = { wells: 0, drains: 0 };
  let time = 0;

  return {
    group,
    // show one kind for a few seconds
    show(kind, seconds = 9) {
      until[kind] = time + seconds;
    },
    hide() {
      until.wells = until.drains = 0;
    },
    update(dt) {
      time += dt;
      for (const k of ['wells', 'drains']) {
        const want = time < until[k] ? 1 : 0;
        state[k] += (want - state[k]) * Math.min(1, dt * 3);
      }
      wellMat.uniforms.uOpacity.value = state.wells;
      wellMat.uniforms.uTime.value = time;
      drainMat.opacity = state.drains * (0.75 + 0.25 * Math.sin(time * 4));
      wellPoints.visible = state.wells > 0.01;
      drainLinesMesh.visible = state.drains > 0.01;
    },
  };
}
