import * as THREE from 'three';
import { SEASONS, sunDirectionAt, lightAt, describeTime } from '../daylight.js';
import { createLamps } from '../lamps.js';
import { createTimeControl } from '../time-control.js';

// Time of day and season: moves the sun, recolours sky, haze, water and light,
// and lights the (imagined) lamps after dark.

export function createDaytime(app) {
  const { stage, params } = app;
  const { sun, hemi, sky, scene, renderer, haze, sunDirection } = stage;

  const clampHour = (h) => (Number.isFinite(h) ? ((h % 24) + 24) % 24 : 15.5);
  const state = {
    hour: clampHour(Number(params.get('time') ?? 15.5)),
    season: SEASONS[params.get('season')] ? params.get('season') : 'cool',
    playing: false,
  };

  const button = document.getElementById('time-button');
  let lamps = null;
  let light = null;
  let shownAt = 0;
  const control = createTimeControl({
    button,
    panel: document.getElementById('time-panel'),
    state,
    onChange: apply,
  });

  // lamps appear the first time it gets dark; the traced areas get a few too, placed
  // where the walls leave room
  function ensureLamps() {
    const { city, world } = app;
    if (lamps || !city || !world) return;
    const collision = app.ensureCollision();
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
    lamps = createLamps([...city.lamps, ...extra], { mixUniform: city.certainty.mixUniform });
    scene.add(lamps.mesh);
  }

  function apply() {
    const day = SEASONS[state.season].day;
    sunDirectionAt(day, state.hour, sunDirection);
    const L = lightAt(sunDirection, state.season);
    light = L;
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
    u.uStarAngle.value = (state.hour / 24) * Math.PI * 2;
    if (app.water) {
      const w = app.water.material.uniforms;
      w.uSunDir.value.copy(sunDirection);
      w.uSky.value.copy(L.mid).lerp(L.low, 0.5);
      w.uSun.value.copy(L.sun);
      w.uSunStrength.value = THREE.MathUtils.smoothstep(sunDirection.y, 0.0, 0.08);
      const lv = THREE.MathUtils.clamp(0.18 + (L.sunI / 2.9) * 0.82, 0.18, 1.05);
      w.uLight.value.copy(L.hemiSky).multiplyScalar(lv / Math.max(0.5, (L.hemiSky.r + L.hemiSky.g + L.hemiSky.b) / 3));
    }
    if (params.has('debug')) window.__time = { state, L, sun: sun.intensity, hemi: hemi.intensity };
    if (L.glow > 0.01) ensureLamps();
    sun.position.copy(sun.target.position).addScaledVector(sunDirection, 3500);
    // while the day plays, refresh the words a few times a second, not every frame
    const now = performance.now();
    if (!state.playing || now - shownAt > 250) {
      shownAt = now;
      control.show({ phrase: describeTime(state.hour, L.elevation), dark: L.elevation < -4 });
    }
  }

  return {
    state,
    apply,
    show() {
      button.hidden = false;
    },
    update(dt, t) {
      if (state.playing && app.world) {
        // a whole day in about two minutes
        state.hour = (state.hour + dt * 0.2) % 24;
        apply();
      }
      if (lamps && light) {
        lamps.update({ time: t, glow: light.glow, fog: scene.fog.density, scale: stage.pixelsPerMetre() });
      }
    },
  };
}
