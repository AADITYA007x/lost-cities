import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadTerrainData, buildTerrain, createWater, createHorizonGround } from './terrain.js';
import { createSky } from './sky.js';
import { createFlight, createCameraLimits } from './flight.js';
import { createLabels, createNotePanel } from './ui.js';
import { LANDSCAPE_NOTE, PLACE_LABELS } from './content/landscape.js';

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
const shadowSize = lowPower ? 1024 : 2048;
sun.shadow.mapSize.set(shadowSize, shadowSize);
Object.assign(sun.shadow.camera, { left: -1400, right: 1400, top: 1400, bottom: -1400, near: 100, far: 7000 });
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 1.5;
scene.add(sun);
scene.add(sun.target);

const sky = createSky({ sunDirection, haze });
scene.add(sky);

// ---------- controls ----------
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.screenSpacePanning = false;
controls.minDistance = 60;
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
let water = null;
let labels = null;
let limit = () => {};
let home = null;

async function init() {
  const data = await loadTerrainData();
  const terrain = buildTerrain(data);
  scene.add(terrain.mesh);
  water = createWater({ size: terrain.size, level: terrain.waterLevel, sunDirection, haze });
  scene.add(water);
  scene.add(createHorizonGround(terrain.edgeLevel));

  const { citadel, lowerTown, river } = terrain.places;
  const siteCenter = citadel.clone().lerp(lowerTown, 0.55);
  siteCenter.y = terrain.heightAt(siteCenter.x, siteCenter.z);

  sun.target.position.copy(siteCenter);
  sun.position.copy(siteCenter).addScaledVector(sunDirection, 3500);

  // Seen from the south: the citadel on the left, the lower town in the middle, the river to the right.
  const homeTarget = siteCenter.clone().add(portrait() ? new THREE.Vector3(260, 0, 260) : new THREE.Vector3(480, 0, 380));
  homeTarget.y = terrain.heightAt(homeTarget.x, homeTarget.z);
  const homeOffset = new THREE.Vector3(-150, 950, 1950).multiplyScalar(portrait() ? 1.3 : 1);
  home = { target: homeTarget, position: homeTarget.clone().add(homeOffset) };

  labels = createLabels(labelLayer, [
    { text: PLACE_LABELS.citadel, position: citadel, lift: 28 },
    { text: PLACE_LABELS.lowerTown, position: lowerTown, lift: 24 },
    { text: PLACE_LABELS.river, position: river, lift: 14 },
  ]);

  limit = createCameraLimits(camera, controls, terrain.heightAt);
  world = { terrain, siteCenter };

  if (skipIntro) {
    camera.position.copy(home.position);
    controls.target.copy(home.target);
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

function begin(sound, instant = false) {
  savePreference(sound);
  opening.classList.add('gone');
  controls.autoRotate = false;

  const settle = () => {
    controls.enabled = true;
    noteButton.hidden = false;
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
  renderer.render(scene, camera);
});
