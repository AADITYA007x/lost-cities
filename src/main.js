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
import { createSound } from './sound.js';
import { createChat } from './chat.js';
import { ERA_BY_ID } from './content/eras.js';
import { SEASONS } from './daylight.js';
import { PLACE_LABELS as NAMES } from './content/landscape.js';
import { createGuide } from './guide.js';
import { createBustle } from './bustle.js';
import { createWaterMarkers } from './water-markers.js';
import { FEATURES } from './content/features.js';
import { TOUR, PLACE_GROUPS, SEARCH_WORDS } from './content/tour.js';
import { EXCAVATED_AREAS, FIRST_STREET, fromSitePlan } from './city/layout.js';

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
let bustle = null;
let markers = null;
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

  // the busy city: smoke, birds, carts, cloth on roofs, fields and trees (imagined)
  bustle = createBustle({ city, world: { terrain, siteCenter, groundAt }, life, lowPower });
  scene.add(bustle.group);
  app.info.addTargets(bustle.pickables);
  app.bustle = bustle;
  // marks that show every well or drain, from the guide
  const allWells = [];
  city.group.traverse((o) => {
    if (o.isInstancedMesh && o.userData.kind === 'well' && o.material !== undefined && o.geometry.attributes.aCertainty) {
      const m = new THREE.Matrix4();
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m);
        allWells.push({ x: m.elements[12], y: m.elements[13], z: m.elements[14] });
      }
    }
  });
  markers = createWaterMarkers({ wells: allWells, drainLines: city.drainLines });
  scene.add(markers.group);
  app.markers = markers;
  stage.sun.target.position.copy(siteCenter);

  // Seen from the south: the citadel on the left, the lower town in the middle, the river to the right.
  const portrait = stage.portrait();
  const homeTarget = siteCenter.clone().add(portrait ? new THREE.Vector3(60, 0, 40) : new THREE.Vector3(120, 0, 120));
  homeTarget.y = groundAt(homeTarget.x, homeTarget.z);
  const homeOffset = new THREE.Vector3(-80, 640, 1250).multiplyScalar(portrait ? 1.7 : 1);
  app.home = { target: homeTarget, position: homeTarget.clone().add(homeOffset) };

  app.labels = createLabels(document.getElementById('labels'), [
    // priority decides which label stays when two overlap on screen
    { text: PLACE_LABELS.citadel, position: f.citadel, lift: 40, near: 700, far: 4200, priority: 2 },
    { text: PLACE_LABELS.lowerTown, position: f.lowerTown, lift: 40, near: 700, far: 4200, priority: 2 },
    { text: PLACE_LABELS.river, position: terrain.places.river, lift: 14, near: 300, far: 4200, priority: 2 },
    { text: PLACE_LABELS.greatBath, position: f.greatBath, lift: 6, near: 0, far: 1900, priority: 4 },
    { text: PLACE_LABELS.greatHall, position: f.greatHall, lift: 4, near: 0, far: 1500, priority: 3 },
    { text: PLACE_LABELS.firstStreet, position: f.firstStreet, lift: 6, near: 0, far: 1500, priority: 3 },
    ...life.stations.map((st) => ({ text: CRAFT_LABELS[st.craft], position: st.labelPos, lift: 0.3, near: 0, far: 160, priority: 3 })),
    ...Object.entries(f.tracedAreas).map(([area, p]) => ({
      text: `${area} · walls from the excavation plan`,
      position: p,
      lift: 10,
      near: 0,
      far: 1100,
      priority: 1,
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
  // the test views start silent; a real visitor's choice is remembered
  if (!instant) savePreference(sound);
  if (sound === 'on') setSound(true);
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
    soundButton.hidden = false;
    chatButton.hidden = false;
    guideButton.hidden = false;
    if (params.has('tour')) guide.startTour();
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

// ---------- sound ----------
const sound = createSound();
if (params.has('debug')) window.__sound = sound;
const soundButton = document.getElementById('sound-button');
function setSound(on) {
  sound.enable(on);
  soundButton.setAttribute('aria-pressed', String(on));
  soundButton.setAttribute('aria-label', on ? 'Sound on: turn it off' : 'Sound off: turn it on');
  soundButton.classList.toggle('on', on);
}
soundButton.addEventListener('click', () => {
  const on = !sound.on;
  setSound(on);
  savePreference(on ? 'on' : 'off');
});
// sound keeps playing in another tab: the frame loop stops there, so a slow timer
// keeps the occasional notes and birds going (turn it off with the speaker button)
let lastSoundState = null;
let backgroundTimer = 0;
document.addEventListener('visibilitychange', () => {
  clearInterval(backgroundTimer);
  if (document.hidden) {
    if (sound.on && lastSoundState) backgroundTimer = setInterval(() => sound.update(lastSoundState), 1000);
  } else {
    sound.resume();
  }
});
let soundCheck = 0;
const soundState = { craftDist: 999 };
function updateSound(dt, light) {
  if (!sound.on || !app.world) return;
  const p = camera.position;
  const ground = app.world.groundAt(p.x, p.z);
  const river = app.world.terrain.places.river;
  soundCheck -= dt;
  if (soundCheck <= 0 && life) {
    // the nearest workshop, checked a few times a second
    soundCheck = 0.3;
    soundState.craftDist = Math.min(999, ...life.stations.map((st) => Math.hypot(st.x - p.x, st.z - p.z, (st.y - p.y) * 0.5)));
  }
  const era = eras ? eras.current : 'height';
  lastSoundState = {
    living: era !== 'buried' && era !== 'today',
    day: light ? THREE.MathUtils.clamp((light.elevation + 4) / 14, 0, 1) : 1,
    rain: daytime.rainLevel,
    height: p.y - ground,
    riverDist: Math.hypot(p.x - river.x, p.z - river.z),
    craftDist: soundState.craftDist,
    population: eras ? eras.population : 1,
  };
  sound.update(lastSoundState);
}

// ---------- talk to a resident ----------
const chatButton = document.getElementById('chat-button');
// what the visitor is looking at, so the resident can mention it
function chatContext() {
  const ctx = {};
  if (eras) {
    const e = ERA_BY_ID[eras.current];
    ctx.era = `${e.date}, ${e.title}`;
  }
  ctx.time = document.getElementById('time-button').textContent.trim();
  ctx.season = SEASONS[daytime.state.season]?.label;
  ctx.rain = daytime.rainLevel > 0.5;
  if (app.city) {
    const p = stage.walking && app.walkPosition ? app.walkPosition() : controls.target;
    const f = app.city.features;
    const named = [
      [NAMES.greatBath, f.greatBath],
      [NAMES.greatHall, f.greatHall],
      [NAMES.firstStreet, f.firstStreet],
      ...Object.entries(f.tracedAreas).map(([a, v]) => [`the ${a} area`, v]),
      ...(life ? life.stations.map((st) => [`a workshop: ${st.craft}`, st.labelPos]) : []),
    ];
    let best = null;
    for (const [name, v] of named) {
      const d = Math.hypot(v.x - p.x, v.z - p.z);
      if (d < 120 && (!best || d < best[1])) best = [name, d];
    }
    ctx.place = best ? best[0] : null;
  }
  return ctx;
}
// fly the camera somewhere (leaving walk mode first if asked)
function flyTo({ position, target }, { duration = 3.5, leaveWalk = true } = {}) {
  if (stage.walking) {
    if (!leaveWalk) return;
    walkMode.exit();
  }
  controls.enabled = false;
  flight.to({ position, target, duration }, () => {
    controls.enabled = true;
    app.labels?.show(true);
  });
}
function setEra(id) {
  if (!eras || eras.current === id) return;
  if (stage.walking && (id === 'buried' || id === 'today')) walkMode.exit();
  eras.set(id);
  eraControl.show(id);
}
function setMode(mode) {
  if (certainty && certainty.mode !== mode) certaintyBox.querySelector(`[data-mode=${mode}]`).click();
}
const living = () => (eras && (eras.current === 'buried' || eras.current === 'today') ? 'height' : eras?.current);

// the nearest workshop (or well) of a craft, and a view of its worker
function nearestStation(craft) {
  const here = stage.walking && app.walkPosition ? app.walkPosition() : controls.target;
  const list = life ? life.stations.filter((st) => st.craft === craft) : [];
  if (!list.length) return null;
  return list.reduce((a, b) => (Math.hypot(a.x - here.x, a.z - here.z) <= Math.hypot(b.x - here.x, b.z - here.z) ? a : b));
}
function goToStation(craft, { walkJump = true } = {}) {
  if (!app.world) return;
  setEra(living());
  const st = nearestStation(craft);
  if (!st) return;
  // in front of the worker (they face +z in their own frame)
  const fx = Math.sin(st.yaw);
  const fz = Math.cos(st.yaw);
  if (stage.walking && walkJump && app.walkJump) {
    app.walkJump(st.x + fx * 2.4, st.z + fz * 2.4, [st.x, st.z]);
    return;
  }
  const target = new THREE.Vector3(st.x, st.y + 0.7, st.z);
  flyTo({ position: clearViewOf(target, st.yaw), target });
}
// a camera spot that sees the worker over the walls and roofs around: try angles
// around the front of the worker, then a steeper view from above
const sightRay = new THREE.Raycaster();
function clearViewOf(target, yaw) {
  const blockers = app.city.pickables.filter((m) => m.userData.kind === 'walls' || m.userData.kind === 'roofs');
  const head = target.clone().setY(target.y + 0.8);
  const dir = new THREE.Vector3();
  const tries = [];
  for (const [dist, up] of [[10, 9], [8, 13], [5, 18]]) {
    for (let k = 0; k < 12; k++) {
      // 0, +30°, −30°, +60°, …: nearest to the front first
      const a = yaw + (Math.ceil(k / 2) * (k % 2 ? 1 : -1) * Math.PI) / 6 + 0.3;
      tries.push(target.clone().add(new THREE.Vector3(Math.sin(a) * dist, up, Math.cos(a) * dist)));
    }
  }
  for (const pos of tries) {
    const d = pos.distanceTo(head);
    sightRay.set(head, dir.subVectors(pos, head).normalize());
    sightRay.far = d;
    if (!sightRay.intersectObjects(blockers, false).some((h) => h.object.visible)) return pos;
  }
  return target.clone().add(new THREE.Vector3(2, 22, 3));
}
// take the visitor to the person they talk to
const PERSONA_CRAFT = { water: 'water', beads: 'beads', potter: 'potter' };
const goToPerson = (persona) => goToStation(PERSONA_CRAFT[persona]);
const chat = createChat({
  panel: document.getElementById('chat-panel'),
  button: chatButton,
  getContext: chatContext,
  onPersona: goToPerson,
  onSpeaking: (on) => sound.duck(on),
});
if (params.has('chat')) setTimeout(() => chat.open(true), 500);

// ---------- the guide: a tour, and places to fly to ----------
const guideButton = document.getElementById('guide-button');
// where each place is seen from: a target, an offset for the camera, and an outline
function placeView(id) {
  const { city, world } = app;
  const f = city.features;
  const g = world.groundAt;
  const at = (x, z, lift = 0) => new THREE.Vector3(x, g(x, z) + lift, z);
  const rectView = (r, k = 1) => {
    const size = Math.max(r.x1 - r.x0, r.z1 - r.z0) * k;
    const c = at((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2);
    return { target: c, offset: new THREE.Vector3(0.3, 0.6, 0.85).multiplyScalar(Math.max(60, size)), shape: { rect: r } };
  };
  const covered = (area) => {
    const list = city.covered.filter((c) => c.area === area);
    if (!list.length) return null;
    return {
      x0: Math.min(...list.map((c) => c.x0)),
      x1: Math.max(...list.map((c) => c.x1)),
      z0: Math.min(...list.map((c) => c.z0)),
      z1: Math.max(...list.map((c) => c.z1)),
    };
  };
  const excavated = (areaId) => EXCAVATED_AREAS.find((a) => a.id === areaId);
  const { plan, rects } = city;
  switch (id) {
    case 'overview':
      return { position: app.home.position, target: app.home.target };
    case 'citadel':
      return { target: f.citadel.clone(), offset: new THREE.Vector3(230, 300, 470), shape: { poly: rects.citadel.outline } };
    case 'lowerTown':
      return { target: f.lowerTown.clone(), offset: new THREE.Vector3(180, 420, 700), shape: { poly: rects.lowerTown.outline } };
    case 'greatBath':
      return { target: f.greatBath.clone().setY(f.citadel.y), offset: new THREE.Vector3(70, 65, 110), shape: { rect: plan.bath } };
    case 'greatHall':
      return { ...rectView(plan.hall, 1.6) };
    case 'college':
      return { ...rectView(plan.college, 1.6) };
    case 'pillaredHall':
      return { ...rectView(plan.pillared, 1.8) };
    case 'firstStreet':
      return {
        target: f.firstStreet.clone().add(new THREE.Vector3(0, -2, 120)),
        offset: new THREE.Vector3(4, 24, 75),
        shape: { line: [FIRST_STREET.north, FIRST_STREET.south] },
      };
    case 'area-HR':
    case 'area-VS':
    case 'area-DK-G':
    case 'area-L': {
      const r = covered(id.slice(5)) || excavated(id.slice(5));
      return r ? rectView(r, 0.9) : null;
    }
    case 'area-SD':
      return rectView(excavated('SD'), 0.9);
    case 'area-DK':
      return rectView(excavated('DK-B/C'), 0.9);
    case 'river': {
      const p = world.terrain.places.river;
      return { target: at(p.x, p.z), offset: new THREE.Vector3(250, 420, 700) };
    }
    case 'mound':
      return { target: world.siteCenter.clone(), offset: new THREE.Vector3(-60, 420, 820), era: 'buried' };
    case 'stupa': {
      const [x, z] = fromSitePlan(340, 462);
      return { target: at(x, z, 4), offset: new THREE.Vector3(60, 55, 95), era: 'today' };
    }
    case 'well': {
      // an excavated well on a traced plan, near First Street's south end
      const list = [];
      city.group.traverse((o) => {
        // the plans' wells first (excavated or inferred), else any
        if (o.isInstancedMesh && o.userData.kind === 'well' && o.geometry.attributes.aCertainty) {
          const m = new THREE.Matrix4();
          for (let i = 0; i < o.count; i++) {
            o.getMatrixAt(i, m);
            list.push(Object.assign(new THREE.Vector3(m.elements[12], m.elements[13], m.elements[14]), { cert: o.userData.certainty }));
          }
        }
      });
      const near = f.firstStreet.clone().add(new THREE.Vector3(-30, 0, 200));
      const w = list.sort((a, b) => a.cert - b.cert || a.distanceTo(near) - b.distanceTo(near))[0];
      return w ? { target: w, offset: new THREE.Vector3(30, 55, 70), marks: 'wells' } : null;
    }
    case 'cart': {
      // fly to the cart nearest the view, from behind and above it (it keeps moving)
      const c = app.bustle?.nearestCart(controls.target.x, controls.target.z);
      if (!c) return { target: f.firstStreet.clone(), offset: new THREE.Vector3(40, 45, 80) };
      const back = new THREE.Vector3(-Math.sin(c.yaw) * 14 + 6, 11, -Math.cos(c.yaw) * 14);
      return { target: new THREE.Vector3(c.x, c.y + 1, c.z), offset: back };
    }
    case 'fields': {
      const c = world.siteCenter;
      return { target: new THREE.Vector3(c.x + 120, world.groundAt(c.x + 120, c.z + 620), c.z + 620), offset: new THREE.Vector3(160, 160, 320) };
    }
    case 'drain':
      return { target: f.firstStreet.clone().add(new THREE.Vector3(0, -2, 60)), offset: new THREE.Vector3(60, 70, 110), marks: 'drains' };
    case 'evidence':
      return { target: f.firstStreet.clone(), offset: new THREE.Vector3(230, 320, 460) };
    case 'afterCity':
      return { target: world.siteCenter.clone(), offset: new THREE.Vector3(-40, 330, 640), era: 'today' };
    default:
      return null;
  }
}
function goToPlace(id, { openInfo = true } = {}) {
  if (!app.world) return;
  if (id.startsWith('craft-')) {
    goToStation(id.slice(6));
    if (openInfo) app.info.show(id);
    return;
  }
  const v = placeView(id);
  if (!v) return;
  setEra(v.era || living());
  flyTo({ target: v.target, position: v.position || v.target.clone().add(v.offset) });
  if (v.marks) markers?.show(v.marks, 12);
  if (openInfo) {
    // the gold outline is drawn after the walk view's (which has none) is gone
    setTimeout(() => app.info.show(id, v.shape), 40);
  }
}
let beforeTour = null;
const guide = createGuide({
  button: guideButton,
  panel: document.getElementById('guide-panel'),
  card: document.getElementById('tour-card'),
  tour: TOUR,
  groups: PLACE_GROUPS,
  features: FEATURES,
  searchWords: SEARCH_WORDS,
  onPlace: (id) => goToPlace(id),
  onStart: () => {
    beforeTour = { era: eras?.current || 'height', mode: certainty?.mode || 'alive' };
    chat.open(false);
    script.open(false);
    // the places sit above the tour card
    stage.setLift(0.2);
  },
  onStep: (s) => {
    if (!app.world) return;
    app.info.close();
    setMode(s.mode || 'alive');
    if (s.place.startsWith('craft-')) {
      setEra('height');
      goToStation(s.place.slice(6), { walkJump: false });
      return;
    }
    const v = placeView(s.place);
    setEra(s.era || v?.era || 'height');
    if (v) flyTo({ target: v.target, position: v.position || v.target.clone().add(v.offset) }, { duration: 4 });
  },
  onMore: (id) => {
    const v = id.startsWith('craft-') ? null : placeView(id);
    app.info.show(id, v?.shape || null);
  },
  onEnd: () => {
    stage.setLift(0);
    app.info.close();
    if (beforeTour) {
      setMode(beforeTour.mode);
      setEra(beforeTour.era);
    }
    beforeTour = null;
  },
});
if (params.has('debug')) app.guide = guide;
if (params.has('guide')) setTimeout(() => guide.open(true), 500);

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
  // walking ends the tour (its arrow keys would also step the tour)
  if (guide.touring) guide.stopTour();
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

  stage.updateLift(dt);
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
  if (bustle && light) {
    bustle.setSeason(daytime.state.season);
    bustle.update(dt, t, {
      camera,
      day: THREE.MathUtils.clamp((light.elevation + 4) / 14, 0, 1),
      rain: daytime.rainLevel,
      population: eras ? eras.population : 1,
      evidence: app.city.certainty.mixUniform.value,
      scale: stage.pixelsPerMetre(),
      hour: daytime.state.hour,
    });
  }
  markers?.update(dt);
  eras?.update(dt);
  updateSound(dt, light);
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
