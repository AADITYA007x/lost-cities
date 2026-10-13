import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadTerrainData, buildTerrain, createWater, createHorizonGround } from './terrain.js';
import { createSky } from './sky.js';
import { buildCity } from './city/index.js';
import { createFlight, createCameraLimits } from './flight.js';
import { createLabels, createNotePanel } from './ui.js';
import { LANDSCAPE_NOTE, PLACE_LABELS } from './content/landscape.js';
import { createCertaintyLayer } from './certainty.js';
import { createInfo } from './info.js';

const params = new URLSearchParams(location.search);
const skipIntro = params.has('skipintro');

const isSmallScreen = Math.min(window.innerWidth, window.innerHeight) < 700;
const isTouch = matchMedia('(pointer: coarse)').matches;
const lowPower = isSmallScreen || isTouch;

// ---------- renderer ----------
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

const portrait = () => window.innerWidth < window.innerHeight;
const fovFor = () => (portrait() ? 60 : 40);
const camera = new THREE.PerspectiveCamera(fovFor(), window.innerWidth / window.innerHeight, 1, 40000);

// ---------- light: late afternoon sun from the west-south-west ----------
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

const sky = createSky({ sunDirection, haze });
scene.add(sky);

// ---------- controls ----------
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.screenSpacePanning = false;
controls.minDistance = 25;
controls.maxDistance = 3400;
controls.maxPolarAngle = THREE.MathUtils.degToRad(80);
controls.rotateSpeed = 0.5;
controls.zoomSpeed = 0.8;
controls.panSpeed = 0.8;
controls.enabled = false;

const flight = createFlight(camera, controls);

// ---------- UI ----------
const opening = document.getElementById('opening');
const loading = document.getElementById('loading');
const noteButton = document.getElementById('note-button');
const notePanel = document.getElementById('note-panel');
const labelLayer = document.getElementById('labels');
createNotePanel(noteButton, notePanel, LANDSCAPE_NOTE);

function savePreference(sound) {
  try {
    localStorage.setItem('md-sound', sound);
  } catch {
    /* storage unavailable: preference lives for this visit only */
  }
}

// ---------- world ----------
let world = null;
let certainty = null;
let info = null;
let water = null;
let labels = null;
let limit = () => {};
let home = null;

async function init() {
  const data = await loadTerrainData();
  const terrain = buildTerrain(data);
  scene.add(terrain.mesh);
  terrain.mesh.userData = { kind: 'terrain', certainty: 1 };
  water = createWater({ size: terrain.size, level: terrain.waterLevel, sunDirection, haze });
  water.userData = { kind: 'water', certainty: 1 };
  scene.add(water);
  scene.add(createHorizonGround(terrain.edgeLevel));

  const city = buildCity({ lowPower });
  scene.add(city.group);
  const groundAt = (x, z) => Math.max(terrain.heightAt(x, z), city.platformHeightAt(x, z));

  certainty = createCertaintyLayer(city.certainty);
  info = createInfo({
    canvas,
    camera,
    scene,
    city,
    terrainMeshes: [terrain.mesh, water],
    panel: document.getElementById('info-panel'),
    groundAt,
  });

  const f = city.features;
  const siteCenter = f.citadel.clone().lerp(f.lowerTown, 0.5);
  siteCenter.y = groundAt(siteCenter.x, siteCenter.z);

  sun.target.position.copy(siteCenter);
  sun.position.copy(siteCenter).addScaledVector(sunDirection, 3500);

  // Seen from the south: the citadel on the left, the lower town in the middle, the river to the right.
  const homeTarget = siteCenter.clone().add(portrait() ? new THREE.Vector3(60, 0, 40) : new THREE.Vector3(120, 0, 120));
  homeTarget.y = groundAt(homeTarget.x, homeTarget.z);
  const homeOffset = new THREE.Vector3(-80, 640, 1250).multiplyScalar(portrait() ? 1.7 : 1);
  home = { target: homeTarget, position: homeTarget.clone().add(homeOffset) };

  labels = createLabels(labelLayer, [
    { text: PLACE_LABELS.citadel, position: f.citadel, lift: 40, near: 700, far: 4200 },
    { text: PLACE_LABELS.lowerTown, position: f.lowerTown, lift: 40, near: 700, far: 4200 },
    { text: PLACE_LABELS.river, position: terrain.places.river, lift: 14, near: 300, far: 4200 },
    { text: PLACE_LABELS.greatBath, position: f.greatBath, lift: 6, near: 0, far: 1900 },
    { text: PLACE_LABELS.greatHall, position: f.greatHall, lift: 4, near: 0, far: 1500 },
    { text: PLACE_LABELS.firstStreet, position: f.firstStreet, lift: 6, near: 0, far: 1500 },
    ...Object.entries(f.tracedAreas).map(([area, p]) => ({
      text: `${area} \u00b7 walls from the excavation plan`,
      position: p,
      lift: 10,
      near: 0,
      far: 1100,
    })),
  ]);

  limit = createCameraLimits(camera, controls, groundAt, { clearance: 8 });
  world = { terrain, siteCenter };

  // test views: ?view=bath or ?view=street (start there, no intro)
  const presets = {
    bath: { target: f.greatBath.clone().setY(citadelTop(f)), offset: new THREE.Vector3(70, 65, 110) },
    traced: f.traced ? { target: f.traced.clone(), offset: new THREE.Vector3(30, 45, 60) } : null,
    ...Object.fromEntries(
      Object.entries(f.tracedAreas).map(([area, p]) => [
        area.toLowerCase().replace(/[^a-z]/g, ''),
        { target: p.clone(), offset: new THREE.Vector3(25, 40, 55) },
      ])
    ),
    street: { target: f.firstStreet.clone().add(new THREE.Vector3(0, -2, 120)), offset: new THREE.Vector3(4, 24, 75) },
  };
  const preset = presets[params.get('view')];

  if (params.get('mode') === 'evidence') {
    setTimeout(() => certaintyBox.querySelector('[data-mode=evidence]').click(), 300);
  }

  if (skipIntro || preset) {
    camera.position.copy(preset ? preset.target.clone().add(preset.offset) : home.position);
    controls.target.copy(preset ? preset.target : home.target);
    begin('off', true);
  } else {
    // a slow, distant circle while the opening screen is up
    controls.target.copy(siteCenter);
    camera.position.copy(siteCenter).add(new THREE.Vector3(-1900, 1500, 2600));
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.18;
    controls.update();
    loading.hidden = true;
    opening.querySelectorAll('button[data-sound]').forEach((b) => (b.disabled = false));
  }
}

function citadelTop(f) {
  return f.citadel.y;
}

function begin(sound, instant = false) {
  savePreference(sound);
  opening.classList.add('gone');
  controls.autoRotate = false;

  const settle = () => {
    controls.enabled = true;
    noteButton.hidden = false;
    certaintyBox.hidden = false;
    info.enable(true);
    labels.show(true);
  };

  if (instant) {
    controls.update();
    settle();
  } else {
    flight.to({ position: home.position, target: home.target, duration: 7 }, settle);
  }
}

opening.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-sound]');
  if (!button || button.disabled || !world) return;
  begin(button.dataset.sound);
});

// ---------- certainty switch ----------
const certaintyBox = document.getElementById('certainty');
certaintyBox.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-mode]');
  if (!b || !certainty) return;
  certainty.set(b.dataset.mode);
  certaintyBox.classList.toggle('evidence', b.dataset.mode === 'evidence');
  certaintyBox.querySelectorAll('button[data-mode]').forEach((x) => {
    const on = x === b;
    x.classList.toggle('on', on);
    x.setAttribute('aria-checked', String(on));
  });
});

// double-click / double-tap: glide back to the home view
let lastTap = 0;
canvas.addEventListener('pointerup', (e) => {
  if (!controls.enabled) return;
  const now = performance.now();
  if (now - lastTap < 320 && e.isPrimary) {
    controls.enabled = false;
    flight.to({ position: home.position, target: home.target, duration: 3 }, () => (controls.enabled = true));
  }
  lastTap = now;
});

init().catch((err) => {
  console.error(err);
  loading.textContent = 'The landscape could not load. Please refresh.';
});

// ---------- loop ----------
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.fov = fovFor();
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);

const timer = new THREE.Timer();
renderer.setAnimationLoop((now) => {
  timer.update(now);
  const dt = Math.min(timer.getDelta(), 0.1);
  const t = timer.getElapsed();

  if (flight.flying) {
    flight.update(dt);
  } else {
    controls.update();
    if (world) limit();
  }

  sky.position.copy(camera.position);
  if (water) water.material.uniforms.uTime.value = t;
  labels?.update(camera);
  certainty?.update(dt);
  info?.update(dt);
  renderer.render(scene, camera);
});
