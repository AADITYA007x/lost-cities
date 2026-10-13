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
import { createWalk } from './walk.js';
import { buildCollision } from './collision.js';
import { createMinimap } from './minimap.js';
import { FIRST_STREET, pointInPolygon } from './city/layout.js';
import { SEASONS, POLE, sunDirectionAt, lightAt, describeTime } from './daylight.js';
import { createLamps } from './lamps.js';
import { createTimeControl } from './time-control.js';

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
let walking = false;
const fovFor = () => (walking ? (portrait() ? 72 : 62) : portrait() ? 60 : 40);
const camera = new THREE.PerspectiveCamera(fovFor(), window.innerWidth / window.innerHeight, 1, 40000);

// ---------- light: the sun for the chosen hour and season (see daylight.js) ----------
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
let walk = null;
let city = null;
let collision = null;
const minimap = createMinimap(document.getElementById('minimap'));

async function init() {
  const data = await loadTerrainData();
  const terrain = buildTerrain(data);
  scene.add(terrain.mesh);
  terrain.mesh.userData = { kind: 'terrain', certainty: 1 };
  water = createWater({ size: terrain.size, level: terrain.waterLevel, sunDirection, haze });
  water.userData = { kind: 'water', certainty: 1 };
  scene.add(water);
  scene.add(createHorizonGround(terrain.edgeLevel));

  city = buildCity({ lowPower });
  scene.add(city.group);
  const groundAt = (x, z) => Math.max(terrain.heightAt(x, z), city.platformHeightAt(x, z));

  certainty = createCertaintyLayer(city.certainty);
  lampPoints = city.lamps;
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
  world = { terrain, siteCenter, groundAt };

  const onPlatform = (x, z) => pointInPolygon(x, z, city.rects.lowerTown.outline) || pointInPolygon(x, z, city.rects.citadel.outline);
  walk = createWalk({ camera, canvas, groundAt, onPlatform, joystickEl: document.getElementById('joystick') });
  world.onPlatform = onPlatform;
  applyTime();

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

  if (params.get('view') === 'walk') {
    camera.position.copy(home.position);
    controls.target.copy(home.target);
    begin('off', true);
    setTimeout(() => enterWalk({ instant: true, firstStreet: true }), 50);
    return;
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
    walkButton.hidden = false;
    timeButton.hidden = false;
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

// ---------- time of day and season ----------
const timeButton = document.getElementById('time-button');
const timeState = {
  hour: clampHour(Number(params.get('time') ?? 15.5)),
  season: SEASONS[params.get('season')] ? params.get('season') : 'cool',
  playing: false,
};
function clampHour(h) {
  return Number.isFinite(h) ? ((h % 24) + 24) % 24 : 15.5;
}
let lamps = null;
let lampPoints = null;
let lastLight = null;
let timeShownAt = 0;
const timeControl = createTimeControl({
  button: timeButton,
  panel: document.getElementById('time-panel'),
  state: timeState,
  onChange: applyTime,
});

// lamps appear the first time it gets dark; the traced areas get a few too, placed
// where the walls leave room
function ensureLamps() {
  if (lamps || !lampPoints) return;
  ensureCollision();
  const extra = [];
  let seed = 1;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (const c of city.covered) {
    const n = Math.round(((c.x1 - c.x0) * (c.z1 - c.z0)) / 220);
    for (let i = 0; i < n * 4 && extra.length < 4000; i++) {
      const x = c.x0 + rand() * (c.x1 - c.x0);
      const z = c.z0 + rand() * (c.z1 - c.z0);
      if (rand() > 0.35 || !world.onPlatform(x, z) || !collision.free(x, z, 0.7)) continue;
      extra.push({ x, z, y: world.groundAt(x, z) + 1.5 });
    }
  }
  lamps = createLamps([...lampPoints, ...extra], { mixUniform: city.certainty.mixUniform });
  scene.add(lamps.mesh);
}

function applyTime() {
  const day = SEASONS[timeState.season].day;
  sunDirectionAt(day, timeState.hour, sunDirection);
  const L = lightAt(sunDirection, timeState.season);
  lastLight = L;
  // below the horizon the light comes from the sky alone
  sun.color.copy(L.sun);
  sun.intensity = L.sunI * THREE.MathUtils.smoothstep(sunDirection.y, -0.01, 0.05);
  hemi.color.copy(L.hemiSky);
  hemi.groundColor.copy(L.hemiGround);
  hemi.intensity = L.hemiI;
  renderer.toneMappingExposure = L.exposure;
  haze.copy(L.low);
  scene.fog.color.copy(L.low);
  scene.fog.density = L.fogDensity;
  const u = sky.material.uniforms;
  u.uTop.value.copy(L.top);
  u.uMid.value.copy(L.mid);
  u.uLow.value.copy(L.low);
  u.uSun.value.copy(L.sun).multiplyScalar(THREE.MathUtils.smoothstep(sunDirection.y, -0.06, 0.02));
  u.uSunDir.value.copy(sunDirection);
  u.uStars.value = L.stars;
  u.uStarAngle.value = (timeState.hour / 24) * Math.PI * 2;
  if (water) {
    const w = water.material.uniforms;
    w.uSunDir.value.copy(sunDirection);
    w.uSky.value.copy(L.mid).lerp(L.low, 0.5);
    w.uSun.value.copy(L.sun);
    w.uSunStrength.value = THREE.MathUtils.smoothstep(sunDirection.y, 0.0, 0.08);
    const lv = THREE.MathUtils.clamp(0.18 + (L.sunI / 2.9) * 0.82, 0.18, 1.05);
    w.uLight.value.copy(L.hemiSky).multiplyScalar(lv / Math.max(0.5, (L.hemiSky.r + L.hemiSky.g + L.hemiSky.b) / 3));
  }
  if (params.has('debug')) window.__time = { timeState, L, sun: sun.intensity, hemi: hemi.intensity };
  if (L.glow > 0.01) ensureLamps();
  if (world) {
    const t = sun.target.position;
    sun.position.copy(t).addScaledVector(sunDirection, 3500);
  }
  // while the day plays, refresh the words a few times a second, not every frame
  const nowMs = performance.now();
  if (!timeState.playing || nowMs - timeShownAt > 250) {
    timeShownAt = nowMs;
    timeControl.show({ phrase: describeTime(timeState.hour, L.elevation), dark: L.elevation < -4 });
  }
}

// ---------- walk mode ----------
const walkButton = document.getElementById('walk-button');
const walkHint = document.getElementById('walk-hint');
const minimapEl = document.getElementById('minimap');
const mapScale = { left: -820, right: 820, top: 820, bottom: -820, normalBias: 0.35 };

// a point on First Street in the HR area, looking north up the street
function firstStreetStart() {
  const [nx, nz] = FIRST_STREET.north;
  const [sx, sz] = FIRST_STREET.south;
  const t = 0.83;
  const x = nx + (sx - nx) * t;
  const z = nz + (sz - nz) * t;
  return { x, z, yaw: Math.atan2(-(nx - sx), -(nz - sz)) };
}

function ensureCollision() {
  if (collision) return;
  const t0 = performance.now();
  collision = buildCollision(city.obstacles, city.platformHeightAt);
  if (params.has('debug')) {
    window.__walk = { walk, collision, ms: performance.now() - t0 };
  }
  walk.setCollision(collision);
  minimap.build(collision);
}

function setShadowsAround(x, z, near) {
  const cam = sun.shadow.camera;
  const r = near ? 70 : mapScale.right;
  Object.assign(cam, { left: -r, right: r, top: r, bottom: -r });
  cam.updateProjectionMatrix();
  sun.shadow.normalBias = near ? 0.04 : mapScale.normalBias;
  sun.target.position.set(x, world.groundAt(x, z), z);
  sun.position.copy(sun.target.position).addScaledVector(sunDirection, 3500);
}

function enterWalk({ instant = false, firstStreet = false } = {}) {
  if (walking || !walk) return;
  walkHint.textContent = 'Preparing the streets\u2026';
  walkHint.classList.add('show');
  // let the message paint before the (short) collision build
  setTimeout(() => {
    ensureCollision();
    let start = null;
    if (!firstStreet) {
      const t = controls.target;
      const spot = collision.nearestFree(t.x, t.z, world.onPlatform, 60);
      if (spot) {
        const yaw = Math.atan2(-(t.x - camera.position.x), -(t.z - camera.position.z));
        start = { x: spot[0], z: spot[1], yaw };
      }
    }
    if (!start) {
      const s = firstStreetStart();
      const spot = collision.nearestFree(s.x, s.z, world.onPlatform, 30) || [s.x, s.z];
      start = { x: spot[0], z: spot[1], yaw: s.yaw };
    }
    const pose = walk.start(start.x, start.z, start.yaw);
    walking = true;
    controls.enabled = false;
    labels.show(false);
    info.close();
    info.showOutlines(false);
    walkButton.textContent = 'Fly';
    walkButton.setAttribute('aria-label', 'Leave walk mode and fly');
    const go = () => {
      // close-up camera and crisp shadows only once we stand in the street
      camera.near = 0.1;
      camera.far = 9000;
      onResize();
      setShadowsAround(start.x, start.z, true);
      walk.enable(true);
      minimapEl.classList.add('on');
      walkHint.textContent = isTouch
        ? 'Use the circle to walk \u00b7 drag anywhere to look'
        : 'W A S D or arrow keys to walk \u00b7 drag to look \u00b7 Shift to hurry';
      walkHint.classList.add('show');
      clearTimeout(enterWalk.t);
      enterWalk.t = setTimeout(() => walkHint.classList.remove('show'), 6000);
    };
    if (instant) {
      camera.position.copy(pose.position);
      camera.lookAt(pose.target);
      go();
    } else {
      walkHint.classList.remove('show');
      flight.to({ position: pose.position, target: pose.target, duration: 4 }, go);
    }
  }, 30);
}

function exitWalk() {
  if (!walking) return;
  walk.enable(false);
  walking = false;
  minimapEl.classList.remove('on');
  walkHint.classList.remove('show');
  const p = walk.position.clone();
  const back = new THREE.Vector3(Math.sin(walk.yaw), 0, Math.cos(walk.yaw)).multiplyScalar(90);
  const target = new THREE.Vector3(p.x, world.groundAt(p.x, p.z), p.z);
  camera.near = 1;
  camera.far = 40000;
  onResize();
  setShadowsAround(world.siteCenter.x, world.siteCenter.z, false);
  info.showOutlines(true);
  walkButton.textContent = 'Walk';
  walkButton.setAttribute('aria-label', 'Walk the streets at eye height');
  // start the flight from where the walker was looking, so the view turns smoothly
  controls.target.copy(walk.pose().target);
  flight.to({ position: target.clone().add(back).add(new THREE.Vector3(0, 80, 0)), target, duration: 3.5 }, () => {
    controls.enabled = true;
    labels.show(true);
  });
}

walkButton.addEventListener('click', () => (walking ? exitWalk() : enterWalk()));
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && walking && !document.querySelector('.info-panel.open')) exitWalk();
});

// double-click / double-tap: glide back to the home view
let lastTap = 0;
canvas.addEventListener('pointerup', (e) => {
  if (!controls.enabled || walking) return;
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
function lampScale() {
  // pixels per metre at one metre away, for the lamp glows
  return (renderer.domElement.height / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
}

renderer.setAnimationLoop((now) => {
  timer.update(now);
  const dt = Math.min(timer.getDelta(), 0.1);
  const t = timer.getElapsed();

  if (flight.flying) {
    flight.update(dt);
  } else if (walking) {
    walk.update(dt);
    const p = walk.position;
    minimap.draw(p.x, p.z, walk.yaw);
    // keep crisp shadows around the walker
    if (Math.hypot(sun.target.position.x - p.x, sun.target.position.z - p.z) > 20) setShadowsAround(p.x, p.z, true);
  } else {
    controls.update();
    if (world) limit();
  }

  if (timeState.playing && world) {
    // a whole day in about two minutes
    timeState.hour = (timeState.hour + dt * 0.2) % 24;
    applyTime();
  }
  if (lamps && lastLight) {
    lamps.update({ time: t, glow: lastLight.glow, fog: scene.fog.density, scale: lampScale() });
  }
  sky.position.copy(camera.position);
  if (water) water.material.uniforms.uTime.value = t;
  labels?.update(camera);
  certainty?.update(dt);
  info?.update(dt);
  renderer.render(scene, camera);
});
