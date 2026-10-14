import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createSky } from '../sky.js';
import { createFlight } from '../flight.js';
import { POLE } from '../daylight.js';

// The renderer, scene, camera, lights, sky and camera controls.

export function createStage({ lowPower }) {
  const canvas = document.getElementById('scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowPower ? 1.5 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const haze = new THREE.Color('#dcc0a0');
  scene.fog = new THREE.FogExp2(haze, 0.00016);

  const stage = { walking: false };
  const portrait = () => window.innerWidth < window.innerHeight;
  const fovFor = () => (stage.walking ? (portrait() ? 72 : 62) : portrait() ? 60 : 40);
  const camera = new THREE.PerspectiveCamera(fovFor(), window.innerWidth / window.innerHeight, 1, 40000);

  // the sun for the chosen hour and season is set by daytime.js
  const sunDirection = new THREE.Vector3(-0.86, 0.34, 0.38).normalize();
  const hemi = new THREE.HemisphereLight('#e9d6bd', '#5e4630', 0.75);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight('#ffd3a0', 2.9);
  sun.castShadow = true;
  const shadowSize = lowPower ? 2048 : 4096;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  Object.assign(sun.shadow.camera, { left: -820, right: 820, top: 820, bottom: -820, near: 100, far: 7000 });
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.35;
  scene.add(sun);
  scene.add(sun.target);

  const sky = createSky({ sunDirection, haze, pole: POLE });
  scene.add(sky);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.screenSpacePanning = false;
  controls.minDistance = 8;
  controls.maxDistance = 3400;
  controls.maxPolarAngle = THREE.MathUtils.degToRad(80);
  controls.rotateSpeed = 0.5;
  controls.zoomSpeed = 0.8;
  controls.panSpeed = 0.8;
  controls.enabled = false;

  const flight = createFlight(camera, controls);

  // "lift": shift the picture up so the place looked at sits above a card at the
  // bottom of the screen (the tour). 0 = centred, 0.2 = a fifth of the height higher.
  let lift = 0;
  let liftTarget = 0;
  function applyLift() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (lift > 0.001) camera.setViewOffset(w, h, 0, lift * h, w, h);
    else camera.clearViewOffset();
  }
  function setLift(f) {
    liftTarget = f;
  }
  function updateLift(dt) {
    if (lift === liftTarget) return;
    const step = dt * 0.5;
    lift = Math.abs(liftTarget - lift) <= step ? liftTarget : lift + Math.sign(liftTarget - lift) * step;
    applyLift();
  }

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.fov = fovFor();
    applyLift();
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', resize);

  // pixels per metre at one metre away (for glows drawn as points)
  const pixelsPerMetre = () => renderer.domElement.height / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

  return Object.assign(stage, {
    canvas,
    renderer,
    scene,
    camera,
    haze,
    sunDirection,
    hemi,
    sun,
    sky,
    controls,
    flight,
    portrait,
    resize,
    setLift,
    updateLift,
    pixelsPerMetre,
  });
}
