import * as THREE from 'three';
import { createWalk } from '../walk.js';
import { buildCollision } from '../collision.js';
import { createMinimap } from '../minimap.js';
import { FIRST_STREET } from '../city/layout.js';

// The Walk / Fly button: flying down to eye height and back up, the walls you
// cannot pass, the minimap, and crisp shadows that follow the walker.

const SHADOW_WIDE = { radius: 820, normalBias: 0.35 };
const SHADOW_NEAR = { radius: 70, normalBias: 0.04 };

// a point on First Street in the HR area, looking north up the street
function firstStreetStart() {
  const [nx, nz] = FIRST_STREET.north;
  const [sx, sz] = FIRST_STREET.south;
  const t = 0.83;
  return { x: nx + (sx - nx) * t, z: nz + (sz - nz) * t, yaw: Math.atan2(-(nx - sx), -(nz - sz)) };
}

export function createWalkMode(app) {
  const { stage, params, isTouch } = app;
  const { camera, controls, flight, sun, sunDirection } = stage;
  const button = document.getElementById('walk-button');
  const hint = document.getElementById('walk-hint');
  const minimapEl = document.getElementById('minimap');
  const minimap = createMinimap(minimapEl);
  let walk = null;
  let collision = null;
  let hintTimer = 0;

  function setup() {
    const { world } = app;
    walk = createWalk({ camera, canvas: stage.canvas, groundAt: world.groundAt, onPlatform: world.onPlatform, joystickEl: document.getElementById('joystick') });
  }

  function ensureCollision() {
    if (collision) return collision;
    const t0 = performance.now();
    collision = buildCollision(app.city.obstacles, app.city.platformHeightAt);
    if (params.has('debug')) window.__walk = { walk, collision, ms: performance.now() - t0 };
    walk.setCollision(collision);
    minimap.build(collision);
    return collision;
  }

  function setShadowsAround(x, z, near) {
    const s = near ? SHADOW_NEAR : SHADOW_WIDE;
    Object.assign(sun.shadow.camera, { left: -s.radius, right: s.radius, top: s.radius, bottom: -s.radius });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.normalBias = s.normalBias;
    sun.target.position.set(x, app.world.groundAt(x, z), z);
    sun.position.copy(sun.target.position).addScaledVector(sunDirection, 3500);
  }

  function enter({ instant = false, firstStreet = false } = {}) {
    if (stage.walking || !walk) return;
    hint.textContent = 'Preparing the streets…';
    hint.classList.add('show');
    // let the message paint before the (short) collision build
    setTimeout(() => {
      ensureCollision();
      const { world } = app;
      let start = null;
      if (!firstStreet) {
        const t = controls.target;
        const spot = collision.nearestFree(t.x, t.z, world.onPlatform, 60);
        if (spot) start = { x: spot[0], z: spot[1], yaw: Math.atan2(-(t.x - camera.position.x), -(t.z - camera.position.z)) };
      }
      if (!start) {
        const s = firstStreetStart();
        const spot = collision.nearestFree(s.x, s.z, world.onPlatform, 30) || [s.x, s.z];
        start = { x: spot[0], z: spot[1], yaw: s.yaw };
      }
      const pose = walk.start(start.x, start.z, start.yaw);
      stage.walking = true;
      controls.enabled = false;
      app.labels.show(false);
      app.info.close();
      app.info.showOutlines(false);
      button.textContent = 'Fly';
      button.setAttribute('aria-label', 'Leave walk mode and fly');
      const go = () => {
        // close-up camera and crisp shadows only once we stand in the street
        camera.near = 0.1;
        camera.far = 9000;
        stage.resize();
        setShadowsAround(start.x, start.z, true);
        walk.enable(true);
        minimapEl.classList.add('on');
        hint.textContent = isTouch
          ? 'Use the circle to walk · drag anywhere to look'
          : 'W A S D or arrow keys to walk · drag to look · Shift to hurry';
        hint.classList.add('show');
        clearTimeout(hintTimer);
        hintTimer = setTimeout(() => hint.classList.remove('show'), 6000);
      };
      if (instant) {
        camera.position.copy(pose.position);
        camera.lookAt(pose.target);
        go();
      } else {
        hint.classList.remove('show');
        flight.to({ position: pose.position, target: pose.target, duration: 4 }, go);
      }
    }, 30);
  }

  function exit() {
    if (!stage.walking) return;
    walk.enable(false);
    stage.walking = false;
    minimapEl.classList.remove('on');
    hint.classList.remove('show');
    const { world } = app;
    const p = walk.position.clone();
    const back = new THREE.Vector3(Math.sin(walk.yaw), 0, Math.cos(walk.yaw)).multiplyScalar(90);
    const target = new THREE.Vector3(p.x, world.groundAt(p.x, p.z), p.z);
    camera.near = 1;
    camera.far = 40000;
    stage.resize();
    setShadowsAround(world.siteCenter.x, world.siteCenter.z, false);
    app.info.showOutlines(true);
    button.textContent = 'Walk';
    button.setAttribute('aria-label', 'Walk the streets at eye height');
    // start the flight from where the walker was looking, so the view turns smoothly
    controls.target.copy(walk.pose().target);
    flight.to({ position: target.clone().add(back).add(new THREE.Vector3(0, 80, 0)), target, duration: 3.5 }, () => {
      controls.enabled = true;
      app.labels.show(true);
    });
  }

  button.addEventListener('click', () => (stage.walking ? exit() : enter()));
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && stage.walking && !document.querySelector('.info-panel.open')) exit();
  });

  return {
    setup,
    enter,
    exit,
    ensureCollision,
    show() {
      button.hidden = false;
    },
    update(dt) {
      walk.update(dt);
      const p = walk.position;
      minimap.draw(p.x, p.z, walk.yaw);
      // keep crisp shadows around the walker
      if (Math.hypot(sun.target.position.x - p.x, sun.target.position.z - p.z) > 20) setShadowsAround(p.x, p.z, true);
    },
  };
}
