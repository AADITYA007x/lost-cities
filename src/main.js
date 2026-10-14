import * as THREE from 'three';
import { loadTerrainData, buildTerrain, createWater, createHorizonGround } from './terrain.js';
import { buildCity } from './city/index.js';
import { createCameraLimits } from './flight.js';
import { createLabels, createNotePanel } from './ui.js';
import { LANDSCAPE_NOTE, PLACE_LABELS } from './content/landscape.js';
import { createCertaintyLayer } from './certainty.js';
import { createInfo } from './info.js';
import { pointInPolygon } from './city/layout.js';
import { createStage } from './app/stage.js';
import { createDaytime } from './app/daytime.js';
import { createWalkMode } from './app/walk-mode.js';
import { createWeather } from './weather.js';
import { createLife, CRAFT_LABELS } from './life.js';
import { createEras } from './app/eras.js';
import { createEraControl } from './era-control.js';
import { createScriptExplorer } from './script-explorer.js';

// Starts everything: the stage, the landscape and city, the opening screen, and the
// frame loop. Each feature lives in its own module; `app` is what they share.

const params = new URLSearchParams(location.search);
const isTouch = matchMedia('(pointer: coarse)').matches;
const lowPower = Math.min(window.innerWidth, window.innerHeight) < 700 || isTouch;

const stage = createStage({ lowPower });
const { scene, camera, controls, flight } = stage;

const app = {
  params,
  isTouch,
  stage,
  world: null, // { terrain, siteCenter, groundAt, onPlatform }, once loaded
  city: null,
  water: null,
  info: null,
  labels: null,
  home: null,
};
const daytime = createDaytime(app);
const walkMode = createWalkMode(app);
app.ensureCollision = walkMode.ensureCollision;
if (params.has('debug')) window.__app = app;

// ---------- UI ----------
const opening = document.getElementById('opening');
const loading = document.getElementById('loading');
const noteButton = document.getElementById('note-button');
const certaintyBox = document.getElementById('certainty');
createNotePanel(noteButton, document.getElementById('note-panel'), LANDSCAPE_NOTE);

function savePreference(sound) {
  try {
    localStorage.setItem('md-sound', sound);
  } catch {
    /* storage unavailable: preference lives for this visit only */
  }
}

let certainty = null;
let weather = null;
let life = null;
let eras = null;
let limit = () => {};

// ---------- world ----------
async function init() {
  const data = await loadTerrainData();
  const terrain = buildTerrain(data);
  scene.add(terrain.mesh);
  terrain.mesh.userData = { kind: 'terrain', certainty: 1 };
  const water = createWater({ size: terrain.size, level: terrain.waterLevel, sunDirection: stage.sunDirection, haze: stage.haze });
  water.userData = { kind: 'water', certainty: 1 };
  scene.add(water);
  scene.add(createHorizonGround(terrain.edgeLevel));
  app.water = water;

  const city = buildCity({ lowPower });
  scene.add(city.group);
  app.city = city;
  weather = createWeather({ scene, camera, city, water, riverPoint: terrain.places.river, lowPower });
  const groundAt = (x, z) => Math.max(terrain.heightAt(x, z), city.platformHeightAt(x, z));
  const onPlatform = (x, z) => pointInPolygon(x, z, city.rects.lowerTown.outline) || pointInPolygon(x, z, city.rects.citadel.outline);

  certainty = createCertaintyLayer(city.certainty);
  app.info = createInfo({
    canvas: stage.canvas,
    camera,
    scene,
    city,
    terrainMeshes: [terrain.mesh, water],
    panel: document.getElementById('info-panel'),
    groundAt,
  });

  life = createLife({ city, groundAt, lowPower });
  scene.add(life.group);
  app.life = life;
  app.drainsMesh = weather.drainsMesh;
  app.lampsMesh = () => daytime.lampsMesh;
  eras = createEras(app);
  app.eras = eras;
  app.info.setHitFilter((hit) => eras.visibleHit(hit));
  app.info.addTargets(life.pickables);

  const f = city.features;
  const siteCenter = f.citadel.clone().lerp(f.lowerTown, 0.5);
  siteCenter.y = groundAt(siteCenter.x, siteCenter.z);
  stage.sun.target.position.copy(siteCenter);

  // Seen from the south: the citadel on the left, the lower town in the middle, the river to the right.
  const portrait = stage.portrait();
  const homeTarget = siteCenter.clone().add(portrait ? new THREE.Vector3(60, 0, 40) : new THREE.Vector3(120, 0, 120));
  homeTarget.y = groundAt(homeTarget.x, homeTarget.z);
  const homeOffset = new THREE.Vector3(-80, 640, 1250).multiplyScalar(portrait ? 1.7 : 1);
  app.home = { target: homeTarget, position: homeTarget.clone().add(homeOffset) };

  app.labels = createLabels(document.getElementById('labels'), [
    { text: PLACE_LABELS.citadel, position: f.citadel, lift: 40, near: 700, far: 4200 },
    { text: PLACE_LABELS.lowerTown, position: f.lowerTown, lift: 40, near: 700, far: 4200 },
    { text: PLACE_LABELS.river, position: terrain.places.river, lift: 14, near: 300, far: 4200 },
    { text: PLACE_LABELS.greatBath, position: f.greatBath, lift: 6, near: 0, far: 1900 },
    { text: PLACE_LABELS.greatHall, position: f.greatHall, lift: 4, near: 0, far: 1500 },
    { text: PLACE_LABELS.firstStreet, position: f.firstStreet, lift: 6, near: 0, far: 1500 },
    ...life.stations.map((st) => ({ text: CRAFT_LABELS[st.craft], position: st.labelPos, lift: 0.3, near: 0, far: 160 })),
    ...Object.entries(f.tracedAreas).map(([area, p]) => ({
      text: `${area} · walls from the excavation plan`,
      position: p,
      lift: 10,
      near: 0,
      far: 1100,
    })),
  ]);

  limit = createCameraLimits(camera, controls, groundAt, { clearance: 8 });
  app.world = { terrain, siteCenter, groundAt, onPlatform };
  walkMode.setup();
  daytime.apply();
  weather.settle({ rain: daytime.rainLevel, monsoon: daytime.state.season === 'monsoon' });
  const startEra = eras.ERAS.some((e) => e.id === params.get('era')) ? params.get('era') : 'height';
  eras.set(startEra, { instant: true });
  eraControl.show(startEra);
  if (params.has('split')) eraControl.setSplit?.(true);

  // test views: ?view=bath, ?view=street, ?view=hr ... (start there, no intro)
  const presets = {
    bath: { target: f.greatBath.clone().setY(f.citadel.y), offset: new THREE.Vector3(70, 65, 110) },
    traced: f.traced ? { target: f.traced.clone(), offset: new THREE.Vector3(30, 45, 60) } : null,
    ...Object.fromEntries(
      Object.entries(f.tracedAreas).map(([area, p]) => [
        area.toLowerCase().replace(/[^a-z]/g, ''),
        { target: p.clone(), offset: new THREE.Vector3(25, 40, 55) },
      ])
    ),
    craft: life.stations.length
      ? { target: life.stations[0].labelPos.clone().setY(life.stations[0].y), offset: new THREE.Vector3(6, 9, 8) }
      : null,
    street: { target: f.firstStreet.clone().add(new THREE.Vector3(0, -2, 120)), offset: new THREE.Vector3(4, 24, 75) },
  };
  const preset = presets[params.get('view')];

  if (params.get('mode') === 'evidence') {
    setTimeout(() => certaintyBox.querySelector('[data-mode=evidence]').click(), 300);
  }

  const { home } = app;
  if (params.get('view') === 'walk') {
    camera.position.copy(home.position);
    controls.target.copy(home.target);
    begin('off', true);
    setTimeout(() => walkMode.enter({ instant: true, firstStreet: true }), 50);
    return;
  }

  if (params.has('skipintro') || preset) {
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

function begin(sound, instant = false) {
  savePreference(sound);
  opening.classList.add('gone');
  controls.autoRotate = false;

  const settle = () => {
    controls.enabled = true;
    noteButton.hidden = false;
    certaintyBox.hidden = false;
    app.info.enable(true);
    app.labels.show(true);
    walkMode.show();
    daytime.show();
    eraButton.hidden = false;
    scriptButton.hidden = false;
  };

  if (instant) {
    controls.update();
    settle();
  } else {
    flight.to({ position: app.home.position, target: app.home.target, duration: 7 }, settle);
  }
}

opening.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-sound]');
  if (!button || button.disabled || !app.world) return;
  begin(button.dataset.sound);
});

// ---------- the city through time ----------
const eraButton = document.getElementById('era-button');
const eraControl = createEraControl({
  button: eraButton,
  panel: document.getElementById('era-panel'),
  splitEl: document.getElementById('split'),
  onChange: (id) => {
    if (!eras) return;
    // walking happens in the living city; in the buried and excavated views, fly
    if (stage.walking && (id === 'buried' || id === 'today')) walkMode.exit();
    eras.set(id);
    eraControl.show(id);
  },
  onSplit: () => {},
});

// ---------- the Indus script ----------
const scriptButton = document.getElementById('script-button');
const script = createScriptExplorer({ panel: document.getElementById('script-panel'), button: scriptButton });
window.addEventListener('open-script', () => {
  app.info?.close();
  script.open(true);
});
if (params.has('script')) setTimeout(() => script.open(true), 500);

// only one of the two top panels is open at a time
eraButton.addEventListener('click', () => document.getElementById('time-panel').classList.remove('open'));
document.getElementById('time-button').addEventListener('click', () => eraControl.open(false));
// walking starts in the living city: from the buried or excavated views, go back to its height
app.beforeWalk = () => {
  if (eras && (eras.current === 'buried' || eras.current === 'today')) {
    eras.set('height');
    eraControl.show('height');
  }
};

// ---------- certainty switch ----------
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
stage.canvas.addEventListener('pointerup', (e) => {
  if (!controls.enabled || stage.walking) return;
  const now = performance.now();
  if (now - lastTap < 320 && e.isPrimary) {
    controls.enabled = false;
    flight.to({ position: app.home.position, target: app.home.target, duration: 3 }, () => (controls.enabled = true));
  }
  lastTap = now;
});

init().catch((err) => {
  console.error(err);
  loading.textContent = 'The landscape could not load. Please refresh.';
});

// ---------- loop ----------
const timer = new THREE.Timer();
stage.renderer.setAnimationLoop((now) => {
  timer.update(now);
  const dt = Math.min(timer.getDelta(), 0.1);
  const t = timer.getElapsed();

  if (flight.flying) {
    flight.update(dt);
  } else if (stage.walking) {
    walkMode.update(dt);
  } else {
    controls.update();
    if (app.world) limit();
  }

  daytime.update(dt, t);
  const light = daytime.light;
  weather?.update(dt, t, {
    rain: daytime.rainLevel,
    monsoon: daytime.state.season === 'monsoon',
    light: light ? THREE.MathUtils.clamp((light.elevation + 6) / 20, 0, 1) : 1,
  });
  if (life && light) {
    life.update(dt, t, {
      camera,
      day: THREE.MathUtils.clamp((light.elevation + 4) / 14, 0, 1),
      rain: daytime.rainLevel,
      evidence: app.city.certainty.mixUniform.value,
      population: eras ? eras.population : 1,
    });
  }
  eras?.update(dt);
  stage.sky.position.copy(camera.position);
  if (app.water) app.water.material.uniforms.uTime.value = t;
  app.labels?.update(camera);
  certainty?.update(dt);
  app.info?.update(dt);
  renderFrame();
});

// one view, or two moments side by side (then and now) split at a draggable line
function renderFrame() {
  const { renderer } = stage;
  if (!eras) {
    renderer.render(scene, camera);
    return;
  }
  eras.beginFrame();
  if (eraControl.split) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const sx = Math.round(w * eraControl.fraction);
    const left = eras.current === 'today' ? 'height' : eras.current;
    renderer.setScissorTest(true);
    renderer.setScissor(0, 0, sx, h);
    eras.apply(left);
    renderer.render(scene, camera);
    renderer.setScissor(sx, 0, w - sx, h);
    eras.apply('today');
    renderer.render(scene, camera);
    renderer.setScissorTest(false);
  } else {
    eras.apply();
    renderer.render(scene, camera);
  }
  eras.endFrame();
  // leave the scene set to the chosen moment (for clicks)
  eras.apply();
}
